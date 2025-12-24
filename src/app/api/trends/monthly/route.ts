import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

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

        // 1. Determine Time Range
        let targetDate = new Date();
        if (monthStr) {
            targetDate = new Date(`${monthStr}-01`);
        } else if (dateStr) {
            targetDate = new Date(dateStr);
        }

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-indexed

        // Start and End of the Target Month
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch Data Buffer: Need previous 30 days for rolling predictions/baselines
        const fetchStart = new Date(monthStart);
        fetchStart.setDate(fetchStart.getDate() - 30);

        const startStr = fetchStart.toISOString().split('T')[0] + ' 00:00:00';
        const endStr = monthEnd.toISOString().split('T')[0] + ' 23:59:59';

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

        // 3. Process Weekly Data
        // We will divide the month into standard weeks (Week 1, Week 2...) based on day of month? 
        // Or ISO weeks?
        // Simpler for visualization: 4-5 chunks based on dates (1-7, 8-14, 15-21, 22-end).

        const weeks = [];
        const ranges = [
            { start: 1, end: 7, label: 'Week 1' },
            { start: 8, end: 14, label: 'Week 2' },
            { start: 15, end: 21, label: 'Week 3' },
            { start: 22, end: 31, label: 'Week 4+' } // Handles 28, 30, 31 day months
        ];

        for (const range of ranges) {
            // Range specific to this MONTH
            const rangeStart = new Date(year, month, range.start);
            // Fix end date overflow for shorter months
            let rangeEnd = new Date(year, month, range.end, 23, 59, 59);
            if (rangeEnd.getMonth() !== month) {
                rangeEnd = new Date(year, month + 1, 0, 23, 59, 59); // Clamp to end of month
            }
            if (rangeStart > monthEnd) continue; // Skip if range starts after month ends (shouldn't happen with standard ranges)

            // Filtering sessions for this specific week (for Bar Chart)
            const weeklySessions = sessions.filter(s => {
                const d = new Date(s.session_date);
                return d >= rangeStart && d <= rangeEnd;
            });

            // Weekly Averages
            const rmssdWeeklyParams = calculateAverage(weeklySessions, 'rmssd_session_ms');
            const sdnnWeeklyParams = calculateAverage(weeklySessions, 'sdnn_session_ms');
            const hfnuWeeklyParams = calculateAverageNormalizedHF(weeklySessions);
            const sd2sd1WeeklyParams = calculateAverageRatio(weeklySessions, 'sd2_ms', 'sd1_ms'); // SD2 / SD1
            const scoreWeeklyParams = calculateAverageScore(weeklySessions); // HRV Score

            // 30-Day Rolling Average (Trend Line) at the END of this week
            // Window: (rangeEnd - 30 days) to rangeEnd
            const rollingStart = new Date(rangeEnd);
            rollingStart.setDate(rollingStart.getDate() - 30);

            const rollingSessions = sessions.filter(s => {
                const d = new Date(s.session_date);
                return d >= rollingStart && d <= rangeEnd;
            });

            const rmssdRolling = calculateAverage(rollingSessions, 'rmssd_session_ms');
            const sdnnRolling = calculateAverage(rollingSessions, 'sdnn_session_ms');
            const scoreRolling = calculateAverageScore(rollingSessions);

            weeks.push({
                label: range.label,
                startDate: rangeStart.toISOString().split('T')[0],
                endDate: rangeEnd.toISOString().split('T')[0],
                // Meters
                rmssd: Math.round(rmssdWeeklyParams || 0),
                rmssdRolling: Math.round(rmssdRolling || 0),
                sdnn: Math.round(sdnnWeeklyParams || 0),
                sdnnRolling: Math.round(sdnnRolling || 0),
                hfnu: Math.round(hfnuWeeklyParams || 0),
                stressRatio: Number((sd2sd1WeeklyParams || 0).toFixed(2)),
                score: Math.round(scoreWeeklyParams || 0),
                scoreRolling: Math.round(scoreRolling || 0),
                // Validation (disable bar if no data)
                hasData: weeklySessions.length > 0
            });
        }

        // 4. Monthly Aggregates
        // Filter sessions strictly within the month for overall stats
        const monthSessions = sessions.filter(s => {
            const d = new Date(s.session_date);
            return d >= monthStart && d <= monthEnd;
        });

        // Calculate Monthly CV (Coefficient of Variation of RMSSD)
        const validRmssd = monthSessions.filter(s => s.rmssd_session_ms).map(s => s.rmssd_session_ms);
        let monthlyCV = 0;
        if (validRmssd.length > 1) {
            const mean = validRmssd.reduce((a, b) => a + b, 0) / validRmssd.length;
            const variance = validRmssd.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validRmssd.length;
            const sd = Math.sqrt(variance);
            monthlyCV = mean > 0 ? (sd / mean) * 100 : 0;
        }

        return NextResponse.json({
            weeks,
            stats: {
                monthlyCV: Number(monthlyCV.toFixed(1)),
                sessionCount: monthSessions.length,
                avgRMSSD: Math.round(calculateAverage(monthSessions, 'rmssd_session_ms') || 0)
            }
        });

    } catch (error) {
        console.error('Monthly API Error:', error);
        return NextResponse.json({
            weeks: [],
            stats: { monthlyCV: 0, sessionCount: 0, avgRMSSD: 0 },
            error: 'Could not load monthly data'
        }); // Robust fallback
    }
}

// Helpers
function calculateAverage(sessions: any[], key: string): number | null {
    const valid = sessions.filter(s => s[key] !== null && s[key] !== undefined);
    if (valid.length === 0) return null;
    return valid.reduce((acc, s) => acc + s[key], 0) / valid.length;
}

function calculateAverageRatio(sessions: any[], numKey: string, denKey: string): number | null {
    // Average of ratios? or Ratio of averages?
    // Usually average of daily ratios is safer for "Average Daily State"
    const valid = sessions.filter(s => s[numKey] && s[denKey] && s[denKey] > 0);
    if (valid.length === 0) return null;
    return valid.reduce((acc, s) => acc + (s[numKey] / s[denKey]), 0) / valid.length;
}

function calculateAverageNormalizedHF(sessions: any[]): number | null {
    // HFnu = HF / (LF + HF) * 100
    // DB might store 'hf_power_ms2' and 'lf_power_ms2'
    const valid = sessions.filter(s => s.hf_power_ms2 && s.lf_power_ms2);
    if (valid.length === 0) return null;

    return valid.reduce((acc, s) => {
        const total = s.hf_power_ms2 + s.lf_power_ms2;
        if (total === 0) return acc;
        return acc + ((s.hf_power_ms2 / total) * 100);
    }, 0) / valid.length;
}

function calculateAverageScore(sessions: any[]): number | null {
    // Prefer hrv_score, fallback to readiness_score
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
