import React, { useMemo } from 'react';
import { SessionSummary, UserBaseline } from '@/types';
import WellnessMetricCard from './WellnessMetricCard';
import { getWellnessMetricConfig } from '@/utils/wellnessLogic';
import { calculateHrvReadinessScore } from '@/utils/baselineCalculations';

interface WellnessScoreGridProps {
    summary: SessionSummary;
    baseline: UserBaseline | null;
}

const WellnessScoreGrid: React.FC<WellnessScoreGridProps> = ({ summary, baseline }) => {
    const scores = useMemo(() => {
        // Calculate Readiness Score on the fly
        const readinessScore = calculateHrvReadinessScore({
            rmssd: summary.sessionRMSSD.value ?? null,
            sdnn: summary.sdnn?.value ?? null,
            meanHR: summary.meanHR.value ?? null,
        }, baseline);

        const configs = [
            getWellnessMetricConfig('hrvScore', summary.hrvScore.value ?? 0),
            getWellnessMetricConfig('energyScore', summary.energyScore.value ?? 0),
            getWellnessMetricConfig('stressScore', summary.stressScore.value ?? 0),
            getWellnessMetricConfig('healthScore', summary.healthScore.value ?? 0),
            getWellnessMetricConfig('focusScore', summary.focusScore.value ?? 0),
            getWellnessMetricConfig('hrvReadiness', readinessScore ?? 0, baseline?.established ?? false),
        ];

        // Map trends if available (future improvement: pass previous session data)
        // For now, trends are optional/undefined as per current SessionSummary structure

        return configs;
    }, [summary, baseline]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {scores.map((config) => (
                <WellnessMetricCard
                    key={config.label}
                    label={config.label}
                    status={config.status}
                    score={config.score}
                    color={config.color}
                    className="h-full"
                />
            ))}
        </div>
    );
};

export default WellnessScoreGrid;
