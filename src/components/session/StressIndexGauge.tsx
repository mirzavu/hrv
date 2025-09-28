import React from 'react';

interface StressIndexGaugeProps {
  score: number | null;
}

const StressIndexGauge: React.FC<StressIndexGaugeProps> = ({ score }) => {
  // Baevsky Stress Index can go above 100, so we clamp it at a reasonable max for UI, e.g., 500.
  const maxStress = 500;
  const normalizedScore = Math.max(0, Math.min(score ?? 0, maxStress));
  const rotation = (normalizedScore / maxStress) * 180 - 90; // -90 to 90 degrees

  let colorClass = 'text-gray-400';
  let bgColorClass = 'bg-gray-200';
  let borderGradient = 'from-slate-200 to-slate-200';
  let label = 'N/A';
  let description = 'Data not available';

  if (score !== null) {
    if (score < 50) {
      colorClass = 'text-green-500';
      bgColorClass = 'bg-green-500';
      borderGradient = 'from-emerald-300 to-green-400';
      label = 'Low Stress';
      description = 'Excellent autonomic balance and low stress.';
    } else if (score < 150) {
      colorClass = 'text-blue-500';
      bgColorClass = 'bg-blue-500';
      borderGradient = 'from-sky-300 to-blue-400';
      label = 'Normal';
      description = 'Your stress levels are within a normal, healthy range.';
    } else if (score < 300) {
      colorClass = 'text-yellow-500';
      bgColorClass = 'bg-yellow-500';
      borderGradient = 'from-amber-200 to-yellow-300';
      label = 'Elevated';
      description = 'Elevated stress detected. Consider relaxation.';
    } else {
      colorClass = 'text-red-500';
      bgColorClass = 'bg-red-500';
      borderGradient = 'from-rose-400 to-red-500';
      label = 'High Stress';
      description = 'High stress levels detected. Prioritize recovery.';
    }
  }

  return (
    <div className={`p-[1px] bg-gradient-to-br ${borderGradient} rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300`}>
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col items-center justify-between h-full">
      <div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Stress Index</h3>
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
            stroke={score === null ? '#e5e7eb' : `url(#stressGaugeGradient)`}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${(normalizedScore / maxStress) * 251.2}, 251.2`}
            className="transition-all duration-700 ease-in-out"
          />
          <defs>
            <linearGradient id="stressGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="25%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
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
            height: '48px', // Corrected height
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
        <p className={`font-semibold mt-1 ${colorClass}`}>{label}</p>
      </div>
      </div>
    </div>
  );
};

export default StressIndexGauge;