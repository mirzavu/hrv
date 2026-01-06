import React from 'react';

interface BaselineProgressProps {
    currentDay: number;
    totalDays: number;
    darkMode?: boolean;
}

export const BaselineProgress: React.FC<BaselineProgressProps> = ({ currentDay, totalDays, darkMode = false }) => {
    const percentage = Math.min((currentDay / totalDays) * 100, 100);
    const isComplete = currentDay >= totalDays;

    return (
        <div className={`rounded-xl p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] ${darkMode ? 'bg-gray-700' : 'bg-slate-50'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>Baseline Progress</span>
                <span className={`text-xs font-bold ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                    {isComplete ? 'Complete!' : `Day ${currentDay}/${totalDays}`}
                </span>
            </div>
            <div className={`relative w-full h-2 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] ${darkMode ? 'bg-gray-600' : 'bg-slate-200/70'}`}>
                <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${isComplete
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : 'bg-gradient-to-r from-teal-400 to-cyan-500'
                        }`}
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                />
            </div>
            {!isComplete && (
                <p className={`text-[10px] mt-1.5 font-medium ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    {totalDays - currentDay} more sessions to unlock full insights
                </p>
            )}
        </div>
    );
};
