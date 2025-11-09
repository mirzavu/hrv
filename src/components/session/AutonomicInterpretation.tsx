import React from 'react';
import { AutonomicInterpretation as InterpretationType } from '@/utils/autonomicInterpretation';
import { Info, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';

interface AutonomicInterpretationProps {
  interpretation: InterpretationType | null;
}

const AutonomicInterpretation: React.FC<AutonomicInterpretationProps> = ({ interpretation }) => {
  if (!interpretation) {
    return null;
  }

  // Determine color scheme based on pattern
  const getStateColor = (state: string): string => {
    const lowerState = state.toLowerCase();
    if (lowerState.includes('optimal') || lowerState.includes('ready') || lowerState.includes('recovered')) {
      return 'text-green-600 bg-green-50 border-green-200';
    } else if (lowerState.includes('stressed') || lowerState.includes('strained') || lowerState.includes('depleted') || lowerState.includes('fatigue')) {
      return 'text-red-600 bg-red-50 border-red-200';
    } else if (lowerState.includes('warning') || lowerState.includes('accumulation')) {
      return 'text-orange-600 bg-orange-50 border-orange-200';
    } else if (lowerState.includes('baseline') || lowerState.includes('homeostasis') || lowerState.includes('adaptive')) {
      return 'text-blue-600 bg-blue-50 border-blue-200';
    }
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  const getDirectionIcon = (direction: '↑' | '↓' | '≈') => {
    switch (direction) {
      case '↑':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case '↓':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case '≈':
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const stateColor = getStateColor(interpretation.physiologicalState);

  return (
    <div className="space-y-6">
      {/* Physiological State Card */}
      <div className={`rounded-xl border-2 p-6 ${stateColor}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {interpretation.patternId === 0 ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <CheckCircle className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">
              {interpretation.physiologicalState}
            </h3>
            <p className="text-sm leading-relaxed opacity-90">
              {interpretation.coreInterpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Technical Changes */}
      {interpretation.technicalChanges.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-slate-500" />
            Technical Changes
          </h4>
          <div className="space-y-3">
            {interpretation.technicalChanges.map((change, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  {getDirectionIcon(change.direction)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{change.metric}</span>: {change.technicalDescription}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Population Reference (if available) */}
      {interpretation.relativeToPopulation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Population Reference:</span> {interpretation.relativeToPopulation}
          </p>
        </div>
      )}

      {/* Recommended Action */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <h4 className="text-base font-semibold text-slate-800">
            Recommended Action
          </h4>
        </div>
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {interpretation.recommendedAction}
        </div>
      </div>

      {/* Baseline Status */}
      {!interpretation.relativeToBaseline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Note:</span> Personalized interpretations require an established baseline. Complete 7-14 consistent resting sessions to enable relative comparisons.
          </p>
        </div>
      )}
    </div>
  );
};

export default AutonomicInterpretation;

