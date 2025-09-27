import React from 'react';

interface MetricCardProps {
  title: string;
  value: number | string | null;
  unit?: string;
  precision?: number;
  darkMode: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, precision = 2, darkMode }) => {
  const displayTitle = unit ? `${title} (${unit})` : title;
  let formattedValue: string;

  if (typeof value === 'number') {
    formattedValue = value.toFixed(precision);
  } else if (typeof value === 'string') {
    formattedValue = value;
  } else {
    formattedValue = '—';
  }

  return (
    <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
      <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{displayTitle}</h3>
      <p className="text-2xl md:text-3xl font-bold">{formattedValue}</p>
    </div>
  );
};

export default MetricCard;
