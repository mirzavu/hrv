import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

type HeartRateDataPoint = {
  time: number;
  bpm: number;
};

interface HeartRateTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string }>;
  label?: number | string;
}

interface HeartRateChartProps {
  data: HeartRateDataPoint[];
  stabilizationTime?: number | null;
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({ data, stabilizationTime }) => {
  const [minBpm, maxBpm] = useMemo(() => {
    if (!data.length) {
      return [50, 110];
    }
    const values = data.map((point) => point.bpm);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(3, Math.round((max - min) * 0.12));
    const paddedMin = Math.max(30, Math.floor(min - padding));
    const paddedMax = Math.ceil(max + padding);
    return [paddedMin, paddedMax];
  }, [data]);

  const stableTime =
    typeof stabilizationTime === 'number' && Number.isFinite(stabilizationTime)
      ? Number(stabilizationTime.toFixed(1))
      : null;
  const sessionEnd = data.length ? data[data.length - 1].time : null;

  const renderTooltip = (tooltipProps: HeartRateTooltipProps) => {
    const { active, payload, label } = tooltipProps;
    if (!active || !payload || !payload.length || label === undefined) {
      return null;
    }
    const bpm = payload[0]?.value;
    if (bpm === undefined || bpm === null) {
      return null;
    }
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-md">
        <p className="text-xs uppercase tracking-wide text-slate-300">{`Time ${Number(
          label
        ).toFixed(1)}s`}</p>
        <p className="mt-1 text-sm font-semibold">{Number(bpm).toFixed(1)} bpm</p>
      </div>
    );
  };

  return (
    <div className="p-0.5 bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-200 rounded-2xl shadow-sm">
      <div className="bg-white rounded-[15px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-slate-700">Heart Rate Tachogram</h3>
            <p className="text-sm text-slate-500">
              Beat-to-beat heart rate throughout the session.
            </p>
          </div>
          {stableTime !== null && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Stabilized at {stableTime.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {data.length ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, data[data.length - 1].time]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${value}s`}
                  stroke="#cbd5f5"
                />
                <YAxis
                  domain={[minBpm, maxBpm]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${value} bpm`}
                  stroke="#cbd5f5"
                />
                <RechartsTooltip
                  content={renderTooltip}
                  cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
                />
                {stableTime !== null &&
                  sessionEnd !== null &&
                  sessionEnd > stableTime && (
                    <ReferenceArea
                      x1={stableTime}
                      x2={sessionEnd}
                      fill="#bbf7d0"
                      fillOpacity={0.18}
                      strokeOpacity={0}
                    />
                  )}
                {stableTime !== null && (
                  <ReferenceLine
                    x={stableTime}
                    stroke="#22c55e"
                    strokeDasharray="6 4"
                    label={{
                      value: 'Stabilized',
                      position: 'top',
                      fill: '#15803d',
                      fontSize: 12,
                      offset: 12,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="bpm"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#1d4ed8' }}
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
              Complete a full session to unlock the heart rate tachogram
              visualization.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-8 rounded-full bg-[#2563eb]/80"></span>
            <span>Heart rate (bpm)</span>
          </div>
          {stableTime !== null && (
            <div className="flex items-center gap-2 text-emerald-600">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Post-stabilization window highlighted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeartRateChart;