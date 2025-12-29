// Frequency Domain HRV Calculations

export const calculateFrequencyDomain = (rrIntervals: number[]): {
    lfPower: number | null;
    hfPower: number | null;
    lfhfRatio: number | null;
    totalPower: number | null;
} => {
    if (rrIntervals.length < 16) {
        return {
            lfPower: null,
            hfPower: null,
            lfhfRatio: null,
            totalPower: null
        };
    }

    try {
        // Resample RR intervals to uniform time series at 4 Hz
        // This creates an evenly sampled signal for FFT analysis
        const samplingRate = 4; // 4 Hz sampling rate (standard for HRV analysis)
        const samplingInterval = 1 / samplingRate; // 0.25 seconds between samples
        
        // Calculate event times from RR intervals
        const eventTimes: number[] = [0];
        for (let i = 0; i < rrIntervals.length; i++) {
            eventTimes.push(eventTimes[eventTimes.length - 1] + rrIntervals[i] / 1000);
        }
        
        // Calculate total duration and create uniform time grid
        const totalDuration = eventTimes[eventTimes.length - 1];
        const numSamples = Math.floor(totalDuration * samplingRate);
        const timeSeries: number[] = [];
        
        // Interpolate RR intervals onto uniform time grid
        // IMPORTANT: Convert RR intervals from milliseconds to seconds for FFT analysis
        // This ensures the FFT produces power in s² units, which can then be correctly
        // scaled to ms² by multiplying by 1,000,000 (1000²) in the final step
        let rrIndex = 0;
        for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
            const targetTime = sampleIdx * samplingInterval;
            
            // Move forward to find the correct RR interval for this time point
            while (rrIndex < eventTimes.length - 1 && eventTimes[rrIndex + 1] <= targetTime) {
                rrIndex++;
            }
            
            // Use the RR interval that applies at this time point
            // Convert from milliseconds to seconds for FFT analysis
            if (rrIndex < rrIntervals.length) {
                timeSeries.push(rrIntervals[rrIndex] / 1000);
            } else if (rrIntervals.length > 0) {
                // Pad with last RR interval if beyond available data
                timeSeries.push(rrIntervals[rrIntervals.length - 1] / 1000);
            }
        }

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

        // Calculate frequency resolution (frequency bin width)
        // Δf = samplingRate / windowSize (Hz)
        const frequencyResolution = samplingRate / windowSize;
        
        const frequencies: number[] = [];
        const powerSpectrum: number[] = [];
        
        for (let i = 0; i <= windowSize / 2; i++) {
            frequencies.push((i * samplingRate) / windowSize);
            powerSpectrum.push(0);
        }

        // Welch's method: process each window with proper normalization
        for (let w = 0; w < numWindows; w++) {
            const start = w * (windowSize - overlap);
            const window = timeSeries.slice(start, start + windowSize);
            
            // CRITICAL FIX 1: Remove mean (detrend) to eliminate DC leakage
            const windowMean = window.reduce((sum, val) => sum + val, 0) / window.length;
            const detrendedWindow = window.map(val => val - windowMean);
            
            // CRITICAL FIX 2: Apply Hanning window with proper normalization
            // For Welch's method, we need to account for window energy
            let windowEnergy = 0;
            const windowed = detrendedWindow.map((value, i) => {
                const hanningCoeff = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)));
                windowEnergy += hanningCoeff * hanningCoeff;
                return value * hanningCoeff;
            });
            
            // Calculate normalization factor for Welch's method
            // Standard Welch PSD formula: PSD = |FFT|² / (fs * sum(w²))
            // Where fs = sampling frequency, sum(w²) = window energy
            const windowNorm = samplingRate * windowEnergy;
            
            // Compute FFT for this window
            for (let i = 0; i <= windowSize / 2; i++) {
                let real = 0;
                let imag = 0;
                
                for (let j = 0; j < windowSize; j++) {
                    const angle = -2 * Math.PI * i * j / windowSize;
                    real += windowed[j] * Math.cos(angle);
                    imag += windowed[j] * Math.sin(angle);
                }
                
                // Power spectral density (PSD) for this bin
                // Normalize by window normalization factor
                const power = (real * real + imag * imag) / windowNorm;
                powerSpectrum[i] += power;
            }
        }

        // Average across all windows (Welch's method)
        for (let i = 0; i < powerSpectrum.length; i++) {
            powerSpectrum[i] /= numWindows;
        }

        const lfStart = 0.04;
        const lfEnd = 0.15;
        const hfStart = 0.15;
        const hfEnd = 0.4;
        const vlfStart = 0.0033;
        const vlfEnd = 0.04;

        // CRITICAL FIX 3: Integrate PSD by multiplying by frequency bin width (Δf)
        // Band power = Σ PSD(bin) × Δf
        // CRITICAL FIX 4: Ignore DC bin (bin 0, i=0) to avoid DC leakage
        let lfPower = 0;
        let hfPower = 0;
        let vlfPower = 0;

        for (let i = 1; i < frequencies.length; i++) { // Start from i=1 to skip DC (bin 0)
            const freq = frequencies[i];
            const psd = powerSpectrum[i];
            
            // Integrate PSD: multiply by frequency bin width
            const bandPower = psd * frequencyResolution;
            
            if (freq >= vlfStart && freq < vlfEnd) {
                vlfPower += bandPower;
            } else if (freq >= lfStart && freq < lfEnd) {
                lfPower += bandPower;
            } else if (freq >= hfStart && freq <= hfEnd) {
                hfPower += bandPower;
            }
        }

        // Scale power from s² to ms² units
        // Since we converted RR intervals to seconds before FFT, the power is in s² units
        // Multiply by 1,000,000 (1000²) to convert to ms²
        const powerScale = 1000 * 1000;
        lfPower *= powerScale;
        hfPower *= powerScale;
        vlfPower *= powerScale;
        const totalPower = lfPower + hfPower + vlfPower;

        let lfhfRatio: number | null = null;
        if (hfPower > 0) {
            // LF/HF ratio should be the direct ratio (LF/HF), not log-transformed
            // Log transformation can be applied later if needed (e.g., in normalizeLFHF)
            lfhfRatio = lfPower / hfPower;
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

