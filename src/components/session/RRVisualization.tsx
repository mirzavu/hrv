import React from 'react';

interface RRInterval {
  timestamp: number;
  value: number;
}

interface RRVisualizationProps {
  rrIntervals: RRInterval[];
  darkMode: boolean;
  className?: string;
}

const RRVisualization: React.FC<RRVisualizationProps> = ({ 
  rrIntervals, 
  darkMode, 
  className = '' 
}) => {
  if (!rrIntervals || rrIntervals.length === 0) {
    return (
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${className}`}>
        <p className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          No RR interval data available for visualization
        </p>
      </div>
    );
  }

  // Prepare data for Poincaré plot (RRn vs RRn+1)
  const poincaréData: { x: number; y: number }[] = [];
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    poincaréData.push({
      x: rrIntervals[i].value,
      y: rrIntervals[i + 1].value,
    });
  }

  // Calculate bounds for scaling
  const allValues = rrIntervals.map(rr => rr.value);
  const minRR = Math.min(...allValues);
  const maxRR = Math.max(...allValues);
  const range = maxRR - minRR;
  const padding = range * 0.1;
  const plotMin = minRR - padding;
  const plotMax = maxRR + padding;

  // SVG dimensions
  const width = 300;
  const height = 300;
  const margin = 40;
  const plotWidth = width - 2 * margin;
  const plotHeight = height - 2 * margin;

  // Scale function
  const scale = (value: number) => {
    return ((value - plotMin) / (plotMax - plotMin)) * plotWidth + margin;
  };

  // Generate grid lines
  const gridLines = [];
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const value = plotMin + (i / numGridLines) * (plotMax - plotMin);
    const pos = scale(value);
    
    // Vertical grid line
    gridLines.push(
      <line
        key={`v-${i}`}
        x1={pos}
        y1={margin}
        x2={pos}
        y2={height - margin}
        stroke={darkMode ? '#374151' : '#e5e7eb'}
        strokeWidth="1"
      />
    );
    
    // Horizontal grid line
    gridLines.push(
      <line
        key={`h-${i}`}
        x1={margin}
        y1={height - pos + margin}
        x2={width - margin}
        y2={height - pos + margin}
        stroke={darkMode ? '#374151' : '#e5e7eb'}
        strokeWidth="1"
      />
    );
  }

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${className}`}>
      <h4 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        RR Interval Poincaré Plot
      </h4>
      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Each dot represents RRn vs RRn+1. Tighter clusters indicate more stable heart rhythm.
      </p>
      
      <div className="flex justify-center">
        <svg width={width} height={height} className={`rounded border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
          {/* Grid lines */}
          {gridLines}
          
          {/* Diagonal reference line */}
          <line
            x1={margin}
            y1={height - margin}
            x2={width - margin}
            y2={margin}
            stroke={darkMode ? '#6b7280' : '#9ca3af'}
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          
          {/* Data points */}
          {poincaréData.map((point, index) => (
            <circle
              key={index}
              cx={scale(point.x)}
              cy={height - scale(point.y) + margin}
              r="2"
              fill={darkMode ? '#60a5fa' : '#3b82f6'}
              fillOpacity="0.6"
            />
          ))}
          
          {/* Axes */}
          <line
            x1={margin}
            y1={height - margin}
            x2={width - margin}
            y2={height - margin}
            stroke={darkMode ? '#9ca3af' : '#6b7280'}
            strokeWidth="2"
          />
          <line
            x1={margin}
            y1={margin}
            x2={margin}
            y2={height - margin}
            stroke={darkMode ? '#9ca3af' : '#6b7280'}
            strokeWidth="2"
          />
          
          {/* Axis labels */}
          <text
            x={width / 2}
            y={height - 10}
            textAnchor="middle"
            fontSize="12"
            fill={darkMode ? '#9ca3af' : '#6b7280'}
          >
            RR(n) ms
          </text>
          <text
            x={15}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill={darkMode ? '#9ca3af' : '#6b7280'}
            transform={`rotate(-90 15 ${height / 2})`}
          >
            RR(n+1) ms
          </text>
        </svg>
      </div>
      
      <div className="mt-3 text-xs text-center">
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {poincaréData.length} RR interval pairs plotted
        </p>
      </div>
    </div>
  );
};

export default RRVisualization;