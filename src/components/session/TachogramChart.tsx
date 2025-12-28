import React, { useCallback, useId, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

type RGB = [number, number, number];

const GREEN: RGB = [34, 197, 94];
const YELLOW: RGB = [234, 179, 8];
const RED: RGB = [239, 68, 68];

const toHex = (value: number) => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
};

const blend = (start: RGB, end: RGB, t: number): RGB => {
  return start.map((component, index) => component + (end[index] - component) * t) as RGB;
};

const toColor = ([r, g, b]: RGB) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

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

  const gradientId = useId();

  const getColorForRR = useCallback(
    (rrValue: number) => {
      // Green zone (normal range): 700-1000 ms
      if (rrValue >= 700 && rrValue <= 1000) {
        return '#22c55e'; // Green
      }

      // Yellow zones: 600-700 ms and 1000-1200 ms
      if ((rrValue >= 600 && rrValue < 700) || (rrValue > 1000 && rrValue <= 1200)) {
        // Calculate transition intensity within yellow range
        let intensity: number;
        if (rrValue >= 600 && rrValue < 700) {
          // Transition from red to yellow as we approach 700
          intensity = (rrValue - 600) / 100; // 0 to 1 as we go from 600 to 700
        } else {
          // Transition from yellow to red as we go from 1000 to 1200
          intensity = (1200 - rrValue) / 200; // 1 to 0 as we go from 1000 to 1200
        }
        const mix = blend(RED, YELLOW, intensity);
        return toColor(mix);
      }

      // Red zones: < 600 ms and > 1200 ms
      return '#ef4444'; // Red
    },
    []
  );

  const gradientStops = useMemo(() => {
    if (data.length < 2) {
      return null;
    }

    return data.map((point, index) => {
      return {
        offset: `${(index / (data.length - 1)) * 100}%`,
        color: getColorForRR(point.rrInterval),
      };
    });
  }, [data, getColorForRR]);

  const latestRRColor = useMemo(() => {
    if (!data.length) {
      return '#2563eb';
    }
    const lastPoint = data[data.length - 1];
    return getColorForRR(lastPoint.rrInterval);
  }, [data, getColorForRR]);

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
    <div className="p-0.5 rounded-2xl bg-slate-200">
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
                {gradientStops && (
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      {gradientStops.map((stop) => (
                        <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                      ))}
                    </linearGradient>
                  </defs>
                )}
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
                  stroke={gradientStops ? `url(#${gradientId})` : '#2563eb'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: latestRRColor }}
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

export default React.memo(TachogramChart);
