import React from 'react';
import { AlertCircle, CheckCircle2, Info, TrendingUp, Minus } from 'lucide-react';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';

interface AutonomicInterpretationProps {
  interpretation: InterpretationResult | null;
  isLoading?: boolean;
}

const AutonomicInterpretation: React.FC<AutonomicInterpretationProps> = ({
  interpretation,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!interpretation) {
    return (
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Baseline Not Established</h3>
            <p className="text-sm text-blue-700">
              We need at least 7 sessions over 5+ days to establish your personal baseline. 
              Once established, you'll receive personalized interpretations and recommendations 
              based on your unique HRV patterns.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine icon and color based on pattern ID
  const getStateStyle = (patternId: number) => {
    // Optimal/Recovered states (green)
    if ([1, 2, 4, 11, 15, 20].includes(patternId)) {
      return {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    }
    // Warning/Fatigue states (yellow/orange)
    if ([3, 6, 13, 18].includes(patternId)) {
      return {
        icon: AlertCircle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      };
    }
    // Stressed/Depleted states (red)
    if ([7, 8, 9, 10, 16].includes(patternId)) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      };
    }
    // Neutral/Baseline states (blue)
    return {
      icon: Info,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    };
  };

  const stateStyle = getStateStyle(interpretation.patternId);
  const StateIcon = stateStyle.icon;

  return (
    <div className={`rounded-xl p-6 border ${stateStyle.borderColor} ${stateStyle.bgColor} shadow-sm`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <StateIcon className={`w-6 h-6 ${stateStyle.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {interpretation.physiologicalState}
          </h3>
          <p className="text-sm text-slate-600">
            Pattern #{interpretation.patternId}
          </p>
        </div>
      </div>

      {/* Core Interpretation */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Core Interpretation</h4>
        <p className="text-sm text-slate-600 leading-relaxed">
          {interpretation.coreInterpretation}
        </p>
      </div>

      {/* Relative Interpretation */}
      {interpretation.relativeInterpretation && (
        <div className="mb-4 p-3 bg-white/60 rounded-lg border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            Relative to Your Baseline
          </h4>
          <p className="text-sm text-slate-600">
            {interpretation.relativeInterpretation}
          </p>
        </div>
      )}

      {/* Absolute Interpretation */}
      {interpretation.absoluteInterpretation && (
        <div className="mb-4 p-3 bg-white/60 rounded-lg border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            Population Reference
          </h4>
          <p className="text-sm text-slate-600">
            {interpretation.absoluteInterpretation}
          </p>
        </div>
      )}

      {/* Technical Changes */}
      {interpretation.technicalChanges.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Technical Changes</h4>
          <ul className="space-y-1">
            {interpretation.technicalChanges.map((change, index) => (
              <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                <Minus className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Action */}
      <div className="pt-4 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Recommended Action</h4>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          {interpretation.recommendedAction}
        </p>
        
        {/* Combined Advice */}
        <div className="mt-3 p-3 bg-white/80 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-700 leading-relaxed">
            {interpretation.combinedAdvice}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AutonomicInterpretation;

