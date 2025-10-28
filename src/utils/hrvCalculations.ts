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

