import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { toLocalDateString, DEFAULT_TIMEZONE, getLocalDayStartUTC, getLocalDayEndUTC, formatDateForPocketBase } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const monthStr = searchParams.get('month'); // Expect 'YYYY-MM'
    const dateStr = searchParams.get('date'); // Fallback: specific date to extract month from

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const pb = await getAdminPb();

        // Get user's timezone
        let userTimezone = DEFAULT_TIMEZONE;
        try {
            const user = await pb.collection('users').getOne(userId);
            userTimezone = user.timezone || DEFAULT_TIMEZONE;
        } catch {
            console.warn('[Monthly API] Could not fetch user timezone, using default');
        }

        // Helper to format date in user's timezone
        const formatLocalDate = (d: Date) => toLocalDateString(d, userTimezone);

        // 1. Determine Time Range
        let targetDate = new Date();
        if (monthStr) {
            targetDate = new Date(`${monthStr}-01`);
        } else if (dateStr) {
            targetDate = new Date(dateStr);
        }

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-indexed

        // Start and End of the Target Month (in user's local timezone)
        const monthStartLocal = formatLocalDate(new Date(year, month, 1));
        const monthEndLocal = formatLocalDate(new Date(year, month + 1, 0));
        const monthEnd = new Date(year, month + 1, 0); // Date object for comparison

        // Fetch Data Buffer: Need previous 30 days for rolling predictions/baselines
        const fetchStartDate = new Date(year, month, 1);
        fetchStartDate.setDate(fetchStartDate.getDate() - 30);
        const fetchStartLocal = formatLocalDate(fetchStartDate);

        // Convert local date strings to UTC boundaries for database query
        // Expand range by ±1 day to account for timezone offsets on boundaries
        const expandedFetchStart = new Date(fetchStartDate);
        expandedFetchStart.setDate(expandedFetchStart.getDate() - 1);
        const expandedFetchStartLocal = formatLocalDate(expandedFetchStart);

        const expandedMonthEnd = new Date(year, month + 1, 0);
        expandedMonthEnd.setDate(expandedMonthEnd.getDate() + 1);
        const expandedMonthEndLocal = formatLocalDate(expandedMonthEnd);

        const startUTC = getLocalDayStartUTC(expandedFetchStartLocal, userTimezone);
        const endUTC = getLocalDayEndUTC(expandedMonthEndLocal, userTimezone);

        const startStr = formatDateForPocketBase(startUTC);
        const endStr = formatDateForPocketBase(endUTC);

        console.log(`[Monthly API] User timezone: ${userTimezone}, Local range: ${fetchStartLocal} to ${monthEndLocal}, UTC range: ${startStr} to ${endStr}`);

        // 2. Fetch Sessions
        let sessions: any[] = [];
        try {
            sessions = await pb.collection('session_summary').getFullList({
                filter: `user_id = "${userId}" && session_date >= "${startStr}" && session_date <= "${endStr}"`,
                sort: 'session_date',
            });
        } catch (dbError) {
            console.warn('Monthly API: Database error or no sessions found', dbError);
            sessions = [];
        }

        // 3. Process Daily Data (30 days)
        const days = [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const maxDays = Math.min(30, daysInMonth);

        for (let day = 1; day <= maxDays; day++) {
            const dayDate = new Date(year, month, day);
            if (dayDate > monthEnd) continue;

            const dayStart = new Date(year, month, day);
            const dayEnd = new Date(year, month, day, 23, 59, 59);
            const dayStartLocal = formatLocalDate(dayStart);
            const dayEndLocal = formatLocalDate(dayEnd);

            const daySessions = sessions.filter(s => {
                if (!s.session_date) return false;
                const sessionLocalDate = toLocalDateString(s.session_date, userTimezone);
                return sessionLocalDate >= dayStartLocal && sessionLocalDate <= dayEndLocal;
            });

            // Daily Averages for all metrics
            const rmssdDaily = calculateAverage(daySessions, 'rmssd_session_ms');
            const hfnuDaily = calculateAverageNormalizedHF(daySessions);
            const scoreDaily = calculateAverageScore(daySessions);
            const energyDaily = calculateAverage(daySessions, 'energy_score');
            const stressDaily = calculateAverage(daySessions, 'stress_score');
            const healthDaily = calculateAverage(daySessions, 'health_score');
            const focusDaily = calculateAverage(daySessions, 'focus_score');
            const restingHRDaily = calculateAverage(daySessions, 'session_mean_hr');

            // 30-Day Rolling Average at the END of this day
            const rollingStart = new Date(dayEnd);
            rollingStart.setDate(rollingStart.getDate() - 30);
            const rollingStartLocal = formatLocalDate(rollingStart);

            const rollingSessions = sessions.filter(s => {
                if (!s.session_date) return false;
                const sessionLocalDate = toLocalDateString(s.session_date, userTimezone);
                return sessionLocalDate >= rollingStartLocal && sessionLocalDate <= dayEndLocal;
            });

            const rmssdRolling = calculateAverage(rollingSessions, 'rmssd_session_ms');
            const scoreRolling = calculateAverageScore(rollingSessions);

            days.push({
                label: String(day),
                startDate: formatLocalDate(dayStart),
                endDate: formatLocalDate(dayEnd),
                // Core metrics
                rmssd: Math.round(rmssdDaily || 0),
                rmssdRolling: Math.round(rmssdRolling || 0),
                hfnu: Math.round(hfnuDaily || 0),
                score: Math.round(scoreDaily || 0),
                scoreRolling: Math.round(scoreRolling || 0),
                // Additional metrics for Body/Mind chart
                energy: Math.round(energyDaily || 0),
                stress: Math.round(stressDaily || 0),
                health: Math.round(healthDaily || 0),
                focus: Math.round(focusDaily || 0),
                restingHR: Math.round(restingHRDaily || 0),
                hasData: daySessions.length > 0
            });
        }

        // 4. Monthly Aggregates
        const monthSessions = sessions.filter(s => {
            if (!s.session_date) return false;
            const sessionLocalDate = toLocalDateString(s.session_date, userTimezone);
            return sessionLocalDate >= monthStartLocal && sessionLocalDate <= monthEndLocal;
        });

        // Calculate Monthly CV
        const validRmssd = monthSessions.filter(s => s.rmssd_session_ms).map(s => s.rmssd_session_ms);
        let monthlyCV = 0;
        if (validRmssd.length > 1) {
            const mean = validRmssd.reduce((a: number, b: number) => a + b, 0) / validRmssd.length;
            const variance = validRmssd.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / validRmssd.length;
            const sd = Math.sqrt(variance);
            monthlyCV = mean > 0 ? (sd / mean) * 100 : 0;
        }

        // Calculate average scores for the month
        const avgScore = Math.round(calculateAverageScore(monthSessions) || 0);
        const avgEnergy = Math.round(calculateAverage(monthSessions, 'energy_score') || 0);
        const avgStress = Math.round(calculateAverage(monthSessions, 'stress_score') || 0);
        const avgHealth = Math.round(calculateAverage(monthSessions, 'health_score') || 0);
        const avgFocus = Math.round(calculateAverage(monthSessions, 'focus_score') || 0);
        const avgRMSSD = Math.round(calculateAverage(monthSessions, 'rmssd_session_ms') || 0);
        const avgRestingHR = Math.round(calculateAverage(monthSessions, 'session_mean_hr') || 0);

        // Calculate changes (first day vs last day with data)
        const daysWithData = days.filter(d => d.hasData);
        let changeScore = 0, changeEnergy = 0, changeStress = 0, changeHealth = 0, changeFocus = 0;

        if (daysWithData.length >= 2) {
            const first = daysWithData[0];
            const last = daysWithData[daysWithData.length - 1];
            changeScore = first.score > 0 ? Math.round(((last.score - first.score) / first.score) * 100) : 0;
            changeEnergy = first.energy > 0 ? Math.round(((last.energy - first.energy) / first.energy) * 100) : 0;
            changeStress = first.stress > 0 ? Math.round(((last.stress - first.stress) / first.stress) * 100) : 0;
            changeHealth = first.health > 0 ? Math.round(((last.health - first.health) / first.health) * 100) : 0;
            changeFocus = first.focus > 0 ? Math.round(((last.focus - first.focus) / first.focus) * 100) : 0;
        }

        // 5. AI Insight Generation (with caching)
        let insightTitle = 'Monthly Patterns';
        let insightObservation = 'Gathering sufficient biometric data to generate actionable insights.';
        let insightAction = 'Continue tracking your sessions to build a comprehensive view of your recovery patterns.';

        const monthStartForQuery = `${monthStartLocal} 00:00:00.000Z`;

        // Check for existing insight in DB first
        let existingInsight: any = null;
        try {
            const existingResults = await pb.collection('monthly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && month_start = "${monthStartForQuery}"`,
            });
            if (existingResults.items.length > 0) {
                existingInsight = existingResults.items[0];
            }
        } catch (dbError: any) {
            console.warn('[Monthly API] DB lookup error:', dbError.message);
        }

        if (existingInsight) {
            // Use existing insight from DB
            insightTitle = existingInsight.insight_title;
            insightObservation = existingInsight.insight_observation;
            insightAction = existingInsight.insight_action;
        } else if (monthSessions.length >= 3) {
            // No existing insight - generate with AI
            try {
                const baseUrl = request.nextUrl.origin;
                const aiPayload = {
                    mode: 'monthly',
                    data: {
                        scores: {
                            energy: { avg: avgEnergy, change: changeEnergy },
                            stress: { avg: avgStress, change: changeStress },
                            health: { avg: avgHealth, change: changeHealth },
                            focus: { avg: avgFocus, change: changeFocus },
                            hrvScore: { avg: avgScore, change: changeScore }
                        },
                        hrv: {
                            avgRMSSD: avgRMSSD,
                            monthlyCV: Number(monthlyCV.toFixed(1))
                        },
                        weeklyData: days.filter(d => d.hasData).map(d => ({
                            label: d.label,
                            score: d.score,
                            energy: d.energy,
                            stress: d.stress,
                            health: d.health,
                            focus: d.focus,
                            rmssd: d.rmssd,
                            restingHR: d.restingHR
                        })),
                        monthLabel: targetDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
                        sessionCount: monthSessions.length
                    }
                };



                const aiResponse = await fetch(`${baseUrl}/api/ai-insight`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiPayload)
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();


                    const obsCheck = aiData.observation || aiData.insight;
                    const actionCheck = aiData.action || aiData.actionableInsight;

                    if (obsCheck && actionCheck) {
                        insightObservation = obsCheck;
                        insightAction = actionCheck;
                        insightTitle = aiData.title || obsCheck.split('.')[0].substring(0, 50) || 'Monthly Analysis';

                        // Save to DB
                        try {
                            await pb.collection('monthly_insights').create({
                                user_id: userId,
                                month_start: monthStartForQuery,
                                insight_title: insightTitle,
                                insight_observation: insightObservation,
                                insight_action: insightAction,
                                viewed: true
                            });
                        } catch (saveError: any) {
                            if (saveError.message?.includes('UNIQUE constraint')) {
                                console.log('[Monthly API] Entry exists, attempting update instead');
                                try {
                                    const existing = await pb.collection('monthly_insights').getList(1, 1, {
                                        filter: `user_id = "${userId}" && month_start = "${monthStartForQuery}"`
                                    });
                                    if (existing.items.length > 0) {
                                        await pb.collection('monthly_insights').update(existing.items[0].id, {
                                            insight_title: insightTitle,
                                            insight_observation: insightObservation,

                                            insight_action: insightAction,
                                            viewed: true
                                        });
                                    }
                                } catch (updateError) {
                                    console.warn('[Monthly API] Failed to update insight:', updateError);
                                }
                            } else {
                                console.warn('[Monthly API] Failed to save insight to DB:', saveError.message);
                            }
                        }
                    }
                } else {
                    console.warn('[Monthly API] AI Insight API failed, using fallback');
                }
            } catch (aiError) {
                console.error('[Monthly API] Error calling AI Insight API:', aiError);
            }
        }

        return NextResponse.json({
            weeks: days, // Keep 'weeks' key for backward compatibility
            stats: {
                monthlyCV: Number(monthlyCV.toFixed(1)),
                sessionCount: monthSessions.length,
                avgRMSSD,
                avgRestingHR,
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
                insightTitle,
                insightObservation,
                insightAction
            }
        });

    } catch (error) {
        console.error('Monthly API Error:', error);
        return NextResponse.json({
            weeks: [], // Keep 'weeks' key for backward compatibility
            stats: {
                monthlyCV: 0,
                sessionCount: 0,
                avgRMSSD: 0,
                avgRestingHR: 0,
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
                insightTitle: 'Data Processing...',
                insightObservation: 'Gathering sufficient biometric data.',
                insightAction: 'Continue tracking your sessions.'
            },
            error: 'Could not load monthly data'
        });
    }
}

// Helpers
function calculateAverage(sessions: any[], key: string): number | null {
    const valid = sessions.filter(s => s[key] !== null && s[key] !== undefined);
    if (valid.length === 0) return null;
    return valid.reduce((acc, s) => acc + s[key], 0) / valid.length;
}

function calculateAverageNormalizedHF(sessions: any[]): number | null {
    const valid = sessions.filter(s => s.hf_power_ms2 && s.lf_power_ms2);
    if (valid.length === 0) return null;

    return valid.reduce((acc, s) => {
        const total = s.hf_power_ms2 + s.lf_power_ms2;
        if (total === 0) return acc;
        return acc + ((s.hf_power_ms2 / total) * 100);
    }, 0) / valid.length;
}

function calculateAverageScore(sessions: any[]): number | null {
    const valid = sessions.filter(s =>
        (s.hrv_score !== null && s.hrv_score !== undefined) ||
        (s.readiness_score !== null && s.readiness_score !== undefined)
    );
    if (valid.length === 0) return null;

    return valid.reduce((acc, s) => {
        const val = s.hrv_score ?? s.readiness_score;
        return acc + val;
    }, 0) / valid.length;
}
