// --- HRV Calculation Functions ---

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

export const calculateMode = (rr: number[]): number | null => {
    if (rr.length === 0) return null;
    const rounded = rr.map(val => Math.round(val));
    const counts = rounded.reduce((acc: Record<number, number>, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
    const modeVal = Object.keys(counts).reduce((a, b) => counts[parseInt(a)] > counts[parseInt(b)] ? a : b, '');
    return modeVal ? parseInt(modeVal) : null;
};

export const calculateAMo50 = (rr: number[], mode: number | null): number | null => {
    if (rr.length === 0 || mode === null) return null;
    const count = rr.filter(val => Math.abs(val - mode) <= 25).length;
    return (count / rr.length) * 100;
};

export const calculateCV = (sdnn: number | null, meanRR: number | null): number | null => 
    (sdnn === null || meanRR === null || meanRR === 0) ? null : (sdnn / meanRR) * 100;

export const calculateMxDMn = (rr: number[]): number | null => 
    (rr.length < 2) ? null : Math.max(...rr) - Math.min(...rr);

export const calculateVariance = (values: number[]): number | null => {
    if (values.length < 2) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / (values.length - 1);
};
