import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { calculateBaselineMetrics } from '@/utils/baselineCalculations';
import { toLocalDateString, DEFAULT_TIMEZONE, formatDateForPocketBase } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const endDateParam = searchParams.get('endDate');

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
            console.warn('[Weekly API] Could not fetch user timezone, using default');
        }

        // Helper to format date in user's timezone
        const formatLocalDate = (d: Date) => toLocalDateString(d, userTimezone);

        // Determine date range
        // End date: specified or today
        const endDate = endDateParam ? new Date(endDateParam) : new Date();
        // Start date: 13 days before end date (to get 7 days of display + 6 days prior for rolling avg)
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 13);

        // Import day boundary utilities
        const { getLocalDayStartUTC, getLocalDayEndUTC } = await import('@/utils/dateUtils');

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

        // Fetch sessions
        // We need: rmssd, session_mean_hr, session_date
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

        // Fetch last 30 days for baseline calculation (Safe fetch)
        const baselineStartDate = new Date(endDate);
        baselineStartDate.setDate(endDate.getDate() - 30);
        const baselineStartLocalDate = formatLocalDate(baselineStartDate);
        
        // Expand range by ±1 day for boundary safety
        const expandedBaselineStart = new Date(baselineStartDate);
        expandedBaselineStart.setDate(expandedBaselineStart.getDate() - 1);
        const expandedBaselineStartLocal = formatLocalDate(expandedBaselineStart);

        // Convert to UTC boundaries
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

        // Calculate baseline metrics (handle empty input safely)
        let baselineMetrics = {
            rmssd_avg: null as number | null,
            rmssd_stdev: null as number | null,
            hr_avg: null as number | null,
            hr_stdev: null as number | null
        };

        try {
            if (baselineSessions.length > 0) {
                // Cast to SessionSummaryRecord[] and use utility
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
            // proceed with null baselines
        }

        // Process Data for the Weekly View
        // 1. Group by Day
        const dailyMap = new Map<string, { rmssd: number[], hr: number[], score: number[] }>();

        sessions.forEach((s: any) => {
            if (!s.session_date) return;
            // Use user's timezone for date grouping
            const date = toLocalDateString(s.session_date, userTimezone);
            // Filter to only include dates within the requested range (exclude expanded boundary days)
            if (date < startLocalDate || date > endLocalDate) {
                return;
            }
            if (!dailyMap.has(date)) {
                dailyMap.set(date, { rmssd: [], hr: [], score: [] });
            }
            if (s.rmssd_session_ms !== null && s.rmssd_session_ms !== undefined) dailyMap.get(date)!.rmssd.push(s.rmssd_session_ms);
            if (s.session_mean_hr !== null && s.session_mean_hr !== undefined) dailyMap.get(date)!.hr.push(s.session_mean_hr);
            // HRV Score (prefer hrv_score, fallback to readiness_score)
            const scoreVal = s.hrv_score ?? s.readiness_score;
            if (scoreVal !== null && scoreVal !== undefined) dailyMap.get(date)!.score.push(scoreVal);
        });

        // 2. Generate Daily Averages + Rolling Averages
        const displayDays = [];
        // Loop through the last 7 days ending on endDate
        for (let i = 6; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(endDate.getDate() - i);
            const dayStr = formatLocalDate(d);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

            // Daily Value
            const dayData = dailyMap.get(dayStr);
            const rmssdRaw = dayData && dayData.rmssd.length > 0
                ? Math.round(dayData.rmssd.reduce((a, b) => a + b, 0) / dayData.rmssd.length)
                : null;
            const hrRaw = dayData && dayData.hr.length > 0
                ? Math.round(dayData.hr.reduce((a, b) => a + b, 0) / dayData.hr.length)
                : null;
            const scoreRaw = dayData && dayData.score.length > 0
                ? Math.round(dayData.score.reduce((a, b) => a + b, 0) / dayData.score.length)
                : null;

            // 7-Day Rolling Average
            let rmssdSum = 0;
            let rmssdCount = 0;
            let hrSum = 0;
            let hrCount = 0;
            let scoreSum = 0;
            let scoreCount = 0;

            for (let j = 0; j < 7; j++) {
                const lookback = new Date(d);
                lookback.setDate(d.getDate() - j);
                const lbStr = formatLocalDate(lookback);
                const lbData = dailyMap.get(lbStr);

                if (lbData) {
                    if (lbData.rmssd.length > 0) {
                        const val = lbData.rmssd.reduce((a, b) => a + b, 0) / lbData.rmssd.length;
                        rmssdSum += val;
                        rmssdCount++;
                    }
                    if (lbData.hr.length > 0) {
                        const val = lbData.hr.reduce((a, b) => a + b, 0) / lbData.hr.length;
                        hrSum += val;
                        hrCount++;
                    }
                    if (lbData.score.length > 0) {
                        const val = lbData.score.reduce((a, b) => a + b, 0) / lbData.score.length;
                        scoreSum += val;
                        scoreCount++;
                    }
                }
            }

            const rmssdAvg = rmssdCount > 0 ? Math.round(rmssdSum / rmssdCount) : null;
            const hrAvg = hrCount > 0 ? Math.round(hrSum / hrCount) : null;
            const scoreAvg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;

            displayDays.push({
                date: dayStr,
                name: dayName,
                rmssd: rmssdRaw,
                hr: hrRaw,
                score: scoreRaw,
                rmssdAvg: rmssdAvg,
                hrAvg: hrAvg,
                scoreAvg: scoreAvg,
                // Normal Ranges from Baseline (handle nulls safely)
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
        }

        // 3. Calculate Stability (CV)
        const validRmssd = displayDays.map(d => d.rmssd).filter((v): v is number => v !== null && v > 0);
        let weeklyCV = 0;
        if (validRmssd.length > 1) {
            const mean = validRmssd.reduce((a, b) => a + b, 0) / validRmssd.length;
            const squaredDiffs = validRmssd.map(v => Math.pow(v - mean, 2));
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / validRmssd.length;
            const sd = Math.sqrt(variance);
            weeklyCV = mean > 0 ? Number(((sd / mean) * 100).toFixed(1)) : 0;
        }

        // 4. Calculate Readiness / Stats (Safe Access)
        const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
        const readiness = latestSession
            ? (latestSession.readiness_score || latestSession.energy_score || latestSession.hrv_score || 0)
            : 0;

        const avgHR = baselineMetrics.hr_avg || (displayDays.find(d => d.hrAvg !== null)?.hrAvg) || 0;
        const avgHRV = baselineMetrics.rmssd_avg || (displayDays.find(d => d.rmssdAvg !== null)?.rmssdAvg) || 0;

        return NextResponse.json({
            data: displayDays,
            stats: {
                readiness: Math.round(readiness),
                weeklyCV,
                avgHR: Math.round(avgHR),
                avgHRV: Math.round(avgHRV)
            }
        });

    } catch (error) {
        console.error('Weekly trend API error (Fatal):', error);
        // Return a valid empty structure instead of 500 so UI can show "No Data" state
        return NextResponse.json({
            data: [],
            stats: { readiness: 0, weeklyCV: 0, avgHR: 0, avgHRV: 0 },
            error: 'Not enough data available'
        });
    }
}
