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
        let rrIndex = 0;
        for (let sampleIdx = 0; sampleIdx < numSamples; sampleIdx++) {
            const targetTime = sampleIdx * samplingInterval;
            
            // Move forward to find the correct RR interval for this time point
            while (rrIndex < eventTimes.length - 1 && eventTimes[rrIndex + 1] <= targetTime) {
                rrIndex++;
            }
            
            // Use the RR interval that applies at this time point
            if (rrIndex < rrIntervals.length) {
                timeSeries.push(rrIntervals[rrIndex]);
            } else if (rrIntervals.length > 0) {
                // Pad with last RR interval if beyond available data
                timeSeries.push(rrIntervals[rrIntervals.length - 1]);
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

        const frequencies: number[] = [];
        const powerSpectrum: number[] = [];
        
        for (let i = 0; i <= windowSize / 2; i++) {
            frequencies.push((i * samplingRate) / windowSize);
            powerSpectrum.push(0);
        }

        for (let w = 0; w < numWindows; w++) {
            const start = w * (windowSize - overlap);
            const window = timeSeries.slice(start, start + windowSize);
            
            const windowed = window.map((value, i) => 
                value * 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
            );
            
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

        for (let i = 0; i < powerSpectrum.length; i++) {
            powerSpectrum[i] /= numWindows;
        }

        const lfStart = 0.04;
        const lfEnd = 0.15;
        const hfStart = 0.15;
        const hfEnd = 0.4;
        const vlfStart = 0.0033;
        const vlfEnd = 0.04;

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

        const powerScale = 1000 * 1000;
        lfPower *= powerScale;
        hfPower *= powerScale;
        vlfPower *= powerScale;
        const totalPower = lfPower + hfPower + vlfPower;

        let lfhfRatio: number | null = null;
        if (hfPower > 0) {
            const ratio = lfPower / hfPower;
            lfhfRatio = Math.log(ratio);
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

