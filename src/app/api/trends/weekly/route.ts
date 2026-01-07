import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { calculateBaselineMetrics } from '@/utils/baselineCalculations';
import {
    toLocalDateString,
    DEFAULT_TIMEZONE,
    formatDateForPocketBase,
    getLocalDayStartUTC,
    getLocalDayEndUTC,
    getWeeklyReportStartDate,
    getWeeklyReportEndDate,
    getCurrentWeekRange,
} from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const endDateParam = searchParams.get('endDate');
    const refresh = searchParams.get('refresh') === 'true'; // New param to force refresh

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const pb = await getAdminPb();

        // Get user's timezone, signup date, and usage_phase
        let userTimezone = DEFAULT_TIMEZONE;
        let userSignupDate: Date | null = null;
        let usagePhase: 'calibration' | 'early_baseline' | 'full_baseline' | null = null;

        try {
            const user = await pb.collection('users').getOne(userId);
            userTimezone = user.timezone || DEFAULT_TIMEZONE;
            userSignupDate = user.created ? new Date(user.created) : null;
            usagePhase = user.usage_phase || null;
        } catch {
            console.warn('[Weekly API] Could not fetch user data, using defaults');
        }

        // Helper to format date in user's timezone
        const formatLocalDate = (d: Date) => toLocalDateString(d, userTimezone);

        // Determine date range using Sunday-Saturday week logic
        const referenceDate = endDateParam ? new Date(endDateParam) : new Date();
        const endDate = getWeeklyReportEndDate(userTimezone, referenceDate);
        const startDate = userSignupDate
            ? getWeeklyReportStartDate(userSignupDate, userTimezone, referenceDate)
            : getWeeklyReportStartDate(new Date(), userTimezone, referenceDate);

        // Get local date strings for the range
        const startLocalDate = formatLocalDate(startDate);
        const endLocalDate = formatLocalDate(endDate);

        // Expand range by ±1 day to account for timezone offsets on boundaries
        const expandedStartDate = new Date(startDate);
        expandedStartDate.setDate(expandedStartDate.getDate() - 1);
        const expandedStartLocalDate = formatLocalDate(expandedStartDate);

        const expandedEndDate = new Date(endDate);
        expandedEndDate.setDate(expandedEndDate.getDate() + 1);
        const expandedEndLocalDate = formatLocalDate(expandedEndDate);

        // Convert to UTC boundaries for query
        const startUTC = getLocalDayStartUTC(expandedStartLocalDate, userTimezone);
        const endUTC = getLocalDayEndUTC(expandedEndLocalDate, userTimezone);

        const startStr = formatDateForPocketBase(startUTC);
        const endStr = formatDateForPocketBase(endUTC);

        console.log(`[Weekly API] User timezone: ${userTimezone}, Local range: ${startLocalDate} to ${endLocalDate}, UTC range: ${startStr} to ${endStr}`);

        // Fetch sessions - need all score fields
        let sessions: any[] = [];
        try {
            sessions = await pb.collection('session_summary').getFullList({
                filter: `user_id = "${userId}" && session_date >= "${startStr}" && session_date <= "${endStr}"`,
                sort: 'session_date',
            });
        } catch (dbError) {
            console.warn('Weekly API: Database error or no sessions found', dbError);
            sessions = [];
        }

        // Fetch last 30 days for baseline calculation
        const baselineStartDate = new Date(endDate);
        baselineStartDate.setDate(endDate.getDate() - 30);
        const baselineStartLocalDate = formatLocalDate(baselineStartDate);

        const expandedBaselineStart = new Date(baselineStartDate);
        expandedBaselineStart.setDate(expandedBaselineStart.getDate() - 1);
        const expandedBaselineStartLocal = formatLocalDate(expandedBaselineStart);

        const baselineStartUTC = getLocalDayStartUTC(expandedBaselineStartLocal, userTimezone);
        const baselineStartStr = formatDateForPocketBase(baselineStartUTC);

        let baselineSessions: any[] = [];
        try {
            baselineSessions = await pb.collection('session_summary').getFullList({
                filter: `user_id = "${userId}" && session_date >= "${baselineStartStr}" && session_date <= "${endStr}"`,
                sort: 'session_date',
            });
        } catch (e) {
            console.warn('Weekly API: Failed to fetch baseline sessions', e);
            baselineSessions = [];
        }

        // Calculate baseline metrics
        let baselineMetrics = {
            rmssd_avg: null as number | null,
            rmssd_stdev: null as number | null,
            hr_avg: null as number | null,
            hr_stdev: null as number | null
        };

        try {
            if (baselineSessions.length > 0) {
                const fullMetrics = calculateBaselineMetrics(baselineSessions as unknown as import('@/types').SessionSummaryRecord[]);
                baselineMetrics = {
                    rmssd_avg: fullMetrics.rmssd_avg,
                    rmssd_stdev: fullMetrics.rmssd_stdev,
                    hr_avg: fullMetrics.hr_avg,
                    hr_stdev: fullMetrics.hr_stdev
                };
            }
        } catch (calcError) {
            console.error('Weekly API: Error calculating baseline', calcError);
        }

        // Process Data for the Weekly View - Group by Day with all 5 scores
        const dailyMap = new Map<string, {
            rmssd: number[];
            hr: number[];
            score: number[];
            energy: number[];
            stress: number[];
            health: number[];
            focus: number[];
            readiness: number[];
        }>();

        sessions.forEach((s: any) => {
            if (!s.session_date) return;
            const date = toLocalDateString(s.session_date, userTimezone);
            if (date < startLocalDate || date > endLocalDate) {
                return;
            }
            if (!dailyMap.has(date)) {
                dailyMap.set(date, {
                    rmssd: [],
                    hr: [],
                    score: [],
                    energy: [],
                    stress: [],
                    health: [],
                    focus: [],
                    readiness: []
                });
            }
            const dayData = dailyMap.get(date)!;
            if (s.rmssd_session_ms !== null && s.rmssd_session_ms !== undefined) dayData.rmssd.push(s.rmssd_session_ms);
            if (s.session_mean_hr !== null && s.session_mean_hr !== undefined) dayData.hr.push(s.session_mean_hr);
            const scoreVal = s.hrv_score ?? s.readiness_score;
            if (scoreVal !== null && scoreVal !== undefined) dayData.score.push(scoreVal);
            if (s.energy_score !== null && s.energy_score !== undefined) dayData.energy.push(s.energy_score);
            if (s.stress_score !== null && s.stress_score !== undefined) dayData.stress.push(s.stress_score);
            if (s.health_score !== null && s.health_score !== undefined) dayData.health.push(s.health_score);
            if (s.focus_score !== null && s.focus_score !== undefined) dayData.focus.push(s.focus_score);
            const readinessVal = s.readiness_score ?? s.hrv_score ?? s.energy_score;
            if (readinessVal !== null && readinessVal !== undefined) dayData.readiness.push(readinessVal);
        });

        // Generate Daily Averages + Rolling Averages for Sunday-Saturday week
        // Get the current week's Sunday-Saturday range
        const { sunday, saturday } = getCurrentWeekRange(userTimezone, referenceDate);

        // Generate array of dates from startDate to endDate (or Sunday to Saturday if within week)
        const displayDays = [];
        const currentDate = new Date(startDate);
        const endDateForLoop = endDate <= saturday ? endDate : saturday;

        while (currentDate <= endDateForLoop) {
            const dayStr = formatLocalDate(currentDate);
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });

            const dayData = dailyMap.get(dayStr);

            // Calculate daily averages
            const rmssdRaw = dayData && dayData.rmssd.length > 0
                ? Math.round(dayData.rmssd.reduce((a, b) => a + b, 0) / dayData.rmssd.length)
                : null;
            const hrRaw = dayData && dayData.hr.length > 0
                ? Math.round(dayData.hr.reduce((a, b) => a + b, 0) / dayData.hr.length)
                : null;
            const scoreRaw = dayData && dayData.score.length > 0
                ? Math.round(dayData.score.reduce((a, b) => a + b, 0) / dayData.score.length)
                : null;
            const energyRaw = dayData && dayData.energy.length > 0
                ? Math.round(dayData.energy.reduce((a, b) => a + b, 0) / dayData.energy.length)
                : null;
            const stressRaw = dayData && dayData.stress.length > 0
                ? Math.round(dayData.stress.reduce((a, b) => a + b, 0) / dayData.stress.length)
                : null;
            const healthRaw = dayData && dayData.health.length > 0
                ? Math.round(dayData.health.reduce((a, b) => a + b, 0) / dayData.health.length)
                : null;
            const focusRaw = dayData && dayData.focus.length > 0
                ? Math.round(dayData.focus.reduce((a, b) => a + b, 0) / dayData.focus.length)
                : null;
            const readinessRaw = dayData && dayData.readiness.length > 0
                ? Math.round(dayData.readiness.reduce((a, b) => a + b, 0) / dayData.readiness.length)
                : null;

            // Calculate 7-Day Rolling Averages
            let rmssdSum = 0, rmssdCount = 0;
            let hrSum = 0, hrCount = 0;
            let scoreSum = 0, scoreCount = 0;
            let energySum = 0, energyCount = 0;
            let stressSum = 0, stressCount = 0;
            let healthSum = 0, healthCount = 0;
            let focusSum = 0, focusCount = 0;

            for (let j = 0; j < 7; j++) {
                const lookback = new Date(currentDate);
                lookback.setDate(currentDate.getDate() - j);
                const lbStr = formatLocalDate(lookback);
                const lbData = dailyMap.get(lbStr);

                if (lbData) {
                    if (lbData.rmssd.length > 0) {
                        rmssdSum += lbData.rmssd.reduce((a, b) => a + b, 0) / lbData.rmssd.length;
                        rmssdCount++;
                    }
                    if (lbData.hr.length > 0) {
                        hrSum += lbData.hr.reduce((a, b) => a + b, 0) / lbData.hr.length;
                        hrCount++;
                    }
                    if (lbData.score.length > 0) {
                        scoreSum += lbData.score.reduce((a, b) => a + b, 0) / lbData.score.length;
                        scoreCount++;
                    }
                    if (lbData.energy.length > 0) {
                        energySum += lbData.energy.reduce((a, b) => a + b, 0) / lbData.energy.length;
                        energyCount++;
                    }
                    if (lbData.stress.length > 0) {
                        stressSum += lbData.stress.reduce((a, b) => a + b, 0) / lbData.stress.length;
                        stressCount++;
                    }
                    if (lbData.health.length > 0) {
                        healthSum += lbData.health.reduce((a, b) => a + b, 0) / lbData.health.length;
                        healthCount++;
                    }
                    if (lbData.focus.length > 0) {
                        focusSum += lbData.focus.reduce((a, b) => a + b, 0) / lbData.focus.length;
                        focusCount++;
                    }
                }
            }

            displayDays.push({
                date: dayStr,
                name: dayName,
                score: scoreRaw,
                energy: energyRaw,
                stress: stressRaw,
                health: healthRaw,
                focus: focusRaw,
                readiness: readinessRaw,
                rmssd: rmssdRaw,
                hr: hrRaw,
                rmssdAvg: rmssdCount > 0 ? Math.round(rmssdSum / rmssdCount) : null,
                hrAvg: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
                rmssdMin: (baselineMetrics.rmssd_avg !== null && baselineMetrics.rmssd_stdev !== null)
                    ? Math.round(baselineMetrics.rmssd_avg - (0.5 * baselineMetrics.rmssd_stdev))
                    : null,
                rmssdMax: (baselineMetrics.rmssd_avg !== null && baselineMetrics.rmssd_stdev !== null)
                    ? Math.round(baselineMetrics.rmssd_avg + (0.5 * baselineMetrics.rmssd_stdev))
                    : null,
                hrMin: (baselineMetrics.hr_avg !== null && baselineMetrics.hr_stdev !== null)
                    ? Math.round(baselineMetrics.hr_avg - (0.5 * baselineMetrics.hr_stdev))
                    : null,
                hrMax: (baselineMetrics.hr_avg !== null && baselineMetrics.hr_stdev !== null)
                    ? Math.round(baselineMetrics.hr_avg + (0.5 * baselineMetrics.hr_stdev))
                    : null,
            });

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calculate Statistics
        // Averages for the 5 Scores
        const validScores = displayDays.map(d => d.score).filter((v): v is number => v !== null && v > 0);
        const validEnergy = displayDays.map(d => d.energy).filter((v): v is number => v !== null && v > 0);
        const validStress = displayDays.map(d => d.stress).filter((v): v is number => v !== null && v > 0);
        const validHealth = displayDays.map(d => d.health).filter((v): v is number => v !== null && v > 0);
        const validFocus = displayDays.map(d => d.focus).filter((v): v is number => v !== null && v > 0);
        const validReadiness = displayDays.map(d => d.readiness).filter((v): v is number => v !== null && v > 0);

        const avgScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
        const avgEnergy = validEnergy.length > 0 ? Math.round(validEnergy.reduce((a, b) => a + b, 0) / validEnergy.length) : 0;
        const avgStress = validStress.length > 0 ? Math.round(validStress.reduce((a, b) => a + b, 0) / validStress.length) : 0;
        const avgHealth = validHealth.length > 0 ? Math.round(validHealth.reduce((a, b) => a + b, 0) / validHealth.length) : 0;
        const avgFocus = validFocus.length > 0 ? Math.round(validFocus.reduce((a, b) => a + b, 0) / validFocus.length) : 0;
        const avgReadiness = validReadiness.length > 0 ? Math.round(validReadiness.reduce((a, b) => a + b, 0) / validReadiness.length) : 0;

        // Calculate Changes (vs first day or previous week if available)
        // For now, calculate vs first day
        const firstDayScore = validScores.length > 0 ? validScores[0] : null;
        const firstDayEnergy = validEnergy.length > 0 ? validEnergy[0] : null;
        const firstDayStress = validStress.length > 0 ? validStress[0] : null;
        const firstDayHealth = validHealth.length > 0 ? validHealth[0] : null;
        const firstDayFocus = validFocus.length > 0 ? validFocus[0] : null;
        const firstDayReadiness = validReadiness.length > 0 ? validReadiness[0] : null;

        const lastDayScore = validScores.length > 0 ? validScores[validScores.length - 1] : null;
        const lastDayEnergy = validEnergy.length > 0 ? validEnergy[validEnergy.length - 1] : null;
        const lastDayStress = validStress.length > 0 ? validStress[validStress.length - 1] : null;
        const lastDayHealth = validHealth.length > 0 ? validHealth[validHealth.length - 1] : null;
        const lastDayFocus = validFocus.length > 0 ? validFocus[validFocus.length - 1] : null;
        const lastDayReadiness = validReadiness.length > 0 ? validReadiness[validReadiness.length - 1] : null;

        const changeScore = firstDayScore && lastDayScore ? Number(((lastDayScore - firstDayScore) / firstDayScore * 100).toFixed(1)) : 0;
        const changeEnergy = firstDayEnergy && lastDayEnergy ? Number(((lastDayEnergy - firstDayEnergy) / firstDayEnergy * 100).toFixed(1)) : 0;
        const changeStress = firstDayStress && lastDayStress ? Number(((lastDayStress - firstDayStress) / firstDayStress * 100).toFixed(1)) : 0;
        const changeHealth = firstDayHealth && lastDayHealth ? Number(((lastDayHealth - firstDayHealth) / firstDayHealth * 100).toFixed(1)) : 0;
        const changeFocus = firstDayFocus && lastDayFocus ? Number(((lastDayFocus - firstDayFocus) / firstDayFocus * 100).toFixed(1)) : 0;
        const changeReadiness = firstDayReadiness && lastDayReadiness ? Number(((lastDayReadiness - firstDayReadiness) / firstDayReadiness * 100).toFixed(1)) : 0;

        // Calculate Stability (CV) for RMSSD
        const validRmssd = displayDays.map(d => d.rmssd).filter((v): v is number => v !== null && v > 0);
        let weeklyCV = 0;
        let changeCV = 0;
        if (validRmssd.length > 1) {
            const mean = validRmssd.reduce((a, b) => a + b, 0) / validRmssd.length;
            const squaredDiffs = validRmssd.map(v => Math.pow(v - mean, 2));
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / validRmssd.length;
            const sd = Math.sqrt(variance);
            weeklyCV = mean > 0 ? Number(((sd / mean) * 100).toFixed(1)) : 0;
            // For changeCV, compare first half vs second half (simplified)
            if (validRmssd.length >= 4) {
                const mid = Math.floor(validRmssd.length / 2);
                const firstHalf = validRmssd.slice(0, mid);
                const secondHalf = validRmssd.slice(mid);
                const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
                const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
                const firstSd = Math.sqrt(firstHalf.map(v => Math.pow(v - firstMean, 2)).reduce((a, b) => a + b, 0) / firstHalf.length);
                const secondSd = Math.sqrt(secondHalf.map(v => Math.pow(v - secondMean, 2)).reduce((a, b) => a + b, 0) / secondHalf.length);
                const firstCV = firstMean > 0 ? (firstSd / firstMean) * 100 : 0;
                const secondCV = secondMean > 0 ? (secondSd / secondMean) * 100 : 0;
                changeCV = Number((secondCV - firstCV).toFixed(1));
            }
        }

        // Calculate Trend
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (validScores.length >= 3) {
            const firstThird = validScores.slice(0, Math.ceil(validScores.length / 3));
            const lastThird = validScores.slice(-Math.ceil(validScores.length / 3));
            const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
            const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
            const diff = lastAvg - firstAvg;
            if (diff > 5) trend = 'improving';
            else if (diff < -5) trend = 'declining';
        }

        // Generate AI Insight (with caching)
        let insightTitle = 'Data Processing...';
        let insightObservation = 'Gathering sufficient biometric data to generate actionable insights.';
        let insightAction = 'Continue tracking your sessions to build a comprehensive view of your recovery patterns.';


        const avgHR = baselineMetrics.hr_avg || (displayDays.find(d => d.hr !== null)?.hr) || 0;
        const avgHRV = baselineMetrics.rmssd_avg || (displayDays.find(d => d.rmssd !== null)?.rmssd) || 0;

        // Create date range for week_start (PocketBase stores dates with time as YYYY-MM-DD 00:00:00.000Z)
        const weekStartForQuery = `${startLocalDate} 00:00:00.000Z`;

        // Handle Refresh Request
        if (refresh) {
            console.log(`[Weekly API] Refresh requested. Deleting existing insight for ${weekStartForQuery}`);
            try {
                const existing = await pb.collection('weekly_insights').getList(1, 1, {
                    filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`
                });
                if (existing.items.length > 0) {
                    await pb.collection('weekly_insights').delete(existing.items[0].id);
                    console.log(`[Weekly API] Deleted cached insight ${existing.items[0].id}`);
                }
            } catch (delError) {
                console.warn('[Weekly API] Failed to delete insight on refresh:', delError);
            }
        }

        // Check for existing insight in DB first (unless refresh was requested)
        let existingInsight: any = null;
        if (!refresh) {
            try {
                const existingResults = await pb.collection('weekly_insights').getList(1, 1, {
                    filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`,
                });
                if (existingResults.items.length > 0) {
                    existingInsight = existingResults.items[0];
                }
            } catch (dbError: any) {
                console.warn('[Weekly API] DB lookup error:', dbError.message);
            }
        }

        if (existingInsight) {
            // Use existing insight from DB
            insightTitle = existingInsight.insight_title;
            insightObservation = existingInsight.insight_observation;
            insightAction = existingInsight.insight_action;
        } else if (validScores.length > 0 && validRmssd.length > 0) {
            // No existing insight - generate with AI
            try {
                // Prepare baseline comparison text
                let baselineComparison = 'Baseline not yet established';
                if (baselineMetrics.rmssd_avg !== null && avgHRV > 0) {
                    const diff = avgHRV - baselineMetrics.rmssd_avg;
                    const percentDiff = (diff / baselineMetrics.rmssd_avg) * 100;
                    if (percentDiff > 5) {
                        baselineComparison = `RMSSD is ${percentDiff.toFixed(1)}% above baseline (${baselineMetrics.rmssd_avg.toFixed(0)}ms)`;
                    } else if (percentDiff < -5) {
                        baselineComparison = `RMSSD is ${Math.abs(percentDiff).toFixed(1)}% below baseline (${baselineMetrics.rmssd_avg.toFixed(0)}ms)`;
                    } else {
                        baselineComparison = `RMSSD is within baseline range (${baselineMetrics.rmssd_avg.toFixed(0)}ms)`;
                    }
                }

                // Prepare daily data for pattern recognition
                const dailyDataForAI = displayDays.map(d => ({
                    day: d.name,
                    energy: d.energy,
                    stress: d.stress,
                    health: d.health,
                    focus: d.focus,
                    score: d.score
                }));

                // Call AI Insight API (internal call)
                const baseUrl = request.nextUrl.origin;
                const aiPayload = {
                    mode: 'weekly',
                    data: {
                        scores: {
                            energy: { avg: avgEnergy, change: changeEnergy },
                            stress: { avg: avgStress, change: changeStress },
                            health: { avg: avgHealth, change: changeHealth },
                            focus: { avg: avgFocus, change: changeFocus },
                            hrvScore: { avg: avgScore, change: changeScore }
                        },
                        readiness: {
                            avg: avgReadiness,
                            change: changeReadiness
                        },
                        hrv: {
                            avgRMSSD: Math.round(avgHRV),
                            weeklyCV: weeklyCV,
                            changeCV: changeCV
                        },
                        baseline: {
                            rmssdAvg: baselineMetrics.rmssd_avg,
                            hrAvg: baselineMetrics.hr_avg,
                            comparison: baselineComparison
                        },
                        dailyData: dailyDataForAI,
                        weekRange: {
                            start: startLocalDate,
                            end: endLocalDate
                        },
                        usagePhase: usagePhase
                    }
                };

                console.log('[Weekly API] 📤 Sending Payload to AI:', JSON.stringify(aiPayload, null, 2));

                const aiResponse = await fetch(`${baseUrl}/api/ai-insight`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiPayload)
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    console.log('[Weekly API] 🤖 Full AI Response:', JSON.stringify(aiData, null, 2));

                    // Support both new (OpenAI) and old (Gemini) keys
                    const obsCheck = aiData.observation || aiData.insight;
                    const actionCheck = aiData.action || aiData.actionableInsight;

                    if (obsCheck && actionCheck) {
                        insightObservation = obsCheck;
                        insightAction = actionCheck;
                        // Use title from AI if available, otherwise fallback
                        insightTitle = aiData.title || obsCheck.split('.')[0].substring(0, 50) || 'Weekly Analysis';


                        // Always save insights to database for tracking viewed status
                        // (even if cache reading is disabled)
                        try {
                            console.log(`[Weekly API] Attempting to save insight to database:`, {
                                user_id: userId,
                                week_start: weekStartForQuery,
                                title: insightTitle
                            });
                            await pb.collection('weekly_insights').create({
                                user_id: userId,
                                week_start: weekStartForQuery,
                                insight_title: insightTitle,
                                insight_observation: insightObservation,
                                insight_action: insightAction,
                                viewed: true // Set to true since row is created when modal is opened
                            });
                            console.log(`[Weekly API] ✅ Successfully saved insight to database for week ${startLocalDate}`);
                        } catch (saveError: any) {
                            // If duplicate, try to update instead
                            if (saveError.message?.includes('UNIQUE constraint') || saveError.status === 400) {
                                console.log('[Weekly API] Insight entry exists, attempting update instead');
                                try {
                                    const existing = await pb.collection('weekly_insights').getList(1, 1, {
                                        filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`
                                    });
                                    if (existing.items.length > 0) {
                                        await pb.collection('weekly_insights').update(existing.items[0].id, {
                                            insight_title: insightTitle,
                                            insight_observation: insightObservation,
                                            insight_action: insightAction,
                                            // Set to true since modal is open (regenerating insights)
                                            viewed: true
                                        });
                                        console.log(`[Weekly API] ✅ Updated existing insight entry for week ${startLocalDate}`);
                                    }
                                } catch (updateError) {
                                    console.warn('[Weekly API] Failed to update insight:', updateError);
                                }
                            } else {
                                console.warn('[Weekly API] Failed to save insight to database:', saveError.message);
                            }
                        }
                    }
                } else {
                    console.warn('[Weekly API] AI Insight API failed, using fallback');
                }
            } catch (aiError) {
                console.error('[Weekly API] Error calling AI Insight API:', aiError);
                // Fallback to default messages
            }
        }

        return NextResponse.json({
            data: displayDays,
            stats: {
                avgScore,
                avgEnergy,
                avgStress,
                avgHealth,
                avgFocus,
                changeScore,
                changeEnergy,
                changeStress,
                changeHealth,
                changeFocus,
                avgReadiness,
                changeReadiness,
                weeklyCV,
                changeCV,
                avgHR: Math.round(avgHR),
                avgRMSSD: Math.round(avgHRV),
                trend,
                insightTitle,
                insightObservation,
                insightAction
            },
            usage_phase: usagePhase,
            weekRange: {
                start: startLocalDate,
                end: endLocalDate
            }
        });

    } catch (error) {
        console.error('Weekly trend API error (Fatal):', error);
        return NextResponse.json({
            data: [],
            stats: {
                avgScore: 0,
                avgEnergy: 0,
                avgStress: 0,
                avgHealth: 0,
                avgFocus: 0,
                changeScore: 0,
                changeEnergy: 0,
                changeStress: 0,
                changeHealth: 0,
                changeFocus: 0,
                avgReadiness: 0,
                changeReadiness: 0,
                weeklyCV: 0,
                changeCV: 0,
                avgHR: 0,
                avgRMSSD: 0,
                trend: 'stable' as const,
                insightTitle: 'Data Processing...',
                insightObservation: 'Gathering sufficient biometric data to generate actionable insights.',
                insightAction: 'Continue tracking your sessions to build a comprehensive view of your recovery patterns.'
            },
            usage_phase: null,
            error: 'Not enough data available'
        });
    }
}
