import React from 'react';
import {
  getSignalColor,
  getSignalIcon,
  getTrendIcon,
  getMetricSignal,
  getTrend,
} from '@/utils/sessionSummaryUtils';
import { formatRmssdDelta } from '@/utils/sessionSummaryFormat';

interface MetricCardProps {
  icon?: React.ReactNode;
  title: string;
  value: number | null | undefined;
  unit?: string;
  darkMode?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, unit, darkMode = false }) => {
  const displayValue =
    value !== null && value !== undefined
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
      className={`p-0.5 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}
    >
      <div className={`rounded-[15px] p-5 h-full relative group ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-[#737b87]'}`}>{title}</h3>
          </div>
          {actualTrend && getTrendIcon(actualTrend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold ${darkMode ? 'text-gray-100' : 'text-slate-700'}`}>
            {displayValue}
          </span>
          {unit && (
            <span className={`text-base font-medium ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricCard;








