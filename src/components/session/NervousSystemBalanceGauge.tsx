import React from 'react';

interface NervousSystemBalanceGaugeProps {
  // Use SD2/SD1-based percentages
  parasympatheticPercent?: number | null | undefined;
  sympatheticPercent?: number | null | undefined;
  sd2_sd1_ratio?: number | null | undefined;
}

const NervousSystemBalanceGauge: React.FC<NervousSystemBalanceGaugeProps> = ({
  parasympatheticPercent: propParasympatheticPercent,
  sympatheticPercent: propSympatheticPercent,
  sd2_sd1_ratio
}) => {
  // Use SD2/SD1-based percentages - no fallback
  let parasympatheticPercent: number = 50; // Default neutral
  let sympatheticPercent: number = 50; // Default neutral

  if (propParasympatheticPercent !== null && propParasympatheticPercent !== undefined &&
    propSympatheticPercent !== null && propSympatheticPercent !== undefined) {
    parasympatheticPercent = propParasympatheticPercent;
    sympatheticPercent = propSympatheticPercent;
  }

  // Calculate balance score (0-100, where higher = more parasympathetic)
  const balanceScore = Math.min(100, Math.max(0, parasympatheticPercent));

  // Determine color based on score: yellow for sympathetic (lower score), green for parasympathetic (higher score)
  const scoreColorDetails = balanceScore < 50
    ? { text: 'text-yellow-600', border: 'border-yellow-500', bg: 'bg-yellow-50' } // Sympathetic dominant
    : { text: 'text-emerald-600', border: 'border-emerald-500', bg: 'bg-emerald-50' }; // Parasympathetic dominant

  return (
    <div className="p-0.5 rounded-2xl bg-slate-200 h-full flex flex-col">
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col h-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-700">Nervous System Balance</h3>
        </div>

        {/* Horizontal Bar Segmented Visualization */}
        <div className="w-full max-w-lg flex flex-col items-center mb-4 mx-auto">
          {/* Marker Container */}
          <div className="relative w-full h-12">
            <div
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${balanceScore}%`, transform: 'translateX(-50%)', transition: 'left 0.7s ease-out' }}
            >
              {/* Pill part of the marker */}
              <div className={`px-3 py-1 ${scoreColorDetails.bg} ${scoreColorDetails.border} border-2 rounded-full text-sm font-bold ${scoreColorDetails.text} shadow-md z-10`}>
                {Math.round(balanceScore)}
              </div>
              {/* Connecting line */}
              <div className="w-px h-3 bg-gray-300" />
            </div>
          </div>

          {/* Segments container */}
          <div className="w-full flex h-8 rounded-full overflow-hidden shadow-inner bg-gray-100">
            <div className="w-[50%] bg-yellow-200/70 flex items-center justify-center text-xs font-medium text-yellow-700/80">Sympathetic</div>
            <div className="w-[50%] bg-emerald-200/70 flex items-center justify-center text-xs font-medium text-emerald-700/80">Parasympathetic</div>
          </div>
        </div>

        {/* Balance Breakdown */}
        <div className="w-full space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Parasympathetic</span>
            <span className="font-semibold text-emerald-600">
              {parasympatheticPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Sympathetic</span>
            <span className="font-semibold text-yellow-600">
              {sympatheticPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NervousSystemBalanceGauge;

