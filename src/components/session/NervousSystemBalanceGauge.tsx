import React from 'react';

interface NervousSystemBalanceGaugeProps {
  lfPower: number | null | undefined;
  hfPower: number | null | undefined;
  lfhfRatio: number | null | undefined;
}

const NervousSystemBalanceGauge: React.FC<NervousSystemBalanceGaugeProps> = ({ 
  lfPower, 
  hfPower, 
  lfhfRatio 
}) => {
  // Calculate balance percentages
  const totalPower = (lfPower || 0) + (hfPower || 0);
  const parasympatheticPercent = totalPower > 0 ? ((hfPower || 0) / totalPower) * 100 : 50;
  const sympatheticPercent = totalPower > 0 ? ((lfPower || 0) / totalPower) * 100 : 50;
  
  // Determine balance status
  let colorClass = 'text-gray-400';
  let bgColorClass = 'bg-gray-200';
  let borderGradient = 'from-slate-200 to-slate-200';
  let label = 'N/A';
  let description = 'Data not available';
  let balanceScore = 0;
  let interpretation = '';

  if (lfPower !== null && hfPower !== null && lfPower !== undefined && hfPower !== undefined) {
    // Calculate balance score (0-100, where higher = more parasympathetic)
    balanceScore = Math.min(100, Math.max(0, parasympatheticPercent));
    
    if (parasympatheticPercent > 60) {
      colorClass = 'text-green-500';
      bgColorClass = 'bg-green-500';
      borderGradient = 'from-emerald-300 to-green-400';
      label = 'Parasympathetic Dominant';
      description = 'Excellent autonomic balance - well-rested state.';
      interpretation = 'Your nervous system shows strong parasympathetic activity, indicating excellent recovery and relaxation. This suggests you are well-rested and your body is in an optimal state for healing and restoration.';
    } else if (parasympatheticPercent > 45) {
      colorClass = 'text-blue-500';
      bgColorClass = 'bg-blue-500';
      borderGradient = 'from-blue-300 to-blue-400';
      label = 'Balanced';
      description = 'Good autonomic balance between systems.';
      interpretation = 'Your nervous system shows a healthy balance between sympathetic and parasympathetic activity. This indicates good adaptability and resilience, suggesting you can handle stress well while maintaining recovery capacity.';
    } else if (parasympatheticPercent > 30) {
      colorClass = 'text-yellow-500';
      bgColorClass = 'bg-yellow-500';
      borderGradient = 'from-amber-200 to-yellow-300';
      label = 'Sympathetic Leaning';
      description = 'Moderate stress - consider relaxation techniques.';
      interpretation = 'Your nervous system shows elevated sympathetic activity, indicating moderate stress levels. Consider incorporating relaxation techniques like deep breathing, meditation, or gentle movement to help restore balance.';
    } else {
      colorClass = 'text-red-500';
      bgColorClass = 'bg-red-500';
      borderGradient = 'from-rose-400 to-red-500';
      label = 'Sympathetic Dominant';
      description = 'High stress - prioritize rest and recovery.';
      interpretation = 'Your nervous system shows high sympathetic dominance, indicating significant stress or overstimulation. Prioritize rest, recovery activities, and stress management techniques. Consider reducing external stressors and increasing relaxation time.';
    }
  }

  const rotation = (balanceScore / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className={`p-[1px] bg-gradient-to-br ${borderGradient} rounded-2xl hover:shadow-lg transition-shadow duration-300`}>
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col items-center justify-between h-full">
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Nervous System Balance</h3>
          <p className="text-sm text-slate-500 mb-4">{description}</p>
        </div>
        
        {/* Balance Visualization */}
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
              stroke={lfPower === null || hfPower === null ? '#e5e7eb' : `url(#balanceGradient)`}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={`${(balanceScore / 100) * 251.2}, 251.2`}
              className="transition-all duration-700 ease-in-out"
            />
            <defs>
              <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
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

        {/* Balance Breakdown */}
        <div className="w-full space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Parasympathetic (HF)</span>
            <span className={`font-semibold ${colorClass}`}>
              {parasympatheticPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Sympathetic (LF)</span>
            <span className={`font-semibold ${colorClass}`}>
              {sympatheticPercent.toFixed(1)}%
            </span>
          </div>
          {lfhfRatio !== null && lfhfRatio !== undefined && (
            <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200">
              <span className="text-slate-600">LF/HF Ratio</span>
              <span className="font-mono text-slate-700">
                {Math.exp(lfhfRatio).toFixed(2)}
              </span>
            </div>
          )}
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

export default NervousSystemBalanceGauge;

