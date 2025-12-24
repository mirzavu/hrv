import React from 'react';

interface RMSSDTrendGaugeProps {
  startRMSSD: number | null | undefined;
  endRMSSD: number | null | undefined;
  rmssdDelta: number | null | undefined;
}

const RMSSDTrendGauge: React.FC<RMSSDTrendGaugeProps> = ({ startRMSSD, endRMSSD, rmssdDelta }) => {
  // Calculate trend direction and magnitude
  const getTrendData = () => {
    if (rmssdDelta === null || rmssdDelta === undefined) {
      return {
        trend: 'neutral',
        colorClass: 'text-gray-400',
        bgColorClass: 'bg-gray-200',
        borderColor: '#e2e8f0',
        label: 'N/A',
        description: 'Data not available',
        rotation: 0
      };
    }

    const absDelta = Math.abs(rmssdDelta);
    const maxDelta = 20; // Maximum expected change for normalization
    const normalizedDelta = Math.min(absDelta / maxDelta, 1);
    const rotation = normalizedDelta * 90; // 0 to 90 degrees

    if (rmssdDelta > 2) {
      return {
        trend: 'improvement',
        colorClass: 'text-green-500',
        bgColorClass: 'bg-green-500',
        borderColor: '#86efac',
        label: 'Improving',
        description: 'RMSSD increased during session - good recovery',
        rotation: rotation
      };
    } else if (rmssdDelta < -2) {
      return {
        trend: 'decline',
        colorClass: 'text-red-500',
        bgColorClass: 'bg-red-500',
        borderColor: '#fca5a5',
        label: 'Declining',
        description: 'RMSSD decreased during session - may indicate stress',
        rotation: -rotation
      };
    } else {
      return {
        trend: 'stable',
        colorClass: 'text-blue-500',
        bgColorClass: 'bg-blue-500',
        borderColor: '#bedbff',
        label: 'Stable',
        description: 'RMSSD remained consistent throughout session',
        rotation: 0
      };
    }
  };

  const trendData = getTrendData();

  return (
    <div className="p-0.5 rounded-2xl bg-slate-200">
      <div className="bg-white rounded-[15px] p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-700 mb-4">RMSSD Trend</h3>

          {/* Gauge */}
          <div className="relative w-32 h-16 mx-auto mb-4">
            <div className="w-full h-full rounded-full border-2 border-gray-300 flex items-end justify-center" style={{ backgroundColor: trendData.borderColor }}>
              <div
                className="w-1 h-8 bg-white rounded-full transform origin-bottom transition-transform duration-500"
                style={{ transform: `rotate(${trendData.rotation}deg)` }}
              ></div>
            </div>
            <div className="absolute bottom-[-6px] left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-gray-300"></div>
          </div>

          <div className="mt-2">
            <span className={`text-4xl font-bold ${trendData.colorClass}`}>
              {rmssdDelta !== null && rmssdDelta !== undefined ?
                `${rmssdDelta > 0 ? '+' : ''}${rmssdDelta.toFixed(1)}` : '--'
              }
            </span>
            <span className="text-lg text-slate-500">ms</span>
            <p className={`font-semibold mt-1 ${trendData.colorClass}`}>{trendData.label}</p>
          </div>

          {/* Start/End Values */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Start RMSSD</p>
              <p className="font-semibold text-slate-700">
                {startRMSSD !== null && startRMSSD !== undefined ? `${startRMSSD.toFixed(1)}ms` : '--'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">End RMSSD</p>
              <p className="font-semibold text-slate-700">
                {endRMSSD !== null && endRMSSD !== undefined ? `${endRMSSD.toFixed(1)}ms` : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RMSSDTrendGauge;
