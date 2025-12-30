import { SessionSummary } from '@/types';

export type WellnessMetricType =
    | 'hrvScore'
    | 'energyScore'
    | 'stressScore'
    | 'healthScore'
    | 'focusScore'
    | 'hrvReadiness';

export interface WellnessMetricConfig {
    label: string;
    score: number;
    status: string;
    color: string; // Tailwind class or hex
    description: string;
    trend?: 'up' | 'down' | 'neutral';
}

const COLORS = {
    OPTIMAL: '#15803d', // slightly dark green (emerald-700)
    GOOD: '#22c55e',    // green (emerald-500)
    NORMAL: '#22c55e',  // green (emerald-500) - user asked for "normal/good value will be green"
    LOW: '#94a3b8',     // grey (slate-400)
    WARNING: '#eab308', // yellow
    CRITICAL: '#ef4444', // red
};

export const getWellnessMetricConfig = (
    type: WellnessMetricType,
    value: number,
    baselineEstablished: boolean = false
): WellnessMetricConfig => {
    let status = '';
    let color = COLORS.LOW;
    let description = '';
    const label = getLabel(type);

    switch (type) {
        case 'hrvScore':
            // Good/Optimal (70–100)
            // Normal (40–69)
            // Poor (0–39)
            if (value >= 70) {
                status = 'Optimal';
                color = COLORS.OPTIMAL;
                description = 'High RMSSD and SDNN with lower heart rate.';
            } else if (value >= 40) {
                status = 'Normal';
                color = COLORS.NORMAL;
                description = 'Typical variability and heart rate.';
            } else {
                status = 'Needs Improvement';
                color = COLORS.LOW;
                description = 'Low variability or high heart rate.';
            }
            break;

        case 'energyScore':
            // Good (75–100)
            // Normal (45–74)
            // Low (0–44)
            if (value >= 75) {
                status = 'Good';
                color = COLORS.OPTIMAL; // Using Optimal color for "Good" top tier
                description = 'Physically charged. High RMSSD and SDNN.';
            } else if (value >= 45) {
                status = 'Normal';
                color = COLORS.NORMAL;
                description = 'Adequate energy for daily tasks.';
            } else {
                status = 'Needs Improvement';
                color = COLORS.LOW;
                description = 'Depletion; low parasympathetic recovery.';
            }
            break;

        case 'stressScore':
            // Good/Low Stress (0–35) -> LOWER IS BETTER
            // Normal (36–65)
            // High Stress (66–100)
            // NOTE: The visual "Score" usually implies higher is better for rings, 
            // but the value passed here is 0-100 where 100 is high stress.
            // We might need to invert visual representation or keep it as is but change color mapping.

            // User requirements:
            // Good/Low Stress (0-35)
            // Normal (36-65)
            // High Stress (66-100)

            if (value <= 35) {
                status = 'Low Stress';
                color = COLORS.OPTIMAL; // Good state
                description = 'Parasympathetic dominance. Excellent.';
            } else if (value <= 65) {
                status = 'Normal';
                color = COLORS.NORMAL; // Normal state
                description = 'Typical daily tension.';
            } else {
                status = 'Needs Improvement';
                color = COLORS.LOW; // Using Low color as "Grey" for "bad"? Or should it be Red? 
                // User said: "low value will be grey". 
                // But here "High Stress" is the "bad" state. 
                // The user instructions said: "Optimal/Excellent value will be slightly dark green, normal/good value will be green, low value will be grey."
                // For Stress, "Low Stress" is Excellent. So it should be Dark Green.
                // "High Stress" is likely the "Low Value" equivalent in terms of wellness. So Grey.
                // Let's stick to that mapping.
                description = 'Significant fight-or-flight state.';
            }
            break;

        case 'healthScore':
            // Good (70–100)
            // Normal (40–69)
            // Concern (0–39)
            if (value >= 70) {
                status = 'Good';
                color = COLORS.OPTIMAL;
                description = 'Strong overall resilience.';
            } else if (value >= 40) {
                status = 'Normal';
                color = COLORS.NORMAL;
                description = 'General wellness is stable.';
            } else {
                status = 'Needs Improvement';
                color = COLORS.LOW;
                description = 'Potential long-term fatigue.';
            }
            break;

        case 'focusScore':
            // Good (70–100)
            // Normal (40–69)
            // Low (0–39)
            if (value >= 70) {
                status = 'Good';
                color = COLORS.OPTIMAL;
                description = 'Mentally sharp.';
            } else if (value >= 40) {
                status = 'Normal';
                color = COLORS.NORMAL;
                description = 'Standard cognitive function.';
            } else {
                status = 'Needs Improvement';
                color = COLORS.LOW;
                description = 'Mental fatigue; brain fog.';
            }
            break;

        case 'hrvReadiness':
            // Optimal (75–100)
            // Stable/Good (40–74)
            // Recovery Needed (0–39)
            if (!baselineEstablished) {
                status = 'No Baseline';
                color = COLORS.LOW;
                description = 'Need more sessions to establish baseline.';
            } else if (value >= 75) {
                status = 'Optimal';
                color = COLORS.OPTIMAL;
                description = 'Significantly above 14-day average.';
            } else if (value >= 40) {
                status = 'Stable';
                color = COLORS.NORMAL;
                description = 'Within normal range.';
            } else {
                status = 'Focus on Recovery';
                color = COLORS.LOW;
                description = 'Below baseline. Rest recommended.';
            }
            break;
    }

    return {
        label,
        score: value,
        status,
        color,
        description
    };
};

const getLabel = (type: WellnessMetricType): string => {
    switch (type) {
        case 'hrvScore': return 'HRV Score';
        case 'energyScore': return 'Energy Score';
        case 'stressScore': return 'Stress Score';
        case 'healthScore': return 'Health Score';
        case 'focusScore': return 'Focus Score';
        case 'hrvReadiness': return 'Readiness';
    }
};
