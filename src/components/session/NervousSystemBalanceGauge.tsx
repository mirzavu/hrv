import React from 'react';
import { Scale } from 'lucide-react';

interface NervousSystemBalanceGaugeProps {
  // Use SD2/SD1-based percentages
  parasympatheticPercent?: number | null | undefined;
  sympatheticPercent?: number | null | undefined;
  sd2_sd1_ratio?: number | null | undefined;
  comparison?: {
    percentChange: number;
    direction: 'up' | 'down' | 'stable';
  };
  darkMode?: boolean;
}

const NervousSystemBalanceGauge: React.FC<NervousSystemBalanceGaugeProps> = ({
  parasympatheticPercent: propParasympatheticPercent,
  sympatheticPercent: propSympatheticPercent,
  sd2_sd1_ratio,
  comparison,
  darkMode = false
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
    <div className={`rounded-[15px] p-6 flex flex-col h-full shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="mb-4 flex items-center gap-2">
        <Scale size={18} className={darkMode ? 'text-gray-400' : 'text-slate-400'} />
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>Nervous System Balance</h3>
      </div>

      {/* Horizontal Bar Segmented Visualization */}
      <div className="w-full flex flex-col items-center mb-4 mx-auto">
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

        {/* Segments container - thicker bar */}
        <div className="w-full flex h-12 rounded-full overflow-hidden shadow-inner bg-gray-100">
          <div className="w-[50%] bg-yellow-200/70 flex items-center justify-center text-sm font-bold text-yellow-700/80">Sympathetic</div>
          <div className="w-[50%] bg-emerald-200/70 flex items-center justify-center text-sm font-bold text-emerald-700/80">Parasympathetic</div>
        </div>

        {/* Labels below the bar */}
        <div className="w-full flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
          <span>Fight / Flight</span>
          <span>Rest / Digest</span>
        </div>
      </div>
    </div>
  );
};

export default NervousSystemBalanceGauge;

