// Time-domain HRV calculations

export const calculateRMSSD = (rr: number[]): number | null => 
    (rr.length < 2) ? null : Math.sqrt(rr.slice(1).reduce((acc, val, i) => acc + Math.pow(val - rr[i], 2), 0) / (rr.length - 1));

export const calculateSDNN = (rr: number[]): number | null => {
    if (rr.length < 2) return null;
    const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
    return Math.sqrt(rr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / rr.length);
};

export const calculatePNN50 = (rr: number[]): number | null => 
    (rr.length < 2) ? null : (rr.slice(1).filter((val, i) => Math.abs(val - rr[i]) > 50).length / (rr.length - 1)) * 100;

export const calculateMeanHR = (rr: number[]): number | null => 
    (rr.length === 0) ? null : 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length);

export const calculateMxDMn = (rr: number[]): number | null => 
    (rr.length < 2) ? null : Math.max(...rr) - Math.min(...rr);

export const calculateAMoMetrics = (rrSeries: number[]) => {
    if (rrSeries.length === 0) {
        return { amode50: null, AMo50Count: null };
    }

    const binWidth = 50;
    const counts = new Map<number, number>();

    rrSeries.forEach((rr) => {
        const bin = Math.floor(rr / binWidth) * binWidth;
        counts.set(bin, (counts.get(bin) ?? 0) + 1);
    });

    let maxCount = 0;
    counts.forEach((count) => {
        if (count > maxCount) {
            maxCount = count;
        }
    });

    if (maxCount === 0) {
        return { amode50: null, AMo50Count: null };
    }

    return {
        amode50: (maxCount / rrSeries.length) * 100,
        AMo50Count: maxCount,
    };
};

/**
 * Calculate HRV Triangular Index (HTI)
 * A geometric measure based on the density distribution of NN intervals
 * HTI = Total number of NN intervals / Height of the histogram of all NN intervals
 * For short-term recordings, we approximate using binning similar to AMo calculation
 */
export const calculateHTI = (rrSeries: number[]): number | null => {
    if (rrSeries.length === 0) {
        return null;
    }

    try {
        // Use a smaller bin width (7.8125ms) for HTI as recommended for short-term recordings
        const binWidth = 7.8125;
        const counts = new Map<number, number>();

        rrSeries.forEach((rr) => {
            const bin = Math.floor(rr / binWidth) * binWidth;
            counts.set(bin, (counts.get(bin) ?? 0) + 1);
        });

        // Find the maximum height (most frequent bin)
        let maxCount = 0;
        counts.forEach((count) => {
            if (count > maxCount) {
                maxCount = count;
            }
        });

        if (maxCount === 0) {
            return null;
        }

        // HTI = Total number of NN intervals / Height of histogram
        const hti = rrSeries.length / maxCount;
        return Number(hti.toFixed(2));

    } catch (error) {
        console.error('Error calculating HTI:', error);
        return null;
    }
};

