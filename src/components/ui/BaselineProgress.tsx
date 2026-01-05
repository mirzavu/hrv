import React from 'react';

interface BaselineProgressProps {
    currentDay: number;
    totalDays: number;
}

export const BaselineProgress: React.FC<BaselineProgressProps> = ({ currentDay, totalDays }) => {
    const percentage = Math.min((currentDay / totalDays) * 100, 100);
    const isComplete = currentDay >= totalDays;

    return (
        <div className="bg-slate-50 rounded-xl p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Baseline Progress</span>
                <span className="text-xs font-bold text-slate-700">
                    {isComplete ? 'Complete!' : `Day ${currentDay}/${totalDays}`}
                </span>
            </div>
            <div className="relative w-full h-2 bg-slate-200/70 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
                <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${isComplete
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                            : 'bg-gradient-to-r from-teal-400 to-cyan-500'
                        }`}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                />
            </div>
            {!isComplete && (
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                    {totalDays - currentDay} more sessions to unlock full insights
                </p>
            )}
        </div>
    );
};
