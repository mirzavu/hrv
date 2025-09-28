import React from 'react';
import {
  getSignalGradient,
  getSignalIcon,
  getTrendIcon,
  getMetricSignal,
  getTrend,
} from '@/utils/sessionSummaryUtils';
import { formatRmssdDelta } from '@/utils/sessionSummaryFormat';

interface MetricCardProps {
  icon?: React.ReactNode;
  title: string;
  value: number | null;
  unit?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, unit }) => {
  const displayValue =
    value !== null
      ? title === 'RMSSD Change'
        ? formatRmssdDelta(value).value
        : title === 'Beats'
        ? Math.round(value).toString()
        : value.toFixed(1)
      : 'N/A';

  const actualSignal = getMetricSignal(title, value);
  const actualTrend = getTrend(title, value);

  return (
    <div
      className={`p-[1px] bg-gradient-to-br ${getSignalGradient(
        actualSignal?.type || 'info'
      )} rounded-2xl hover:shadow-lg transition-shadow duration-300`}
    >
      <div className="bg-white rounded-[15px] p-5 h-full relative group">
        {actualSignal && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 min-w-[220px] max-w-[280px] px-4 py-3 bg-[#0f172a] text-white text-sm rounded-xl border border-white/10 shadow-2xl backdrop-blur-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-20 mb-3">
            <div className="flex items-start gap-2.5">
              {getSignalIcon(actualSignal.type)}
              <div>
                <span className="font-semibold text-sm capitalize tracking-wide text-white/90">
                  {actualSignal.type}
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">
                  {actualSignal.message}
                </p>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0f172a] border border-white/10 border-t-transparent border-l-transparent rotate-45 -mt-1.5"></div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-medium text-[#737b87]">{title}</h3>
          </div>
          {actualTrend && getTrendIcon(actualTrend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-700">
            {displayValue}
          </span>
          {unit && (
            <span className="text-base font-medium text-slate-500">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricCard;