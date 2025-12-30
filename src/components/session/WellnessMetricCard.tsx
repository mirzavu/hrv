import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
    comparison?: {
        percentChange: number;
        direction: 'up' | 'down' | 'stable';
    };
}

const WellnessMetricCard: React.FC<WellnessMetricCardProps> = ({
    label,
    status,
    score,
    trend,
    color,
    className = '',
    styleMode = 'ring',
    comparison
}) => {
    return (
        <div className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex items-center justify-between group ${className}`}>

            {/* Left: Text Info */}
            <div className="flex flex-col h-full justify-between py-2">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {label}
                    </h3>
                    {comparison && comparison.direction !== 'stable' && (
                        <div className="mt-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center ${
                                comparison.direction === 'up' ? 'bg-emerald-50 text-emerald-600' :
                                comparison.direction === 'down' ? 'bg-slate-100 text-slate-600' :
                                'bg-emerald-50/50 text-emerald-600/70'
                            }`}>
                                {comparison.direction === 'up' && <TrendingUp size={10} className="mr-1" />}
                                {comparison.direction === 'down' && <TrendingDown size={10} className="mr-1" />}
                                {comparison.percentChange.toFixed(0)}%
                            </span>
                        </div>
                    )}
                    {comparison && comparison.direction === 'stable' && (
                        <div className="mt-1">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center bg-emerald-50/50 text-emerald-600/70">
                                <span className="mr-1">=</span>
                                {comparison.percentChange.toFixed(0)}%
                            </span>
                        </div>
                    )}
                    <div className="mt-1">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {status}
                        </span>
                    </div>
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
