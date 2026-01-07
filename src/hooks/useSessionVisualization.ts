import { useMemo } from 'react';
import { SessionSummary } from '@/types';

export const useSessionVisualization = (summary: SessionSummary) => {

    // 1. Heart Rate Data (Time vs BPM)
    const heartRateData = useMemo(() => {
        const intervals = summary.rrIntervals ?? [];
        const valid = intervals.filter(
            (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
        );
        if (!valid.length) return [];

        const startTimestamp = typeof valid[0].timestamp === 'number' ? valid[0].timestamp : null;
        let elapsedSeconds = 0;
        let lastRR = valid[0].value ?? 0;

        return valid
            .map((interval, index) => {
                const rr = interval.value ?? lastRR;
                if (!rr || rr <= 0) return null;

                if (startTimestamp !== null && typeof interval.timestamp === 'number') {
                    elapsedSeconds = (interval.timestamp - startTimestamp) / 1000;
                } else if (index === 0) {
                    elapsedSeconds = 0;
                } else {
                    elapsedSeconds += rr / 1000;
                }

                lastRR = rr;

                return {
                    time: Number(elapsedSeconds.toFixed(1)),
                    bpm: Number((60000 / rr).toFixed(1)),
                    rr,
                };
            })
            .filter((point): point is { time: number; bpm: number; rr: number } =>
                Boolean(point) && Number.isFinite(point?.bpm) && Number.isFinite(point?.rr)
            );
    }, [summary.rrIntervals]);

    // 2. Poincaré Plot Data (RRn vs RRn+1)
    const poincareData = useMemo(() => {
        const intervals = summary.rrIntervals ?? [];
        const valid = intervals.filter(
            (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
        );
        if (valid.length < 2) return [];

        const points = [];
        for (let i = 0; i < valid.length - 1; i++) {
            const rrn = valid[i].value ?? 0;
            const rrn1 = valid[i + 1].value ?? 0;

            if (rrn > 0 && rrn1 > 0) {
                points.push({
                    rrn: Number(rrn.toFixed(1)),
                    rrn1: Number(rrn1.toFixed(1)),
                });
            }
        }
        return points;
    }, [summary.rrIntervals]);

    // 3. Tachogram Data (Beat # vs RR)
    const tachogramData = useMemo(() => {
        const intervals = summary.rrIntervals ?? [];
        const valid = intervals.filter(
            (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
        );
        if (!valid.length) return [];

        const startTimestamp = typeof valid[0].timestamp === 'number' ? valid[0].timestamp : null;
        let elapsedSeconds = 0;

        return valid.map((interval, index) => {
            const rr = interval.value ?? 0;

            if (startTimestamp !== null && typeof interval.timestamp === 'number') {
                elapsedSeconds = (interval.timestamp - startTimestamp) / 1000;
            } else if (index === 0) {
                elapsedSeconds = 0;
            } else {
                elapsedSeconds += rr / 1000;
            }

            return {
                beatNumber: index + 1,
                time: Number(elapsedSeconds.toFixed(1)),
                rrInterval: Number(rr.toFixed(1)),
            };
        });
    }, [summary.rrIntervals]);

    // 4. Session Recency Check (For Progress Bar)
    const isRecentSession = useMemo(() => {
        if (!summary.rrIntervals || summary.rrIntervals.length === 0) return true;

        // Check timestamp (1600000000000 is approx year 2020)
        const lastInterval = summary.rrIntervals[summary.rrIntervals.length - 1];
        if (lastInterval.timestamp > 1600000000000) {
            const diff = Date.now() - lastInterval.timestamp;
            // Show only if session ended within the last 5 minutes
            return diff < 1000 * 60 * 5;
        }
        return true;
    }, [summary.rrIntervals, summary.session_id]);

    // 5. Session Date Object
    const sessionDate = useMemo(() => {
        if (summary.rrIntervals?.[0]?.timestamp && summary.rrIntervals[0].timestamp > 1600000000000) {
            return new Date(summary.rrIntervals?.[0].timestamp);
        }
        return new Date();
    }, [summary.rrIntervals]);

    const stabilizationTime = typeof summary.timeToStabilize?.value === 'number'
        ? summary.timeToStabilize.value
        : null;

    return {
        heartRateData,
        poincareData,
        tachogramData,
        isRecentSession,
        sessionDate,
        stabilizationTime
    };
};
