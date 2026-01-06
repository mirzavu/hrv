import React from 'react';
import { TrendingUp, TrendingDown, Lock } from 'lucide-react';
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
    calibrationProgress?: number; // 0-100 for locked cards
    darkMode?: boolean;
}

const WellnessMetricCard: React.FC<WellnessMetricCardProps> = ({
    label,
    status,
    score,
    trend,
    color,
    className = '',
    styleMode = 'ring',
    comparison,
    calibrationProgress,
    darkMode = false
}) => {
    // Check if this is a locked state (No Baseline for Readiness)
    const isLocked = status === 'No Baseline';

    return (
        <div className={`border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col group ${className} ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>

            {/* Main Content Row */}
            <div className="flex items-center justify-between flex-1">
                {/* Left: Text Info */}
                <div className="flex flex-col h-full justify-between py-2">
                    <div>
                        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-slate-900'}`}>
                            {label}
                        </h3>
                        {comparison && comparison.direction !== 'stable' && !isLocked && (
                            <div className="mt-1">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center ${comparison.direction === 'up' ? (darkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
                                    comparison.direction === 'down' ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-600') :
                                        (darkMode ? 'bg-emerald-900/30 text-emerald-500/80' : 'bg-emerald-50/50 text-emerald-600/70')
                                    }`}>
                                    {comparison.direction === 'up' && <TrendingUp size={10} className="mr-1" />}
                                    {comparison.direction === 'down' && <TrendingDown size={10} className="mr-1" />}
                                    {comparison.percentChange.toFixed(0)}%
                                </span>
                            </div>
                        )}
                        {comparison && comparison.direction === 'stable' && !isLocked && (
                            <div className="mt-1">
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded inline-flex items-center bg-emerald-50/50 text-emerald-600/70">
                                    <span className="mr-1">=</span>
                                    {comparison.percentChange.toFixed(0)}%
                                </span>
                            </div>
                        )}
                        {/* Hide status text for locked cards */}
                        {!isLocked && (
                            <div className="mt-1">
                                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                    {status}
                                </span>
                            </div>
                        )}
                    </div>
                    {isLocked ? (
                        <div className="mt-4">
                            <p className={`text-[11px] leading-tight max-w-[140px] ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                Available once personalized baseline is achieved.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4">
                            <TrendIndicator trend={trend} />
                        </div>
                    )}
                </div>

                {/* Right: The Visual */}
                <div className="flex-shrink-0 ml-4">
                    {isLocked ? (
                        /* Locked State - Animated Lock */
                        <div className="relative flex items-center justify-center" style={{ width: '96px', height: '96px' }}>
                            {/* Outer static ring */}
                            <div className={`absolute inset-0 rounded-full border-4 ${darkMode ? 'border-gray-700' : 'border-slate-100'}`} />

                            {/* Background glow that reacts to hover */}
                            <div className={`absolute inset-[8px] rounded-full transition-colors duration-300 ${darkMode ? 'bg-gray-800 group-hover:bg-gray-700' : 'bg-slate-50 group-hover:bg-slate-100/80'}`} />

                            {/* Lock Icon Wrapper - with shake animation */}
                            <div className="relative z-10 flex items-center justify-center">
                                <div className="shake-wrapper">
                                    <Lock
                                        size={36}
                                        className={`transition-colors duration-300 ${darkMode ? 'text-gray-600 group-hover:text-gray-400' : 'text-slate-300 group-hover:text-slate-500'}`}
                                        strokeWidth={2.5}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        styleMode === 'ring' && <ResonanceRing
                            score={score}
                            color={color}
                            darkMode={darkMode}
                        />
                    )}
                    {/* Placeholder for other modes if implemented later */}
                </div>
            </div>

            {/* Bottom Progress Bar for Locked Cards */}
            {isLocked && calibrationProgress !== undefined && (
                <div className={`w-full h-1.5 rounded-full mt-4 overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-slate-100'}`}>
                    <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(calibrationProgress, 5)}%` }}
                    />
                </div>
            )}

            {/* Shake Animation Styles - always render to avoid DOM manipulation errors */}
            <style>{`
                .shake-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    will-change: transform;
                }

                .group:hover .shake-wrapper {
                    animation: fancy-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }

                @keyframes fancy-shake {
                    0% { transform: translateX(0); }
                    15% { transform: translateX(-6px) rotate(-10deg); }
                    30% { transform: translateX(5px) rotate(8deg); }
                    45% { transform: translateX(-4px) rotate(-5deg); }
                    60% { transform: translateX(3px) rotate(3deg); }
                    75% { transform: translateX(-1px) rotate(-1deg); }
                    100% { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default WellnessMetricCard;
