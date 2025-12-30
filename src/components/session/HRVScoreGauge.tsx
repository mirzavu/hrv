import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { interpretReadinessScore } from '@/utils/baselineCalculations';

interface HRVScoreGaugeProps {
  score: number | null | undefined;
  baselineEstablished?: boolean;
}

const HRVScoreGauge: React.FC<HRVScoreGaugeProps> = ({ score, baselineEstablished = true }) => {
  const [showPopover, setShowPopover] = useState(false);

  const normalizedScore = Math.max(0, Math.min(score ?? 0, 100));

  // Check if we're in "Waiting For Baseline" state
  const waitingForBaseline = !baselineEstablished && score !== null;

  // Determine color based on score ranges (Z-score based mapping)
  // Z > 1.5 (Score > 80) => Dark Green
  // Z > -0.25 (Score > 45) => Medium Green
  // Z > -1.25 (Score > 25) => Light Green
  // Z < -1.25 (Score < 25) => Grey

  let scoreColorDetails = { text: 'text-slate-500', border: 'border-slate-400', bg: 'bg-slate-50' };

  if (normalizedScore >= 80) {
    scoreColorDetails = { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-50' };
  } else if (normalizedScore >= 45) {
    scoreColorDetails = { text: 'text-emerald-500', border: 'border-emerald-400', bg: 'bg-emerald-50' };
  } else if (normalizedScore >= 25) {
    scoreColorDetails = { text: 'text-emerald-400', border: 'border-emerald-300', bg: 'bg-emerald-50' };
  } else {
    scoreColorDetails = { text: 'text-gray-400', border: 'border-gray-300', bg: 'bg-gray-50' };
  }

  // Get interpretation - use personalized if baseline established, otherwise use generic
  let label = 'N/A';
  let interpretation = '';

  if (score === null || score === undefined) {
    label = 'N/A';
    interpretation = 'Data not available';
  } else if (baselineEstablished) {
    // Use personalized interpretations from baselineCalculations
    const interpretationData = interpretReadinessScore(score);
    label = interpretationData.status.charAt(0).toUpperCase() + interpretationData.status.slice(1).replace('-', ' ');
    interpretation = interpretationData.message;
  } else {
    // Fallback interpretations for users without baseline
    if (score >= 70) {
      label = 'Excellent';
      interpretation = 'Continue tracking to establish your personal baseline for more individualized insights.';
    } else if (score >= 55) {
      label = 'Good';
      interpretation = 'Continue tracking to establish your personal baseline for more individualized insights.';
    } else if (score >= 45) {
      label = 'Average';
      interpretation = 'Continue tracking to establish your personal baseline for more individualized insights.';
    } else if (score >= 30) {
      label = 'Needs Improvement';
      interpretation = 'Continue tracking to establish your personal baseline for more individualized insights.';
    } else {
      label = 'Needs Improvement';
      interpretation = 'Continue tracking to establish your personal baseline for more individualized insights.';
    }
  }

  return (
    <div className="p-0.5 rounded-2xl bg-slate-200 h-full flex flex-col">
      <div className="bg-white rounded-[15px] p-6 text-center flex flex-col h-full">
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-semibold text-slate-700">HRV Score</h3>

          </div>
        </div>

        {/* Horizontal Bar Segmented Visualization */}
        <div className="w-full max-w-lg flex flex-col items-center mb-4 mx-auto">
          {/* Marker Container */}
          <div className="relative w-full h-12">
            {score !== null && score !== undefined && (
              <div
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${normalizedScore}%`, transform: 'translateX(-50%)', transition: 'left 0.7s ease-out' }}
              >
                {/* Pill part of the marker */}
                <div className={`px-3 py-1 ${scoreColorDetails.bg} ${scoreColorDetails.border} border-2 rounded-full text-sm font-bold ${scoreColorDetails.text} shadow-md z-10`}>
                  {Math.round(normalizedScore)}
                </div>
                {/* Connecting line */}
                <div className="w-px h-3 bg-gray-300" />
              </div>
            )}
          </div>

          {/* Segments container - no labels, just colors */}
          <div className="w-full flex h-8 rounded-full overflow-hidden shadow-inner bg-gray-100">
            <div className="w-[40%] bg-yellow-200/70"></div>
            <div className="w-[10%] bg-sky-200/70"></div>
            <div className="w-[50%] bg-emerald-200/70"></div>
          </div>
        </div>

        {/* Score Display and Interpretation */}
        <div className="w-full space-y-2 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Overall Score</span>
            <span className={`font-semibold ${scoreColorDetails.text}`}>
              {score !== null && score !== undefined ? score.toFixed(1) : '--'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Scale</span>
            <span className="text-slate-700">0-100</span>
          </div>
          <div className="text-sm pt-2 border-t border-slate-200">
            <p className={`font-semibold text-center ${scoreColorDetails.text}`}>{label}</p>
          </div>
        </div>

        {/* Interpretation Text */}
        <div className="w-full mt-auto">
          <p className="text-xs text-slate-600 leading-relaxed">{interpretation}</p>
        </div>
      </div>
    </div>
  );
};

export default HRVScoreGauge;

