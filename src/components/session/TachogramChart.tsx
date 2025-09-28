import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

type TachogramDataPoint = {
  beatNumber: number;
  time: number;
  rrInterval: number;
};

interface TachogramTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string }>;
  label?: number | string;
}

interface TachogramChartProps {
  data: TachogramDataPoint[];
}

const TachogramChart: React.FC<TachogramChartProps> = ({ data }) => {
  const [minRR, maxRR] = useMemo(() => {
    if (!data.length) {
      return [400, 1200];
    }
    const values = data.map((point) => point.rrInterval);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(20, Math.round((max - min) * 0.1));
    const paddedMin = Math.max(200, Math.floor(min - padding));
    const paddedMax = Math.ceil(max + padding);
    return [paddedMin, paddedMax];
  }, [data]);

  const renderTooltip = (tooltipProps: TachogramTooltipProps) => {
    const { active, payload, label } = tooltipProps;
    if (!active || !payload || !payload.length || label === undefined) {
      return null;
    }
    const rrInterval = payload[0]?.value;
    if (rrInterval === undefined || rrInterval === null) {
      return null;
    }
    
    const beatNumber = data.find(point => point.rrInterval === rrInterval)?.beatNumber || 0;
    const time = data.find(point => point.rrInterval === rrInterval)?.time || 0;
    
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-md">
        <p className="text-xs uppercase tracking-wide text-slate-300">Beat #{beatNumber}</p>
        <p className="text-xs text-slate-300">Time: {Number(time).toFixed(1)}s</p>
        <p className="mt-1 text-sm font-semibold">{Number(rrInterval).toFixed(1)} ms</p>
      </div>
    );
  };

  return (
    <div className="p-0.5 bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-200 rounded-2xl shadow-sm">
      <div className="bg-white rounded-[15px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-slate-700">Tachogram</h3>
            <p className="text-sm text-slate-500">
              RR intervals over time showing heart rate variability.
            </p>
          </div>
        </div>

        {data.length ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="beatNumber"
                  type="number"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `#${value}`}
                  stroke="#cbd5f5"
                />
                <YAxis
                  domain={[minRR, maxRR]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${value} ms`}
                  stroke="#cbd5f5"
                />
                <RechartsTooltip
                  content={renderTooltip}
                  cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
                />
                <Line
                  type="monotone"
                  dataKey="rrInterval"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-600">
              Not enough RR interval data yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Complete a full session to unlock the tachogram visualization.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2 w-8 rounded-full"
              style={{
                background: '#2563eb',
              }}
            ></span>
            <span>RR Interval (ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TachogramChart;
