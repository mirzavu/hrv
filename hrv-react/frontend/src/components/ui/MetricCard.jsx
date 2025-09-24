import React from 'react';

const MetricCard = ({ title, value, unit, darkMode }) => (
  <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
    <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{title}</h3>
    <p className="text-2xl md:text-3xl font-bold">
      {typeof value === 'number' ? value.toFixed(2) : 'N/A'}
    </p>
    {unit && <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>}
  </div>
);

export default MetricCard;
