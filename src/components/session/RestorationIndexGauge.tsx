import React from 'react';

interface RestorationIndexGaugeProps {
  score: number | null;
}

const RestorationIndexGauge: React.FC<RestorationIndexGaugeProps> = ({ score }) => {
  const normalizedScore = Math.max(0, Math.min(score ?? 0, 100));
  const rotation = (normalizedScore / 100) * 180 - 90; // -90 to 90 degrees

  let colorClass = 'text-gray-400';
  let bgColorClass = 'bg-gray-200';
  let borderGradient = 'from-slate-200 to-slate-200';
  let label = 'N/A';
  let description = 'Data not available';

  if (score !== null) {
    if (score < 30) {
      colorClass = 'text-red-500';
      bgColorClass = 'bg-red-500';
      borderGradient = 'from-rose-400 to-red-500';
      label = 'Poor';
      description = 'Prioritize rest and recovery activities today.';
    } else if (score < 70) {
      colorClass = 'text-yellow-500';
      bgColorClass = 'bg-yellow-500';
      borderGradient = 'from-amber-200 to-yellow-300';
      label = 'Good';
      description = 'You are showing adequate recovery.';
    } else {
      colorClass = 'text-green-500';
      bgColorClass = 'bg-green-500';
      borderGradient = 'from-emerald-300 to-green-400';
      label = 'Excellent';
      description = 'Your body is well-rested and ready to perform.';
    }
  }

  return (
    <div className={`p-[1px] bg-gradient-to-br ${borderGradient} rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300`}>
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col items-center justify-between h-full">
      <div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Restoration Index</h3>
        <p className="text-sm text-slate-500 mb-4">{description}</p>
      </div>
      <div className="relative w-48 h-24 mb-2">
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
            stroke={score === null ? '#e5e7eb' : `url(#gaugeGradient)`}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${(normalizedScore / 100) * 251.2}, 251.2`}
            className="transition-all duration-700 ease-in-out"
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
        </svg>
        {/* Needle and Central Info */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'bottom center',
            transition: 'transform 0.7s ease-in-out',
            height: '48px', // Corrected height: half of the container's h-24 (96px)
            width: '2px',
          }}
        >
          <div className={`${bgColorClass} w-full h-full rounded-t-full`}></div>
        </div>
        <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-gray-300"></div>
      </div>
      <div className="mt-2">
        <span className={`text-4xl font-bold ${colorClass}`}>
          {score !== null ? score.toFixed(1) : '--'}
        </span>
        <span className="text-lg text-slate-500">/100</span>
        <p className={`font-semibold mt-1 ${colorClass}`}>{label}</p>
      </div>
      </div>
    </div>
  );
};

export default RestorationIndexGauge;