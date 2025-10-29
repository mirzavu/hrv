import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface HRVScoreGaugeProps {
  score: number | null | undefined;
  baselineEstablished?: boolean;
}

const HRVScoreGauge: React.FC<HRVScoreGaugeProps> = ({ score, baselineEstablished = true }) => {
  const [showPopover, setShowPopover] = useState(false);
  
  const normalizedScore = Math.max(0, Math.min(score ?? 0, 100));
  const rotation = (normalizedScore / 100) * 180 - 90; // -90 to 90 degrees

  // Check if we're in "Waiting For Baseline" state
  const waitingForBaseline = !baselineEstablished && score !== null;

  let colorClass = 'text-gray-400';
  let bgColorClass = 'bg-gray-200';
  let borderColor = '#e2e8f0';
  let label = 'N/A';
  let description = 'Data not available';
  let interpretation = '';

  // Special handling for "Waiting For Baseline" state
  if (waitingForBaseline) {
    // Use the same color scheme as the score would normally have
    // but add the info icon indicator
    if (score > 70) {
      colorClass = 'text-green-500';
      bgColorClass = 'bg-green-500';
      borderColor = '#86efac';
      label = 'Excellent';
      description = 'Strong cardiovascular health and autonomic function.';
      interpretation = 'This score is calculated using general population ranges. As you record more sessions, your personal baseline will be established for more individualized insights.';
    } else if (score > 50) {
      colorClass = 'text-blue-500';
      bgColorClass = 'bg-blue-500';
      borderColor = '#bedbff';
      label = 'Good';
      description = 'Healthy autonomic nervous system function.';
      interpretation = 'This score is calculated using general population ranges. As you record more sessions, your personal baseline will be established for more individualized insights.';
    } else if (score > 30) {
      colorClass = 'text-yellow-500';
      bgColorClass = 'bg-yellow-500';
      borderColor = '#fde047';
      label = 'Moderate';
      description = 'Some stress or fatigue detected.';
      interpretation = 'This score is calculated using general population ranges. As you record more sessions, your personal baseline will be established for more individualized insights.';
    } else {
      colorClass = 'text-red-500';
      bgColorClass = 'bg-red-500';
      borderColor = '#fca5a5';
      label = 'Low';
      description = 'High stress or fatigue levels.';
      interpretation = 'This score is calculated using general population ranges. As you record more sessions, your personal baseline will be established for more individualized insights.';
    }
  } else if (score !== null && score !== undefined) {
    // Normal scoring (when baseline is established or not required)
    if (score > 70) {
      colorClass = 'text-green-500';
      bgColorClass = 'bg-green-500';
      borderColor = '#86efac';
      label = 'Excellent';
      description = 'Strong cardiovascular health and autonomic function.';
      interpretation = 'Excellent HRV indicating strong cardiovascular health and autonomic function. Your heart rate variability shows optimal adaptability and resilience, suggesting excellent recovery capacity and stress management.';
    } else if (score > 50) {
      colorClass = 'text-blue-500';
      bgColorClass = 'bg-blue-500';
      borderColor = '#bedbff';
      label = 'Good';
      description = 'Healthy autonomic nervous system function.';
      interpretation = 'Good HRV suggesting healthy autonomic nervous system function. Your cardiovascular system shows good adaptability to stress and recovery, indicating balanced autonomic regulation.';
    } else if (score > 30) {
      colorClass = 'text-yellow-500';
      bgColorClass = 'bg-yellow-500';
      borderColor = '#fde047';
      label = 'Moderate';
      description = 'Some stress or fatigue detected.';
      interpretation = 'Moderate HRV indicating some stress or fatigue. Consider prioritizing rest, recovery, and stress management techniques to improve your autonomic function and overall well-being.';
    } else {
      colorClass = 'text-red-500';
      bgColorClass = 'bg-red-500';
      borderColor = '#fca5a5';
      label = 'Low';
      description = 'High stress or fatigue levels.';
      interpretation = 'Low HRV suggesting high stress or fatigue. Focus on adequate sleep, relaxation, and reducing external stressors to improve your autonomic nervous system function and recovery.';
    }
  }

  return (
    <div className="p-0.5 rounded-2xl" style={{ backgroundColor: borderColor }}>
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col items-center justify-between h-full">
        <div className="w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-slate-700">HRV Score</h3>
            {waitingForBaseline && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowPopover(true)}
                  onMouseLeave={() => setShowPopover(false)}
                  onClick={() => setShowPopover(!showPopover)}
                  className="text-blue-400 hover:text-blue-500 transition-colors"
                  aria-label="Baseline information"
                >
                  <Info size={18} />
                </button>
                {showPopover && (
                  <div className="absolute z-50 w-72 p-4 bg-white border border-blue-200 rounded-lg shadow-xl -left-32 top-8">
                    <div className="text-left space-y-2">
                      <p className="text-sm font-semibold text-blue-600">Building Your Personal Baseline</p>
                      <p className="text-xs text-slate-600">
                        You're currently using a generic HRV scoring method. To get personalized scores based on <strong>your</strong> unique physiology:
                      </p>
                      <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                        <li>Record <strong>7+ sessions</strong></li>
                        <li>Spread across <strong>5+ different days</strong></li>
                        <li>Use consistent conditions (e.g., same time daily)</li>
                      </ul>
                      <p className="text-xs text-slate-600 pt-2">
                        Once established, your scores will reflect deviations from <em>your</em> personal average, providing more meaningful insights.
                      </p>
                    </div>
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-blue-200"></div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-4">{description}</p>
        </div>
        
        {/* Score Visualization */}
        <div className="relative w-48 h-24 mb-4">
          <svg className="w-full h-full" viewBox="0 0 200 100">
            {/* Background Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Foreground Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={score === null ? '#e5e7eb' : `url(#hrvGradient)`}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(normalizedScore / 100) * 251.2}, 251.2`}
              className="transition-all duration-700 ease-in-out"
            />
            <defs>
              <linearGradient id="hrvGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="30%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="70%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: 'bottom center',
              transition: 'transform 0.7s ease-in-out',
              height: '48px',
              width: '2px',
            }}
          >
            <div className={`${bgColorClass} w-full h-full rounded-t-full`}></div>
          </div>
          <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-gray-300"></div>
        </div>

        {/* Score Display */}
        <div className="w-full space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Overall Score</span>
            <span className={`font-semibold ${colorClass}`}>
              {score !== null && score !== undefined ? score.toFixed(1) : '--'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Scale</span>
            <span className="text-slate-700">0-100</span>
          </div>
        </div>

        {/* Interpretation */}
        <div className="w-full">
          <p className={`font-semibold text-sm ${colorClass} mb-2`}>{label}</p>
          <p className="text-xs text-slate-600 leading-relaxed">{interpretation}</p>
        </div>
      </div>
    </div>
  );
};

export default HRVScoreGauge;

