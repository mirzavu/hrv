import React from 'react';
import TrendIndicator from './TrendIndicator';
import ResonanceRing from './ResonanceRing';

interface WellnessMetricCardProps {
    label: string;
    status: string;
    score: number;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
    className?: string;
    styleMode?: 'ring' | 'liquid' | 'flower' | 'pillars'; // To future proof, defaulting to ring for now
}

const WellnessMetricCard: React.FC<WellnessMetricCardProps> = ({
    label,
    status,
    score,
    trend,
    color,
    className = '',
    styleMode = 'ring'
}) => {
    return (
        <div className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center justify-between group ${className}`}>

            {/* Left: Text Info */}
            <div className="flex flex-col h-full justify-between py-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {status}
                        </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {label}
                    </h3>
                </div>
                <div className="mt-4">
                    <TrendIndicator trend={trend} />
                </div>
            </div>

            {/* Right: The Visual */}
            <div className="flex-shrink-0 ml-4">
                {styleMode === 'ring' && (
                    <ResonanceRing
                        score={score}
                        color={color}
                    />
                )}
                {/* Placeholder for other modes if implemented later */}
            </div>

        </div>
    );
};

export default WellnessMetricCard;
