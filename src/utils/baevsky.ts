// Baevsky Stress Index Calculations

export const calculateBaevskyMetrics = (rrIntervals: number[]): {
    mo: number | null;
    amo: number | null;
    mxdmn: number | null;
    bsi: number | null;
} => {
    if (rrIntervals.length < 10) {
        return { mo: null, amo: null, mxdmn: null, bsi: null };
    }

    try {
        const binWidth = 50;
        const roundedRR = rrIntervals.map(rr => Math.round(rr / binWidth) * binWidth);
        
        const histogram = new Map<number, number>();
        roundedRR.forEach(rr => {
            histogram.set(rr, (histogram.get(rr) || 0) + 1);
        });

        let maxCount = 0;
        let mode = null;
        histogram.forEach((count, rr) => {
            if (count > maxCount) {
                maxCount = count;
                mode = rr;
            }
        });

        if (!mode || maxCount === 0) {
            return { mo: null, amo: null, mxdmn: null, bsi: null };
        }

        const amo = (maxCount / rrIntervals.length) * 100;

        const rrMin = Math.min(...rrIntervals);
        const rrMax = Math.max(...rrIntervals);
        const mxdmn = rrMax - rrMin;

        let bsi: number | null = null;
        if (mode > 0 && mxdmn > 0) {
            bsi = amo / (2 * mode * mxdmn);
        }

        return {
            mo: mode,
            amo: Number(amo.toFixed(2)),
            mxdmn: Number(mxdmn.toFixed(2)),
            bsi: bsi !== null ? Number(bsi.toFixed(6)) : null
        };

    } catch (error) {
        console.error('Error calculating Baevsky metrics:', error);
        return { mo: null, amo: null, mxdmn: null, bsi: null };
    }
};

