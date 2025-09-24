// --- HRV Calculation Functions ---

export const calculateRMSSD = (rr) => (rr.length < 2) ? null : Math.sqrt(rr.slice(1).reduce((acc, val, i) => acc + Math.pow(val - rr[i], 2), 0) / (rr.length - 1));

export const calculateSDNN = (rr) => {
    if (rr.length < 2) return null;
    const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
    return Math.sqrt(rr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / rr.length);
};

export const calculatePNN50 = (rr) => (rr.length < 2) ? null : (rr.slice(1).filter((val, i) => Math.abs(val - rr[i]) > 50).length / (rr.length - 1)) * 100;

export const calculateMeanHR = (rr) => (rr.length === 0) ? null : 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length);

export const calculateMode = (rr) => {
    if (rr.length === 0) return null;
    const rounded = rr.map(val => Math.round(val));
    const counts = rounded.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
    const modeVal = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, null);
    return modeVal ? parseInt(modeVal) : null;
};

export const calculateAMo50 = (rr, mode) => {
    if (rr.length === 0 || mode === null) return null;
    const count = rr.filter(val => Math.abs(val - mode) <= 25).length;
    return (count / rr.length) * 100;
};

export const calculateCV = (sdnn, meanRR) => (sdnn === null || meanRR === null || meanRR === 0) ? null : (sdnn / meanRR) * 100;

export const calculateMxDMn = (rr) => (rr.length < 2) ? null : Math.max(...rr) - Math.min(...rr);
