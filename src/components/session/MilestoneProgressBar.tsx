import React, { useMemo } from 'react';

const SESSION_MILESTONES = [
  { label: 'Quick Check', value: 120 },
  { label: 'Standard', value: 300 },
  { label: 'Deep Insight', value: 600 },
  { label: 'Full Analysis', value: 900 },
];

interface MilestoneProgressBarProps {
  elapsedTime: number;
  darkMode: boolean;
}

const MilestoneProgressBar: React.FC<MilestoneProgressBarProps> = ({ elapsedTime, darkMode }) => {
  const displayMilestones = useMemo(() => [{ label: 'Start', value: 0 }, ...SESSION_MILESTONES], []);
  const totalDuration = SESSION_MILESTONES[SESSION_MILESTONES.length - 1].value;

  const currentProgressPercent = Math.min((elapsedTime / totalDuration) * 100, 100);

  const computeMilestonePositionStyle = (progress: number) => {
    if (progress <= 0) {
      return { left: '0%', transform: 'translateX(0%)' };
    }

    if (progress >= 100) {
      return { left: '100%', transform: 'translateX(-100%)' };
    }

    return { left: `${progress}%`, transform: 'translateX(-50%)' };
  };

  const getContainerAlignmentClass = (progress: number) => {
    if (progress <= 0) {
      return 'items-start';
    }

    if (progress >= 100) {
      return 'items-end';
    }

    return 'items-center';
  };

  const getLabelAlignmentClass = (progress: number) => {
    if (progress <= 0) {
      return 'text-left';
    }

    if (progress >= 100) {
      return 'text-right';
    }

    return 'text-center';
  };

  return (
    <div className="mt-6 pt-6 pb-8 flex flex-col items-center">
      <div className="w-full px-4">
        <div className="relative h-3 w-full">
          {/* Background track with gradient */}
          <div className={`absolute top-1/2 -translate-y-1/2 h-2 w-full rounded-full ${
            darkMode 
              ? 'bg-gradient-to-r from-gray-800 to-gray-700 shadow-inner' 
              : 'bg-gradient-to-r from-gray-200 to-gray-300 shadow-inner'
          }`}></div>
          
          {/* Progress fill with custom blue gradient */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
            style={{ 
              width: `${Math.min((elapsedTime / totalDuration) * 100, 100)}%`, 
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(to right, #1469a5, #2e93db)'
            }}
          ></div>
          
          {/* Milestone points and labels container */}
          <div className="absolute top-1/2 w-full">
            {displayMilestones.map((milestone) => {
              // Calculate the progress percentage for this milestone
              const milestoneProgress = (milestone.value / totalDuration) * 100;
              const currentProgress = currentProgressPercent;
              
              // Only mark as reached when progress bar has visually reached this point
              const isReached = currentProgress >= milestoneProgress;
              const isActive = currentProgress >= milestoneProgress - 2 && currentProgress < milestoneProgress && !isReached;
              const containerAlignment = getContainerAlignmentClass(milestoneProgress);
              const labelAlignment = getLabelAlignmentClass(milestoneProgress);
              
              return (
                <div
                  key={milestone.label}
                  className="absolute top-1/2"
                  style={computeMilestonePositionStyle(milestoneProgress)}
                >
                  <div className={`relative flex flex-col ${containerAlignment}`}>
                    {/* Circle with custom blue design */}
                    <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-700 transform -translate-y-1/2 ${
                      !isReached && !isActive
                        ? darkMode 
                          ? 'bg-gray-600 hover:bg-gray-500' 
                          : 'bg-gray-400 hover:bg-gray-500'
                        : ''
                    }`}
                    style={{
                      background: isReached 
                        ? 'linear-gradient(to right, #1e40af, #1469a5)' // Darker blue for completed
                        : isActive
                        ? 'linear-gradient(to right, #2e93db, #60a5fa)' // Lighter blue for active
                        : undefined
                    }}
                  >
                    {isReached ? (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-ping' : 'bg-white/60'}`}></div>
                    )}
                    </div>
                    
                    {/* Label positioned below the circle */}
                    <span 
                      className={`mt-0 mb-4 text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                        !isReached && !isActive
                          ? darkMode 
                            ? 'text-gray-400' 
                            : 'text-gray-600'
                          : 'font-semibold'
                      } ${labelAlignment}`}
                      style={{
                        color: isReached 
                          ? '#1469a5' // Custom blue for completed
                          : isActive
                          ? '#2e93db' // Custom blue for active
                          : undefined
                      }}
                    >
                      {milestone.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestoneProgressBar;
