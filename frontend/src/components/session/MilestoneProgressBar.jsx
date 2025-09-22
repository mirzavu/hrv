import React, { useMemo } from 'react';

const SESSION_MILESTONES = [
  { label: 'Quick Check', value: 120 },
  { label: 'Standard', value: 300 },
  { label: 'Deep Insight', value: 600 },
  { label: 'Full Analysis', value: 900 },
];

const MilestoneProgressBar = ({ elapsedTime, darkMode }) => {
    const displayMilestones = useMemo(() => [{ label: 'Start', value: 0 }, ...SESSION_MILESTONES], []);
    const totalDuration = SESSION_MILESTONES[SESSION_MILESTONES.length - 1].value;

    return (
        <div className="mt-4 pt-4 flex flex-col items-center">
            <div className="w-full px-2">
                <div className="relative h-2.5 w-full">
                    {/* Background track */}
                    <div className={`absolute top-1/2 -translate-y-1/2 h-1 w-full rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                    {/* Progress fill */}
                    <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-600" style={{ width: `${(elapsedTime / totalDuration) * 100}%`, transition: 'width 1s linear' }}></div>
                    
                    {/* Milestone points and labels container */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between">
                        {displayMilestones.map((milestone, index) => {
                            const isReached = elapsedTime >= milestone.value;
                            return (
                                <div key={milestone.label} className="relative flex flex-col items-center">
                                    {/* Circle */}
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${isReached ? 'bg-green-500' : (darkMode ? 'bg-gray-500' : 'bg-gray-300')}`}>
                                        {isReached && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>
                                    {/* Label */}
                                    <span className={`absolute top-6 text-xs whitespace-nowrap ${darkMode ? 'text-gray-400' : 'text-gray-600'}
                                        ${index === 0 ? 'left-0' : ''}
                                        ${index === displayMilestones.length - 1 ? 'right-0' : ''}
                                        ${index > 0 && index < displayMilestones.length - 1 ? 'left-1/2 -translate-x-1/2' : ''}
                                    `}>
                                        {milestone.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <p className="text-center text-sm mt-8 font-mono">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / {totalDuration / 60}:00</p>
        </div>
    );
};

export default MilestoneProgressBar;
