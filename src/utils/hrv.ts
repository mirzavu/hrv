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

// --- Frequency Domain HRV Calculations ---

/**
 * Calculate frequency domain HRV metrics using Welch's method
 * @param rrIntervals - Array of RR intervals in milliseconds
 * @returns Object containing LF power, HF power, LF/HF ratio, and total power
 */
export const calculateFrequencyDomain = (rrIntervals: number[]): {
    lfPower: number | null;
    hfPower: number | null;
    lfhfRatio: number | null;
    totalPower: number | null;
} => {
    if (rrIntervals.length < 16) { // Further reduced for shorter sessions
        return {
            lfPower: null,
            hfPower: null,
            lfhfRatio: null,
            totalPower: null
        };
    }

    try {
        // Convert RR intervals to heart rate time series for frequency analysis
        const heartRates = rrIntervals.map(rr => 60000 / rr); // Convert to BPM
        const samplingRate = 4; // Hz (4 samples per second)
        const duration = heartRates.length / samplingRate;
        
        // Create time series with regular intervals
        const timeSeries: number[] = [];
        const timeStep = 1 / samplingRate; // 0.25 seconds
        
        for (let i = 0; i < heartRates.length; i++) {
            const time = i * timeStep;
            timeSeries.push(heartRates[i]);
        }

        // Apply Welch's method (simplified implementation)
        const windowSize = Math.min(256, Math.floor(timeSeries.length / 4));
        const overlap = Math.floor(windowSize / 2);
        const numWindows = Math.floor((timeSeries.length - overlap) / (windowSize - overlap));
        
        if (numWindows < 2) {
            return {
                lfPower: null,
                hfPower: null,
                lfhfRatio: null,
                totalPower: null
            };
        }

        // Calculate power spectral density
        const frequencies: number[] = [];
        const powerSpectrum: number[] = [];
        
        for (let i = 0; i <= windowSize / 2; i++) {
            frequencies.push((i * samplingRate) / windowSize);
            powerSpectrum.push(0);
        }

        // Apply windowing and FFT (simplified)
        for (let w = 0; w < numWindows; w++) {
            const start = w * (windowSize - overlap);
            const window = timeSeries.slice(start, start + windowSize);
            
            // Apply Hanning window
            const windowed = window.map((value, i) => 
                value * 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
            );
            
            // Calculate periodogram (simplified FFT)
            for (let i = 0; i <= windowSize / 2; i++) {
                let real = 0;
                let imag = 0;
                
                for (let j = 0; j < windowSize; j++) {
                    const angle = -2 * Math.PI * i * j / windowSize;
                    real += windowed[j] * Math.cos(angle);
                    imag += windowed[j] * Math.sin(angle);
                }
                
                const power = (real * real + imag * imag) / windowSize;
                powerSpectrum[i] += power;
            }
        }

        // Average across windows
        for (let i = 0; i < powerSpectrum.length; i++) {
            powerSpectrum[i] /= numWindows;
        }

        // Calculate power in specific frequency bands
        const lfStart = 0.04; // 0.04 Hz
        const lfEnd = 0.15;   // 0.15 Hz
        const hfStart = 0.15; // 0.15 Hz
        const hfEnd = 0.4;    // 0.4 Hz
        const vlfStart = 0.0033; // 0.0033 Hz
        const vlfEnd = 0.04;     // 0.04 Hz

        let lfPower = 0;
        let hfPower = 0;
        let vlfPower = 0;

        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            const power = powerSpectrum[i];
            
            if (freq >= vlfStart && freq < vlfEnd) {
                vlfPower += power;
            } else if (freq >= lfStart && freq < lfEnd) {
                lfPower += power;
            } else if (freq >= hfStart && freq <= hfEnd) {
                hfPower += power;
            }
        }

        // Convert power to ms² (multiply by 1000 to convert from BPM to ms)
        const powerScale = 1000 * 1000; // Convert BPM² to ms²
        lfPower *= powerScale;
        hfPower *= powerScale;
        vlfPower *= powerScale;
        const totalPower = lfPower + hfPower + vlfPower;

        // Calculate LF/HF ratio with log transformation to avoid extremes
        let lfhfRatio: number | null = null;
        if (hfPower > 0) {
            const ratio = lfPower / hfPower;
            lfhfRatio = Math.log(ratio); // Log transformation
        }

        return {
            lfPower: lfPower > 0 ? Number(lfPower.toFixed(2)) : null,
            hfPower: hfPower > 0 ? Number(hfPower.toFixed(2)) : null,
            lfhfRatio: lfhfRatio !== null ? Number(lfhfRatio.toFixed(3)) : null,
            totalPower: totalPower > 0 ? Number(totalPower.toFixed(2)) : null
        };

    } catch (error) {
        console.error('Error calculating frequency domain metrics:', error);
        return {
            lfPower: null,
            hfPower: null,
            lfhfRatio: null,
            totalPower: null
        };
    }
};

