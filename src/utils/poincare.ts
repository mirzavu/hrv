// Poincaré Plot Calculations

export const calculatePoincareMetrics = (rrIntervals: number[]): {
    sd1: number | null;
    sd2: number | null;
} => {
    if (rrIntervals.length < 3) {
        return { sd1: null, sd2: null };
    }

    try {
        const rrn = rrIntervals.slice(0, -1);
        const rrn1 = rrIntervals.slice(1);

        const differences = rrn1.map((rr1, i) => rr1 - rrn[i]);
        const sums = rrn1.map((rr1, i) => rr1 + rrn[i]);

        const sd1Variance = differences.reduce((acc, diff) => acc + diff * diff, 0) / (differences.length - 1);
        const sd1 = Math.sqrt(sd1Variance / 2);

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