// --- Poincaré Plot Calculations ---

/**
 * Calculate SD1 and SD2 from Poincaré plot
 * @param rrIntervals - Array of RR intervals in milliseconds
 * @returns Object containing SD1 and SD2 values
 */
export const calculatePoincareMetrics = (rrIntervals: number[]): {
    sd1: number | null;
    sd2: number | null;
} => {
    if (rrIntervals.length < 3) {
        return { sd1: null, sd2: null };
    }

    try {
        // Create Poincaré plot data (RR(n) vs RR(n+1))
        const rrn = rrIntervals.slice(0, -1);
        const rrn1 = rrIntervals.slice(1);

        // Calculate differences and sums
        const differences = rrn1.map((rr1, i) => rr1 - rrn[i]);
        const sums = rrn1.map((rr1, i) => rr1 + rrn[i]);

        // Calculate SD1 (width of the ellipse) - related to short-term variability
        const sd1Variance = differences.reduce((acc, diff) => acc + diff * diff, 0) / (differences.length - 1);
        const sd1 = Math.sqrt(sd1Variance / 2);

        // Calculate SD2 (length of the ellipse) - related to long-term variability
        const meanSum = sums.reduce((acc, sum) => acc + sum, 0) / sums.length;
        const sd2Variance = sums.reduce((acc, sum) => acc + Math.pow(sum - meanSum, 2), 0) / (sums.length - 1);
        const sd2 = Math.sqrt(sd2Variance / 2);

        return {
            sd1: Number(sd1.toFixed(2)),
            sd2: Number(sd2.toFixed(2))
        };

    } catch (error) {
        console.error('Error calculating Poincaré metrics:', error);
        return { sd1: null, sd2: null };
    }
};

// --- Baevsky Stress Index Calculations ---

/**
 * Calculate full Baevsky Stress Index components
 * @param rrIntervals - Array of RR intervals in milliseconds
 * @returns Object containing Mo, AMo, MxDMn, and full BSI
 */
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
        // Round RR intervals to nearest 50ms for histogram
        const binWidth = 50;
        const roundedRR = rrIntervals.map(rr => Math.round(rr / binWidth) * binWidth);
        
        // Create histogram
        const histogram = new Map<number, number>();
        roundedRR.forEach(rr => {
            histogram.set(rr, (histogram.get(rr) || 0) + 1);
        });

        // Find mode (most frequent RR interval)
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

        // Calculate AMo (amplitude of mode) - percentage of intervals in modal bin
        const amo = (maxCount / rrIntervals.length) * 100;

        // Calculate MxDMn (mode amplitude range) - range of RR intervals
        const rrMin = Math.min(...rrIntervals);
        const rrMax = Math.max(...rrIntervals);
        const mxdmn = rrMax - rrMin;

        // Calculate full Baevsky Stress Index: BSI = AMo / (2 * Mo * MxDMn)
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

// Note: 4-Score calculations moved to server-side API (/api/sessions/analyze/route.ts)
// Client-side calculations removed to ensure consistency and reduce bundle size
