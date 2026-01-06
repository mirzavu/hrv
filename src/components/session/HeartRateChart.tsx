import React, { useCallback, useId, useMemo } from 'react';

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
  rr?: number;
};

interface HeartRateTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string }>;
  label?: number | string;
}

interface HeartRateChartProps {
  data: HeartRateDataPoint[];
  stabilizationTime?: number | null;
  darkMode?: boolean;
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({ data, stabilizationTime, darkMode = false }) => {
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


  const gradientId = useId();

  const getColorForBPM = useCallback(
    (bpmValue?: number) => {
      if (bpmValue === undefined || !Number.isFinite(bpmValue)) {
        return '#22c55e';
      }

      // Green range: 60-85 bpm
      if (bpmValue >= 60 && bpmValue <= 85) {
        return '#22c55e'; // Green
      }

      // Yellow ranges: 50-60 bpm and 85-100 bpm
      if ((bpmValue >= 50 && bpmValue < 60) || (bpmValue > 85 && bpmValue <= 100)) {
        // Calculate transition intensity within yellow range
        let intensity: number;
        if (bpmValue >= 50 && bpmValue < 60) {
          // Transition from red to yellow as we approach 60
          intensity = (bpmValue - 50) / 10; // 0 to 1 as we go from 50 to 60
        } else {
          // Transition from yellow to red as we go from 85 to 100
          intensity = (100 - bpmValue) / 15; // 1 to 0 as we go from 85 to 100
        }
        const mix = blend(RED, YELLOW, intensity);
        return toColor(mix);
      }

      // Red ranges: <50 bpm and >100 bpm
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
        color: getColorForBPM(point.bpm),
      };
    });
  }, [data, getColorForBPM]);

  const latestBPMColor = useMemo(() => {
    if (!data.length) {
      return '#1d4ed8';
    }
    const lastPoint = data[data.length - 1];
    return getColorForBPM(lastPoint.bpm);
  }, [data, getColorForBPM]);

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
    <div className={`p-0.5 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
      <div className={`rounded-[15px] p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>HeartRate Chart</h3>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
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
                {gradientStops && (
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                      {gradientStops.map((stop) => (
                        <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                      ))}
                    </linearGradient>
                  </defs>
                )}
                <CartesianGrid stroke={darkMode ? '#374151' : '#e2e8f0'} strokeDasharray="4 4" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, data[data.length - 1].time]}
                  tick={{ fontSize: 12, fill: darkMode ? '#9ca3af' : '#64748b' }}
                  tickFormatter={(value) => `${value}s`}
                  stroke={darkMode ? '#4b5563' : '#cbd5f5'}
                />
                <YAxis
                  domain={[minBpm, maxBpm]}
                  tick={{ fontSize: 12, fill: darkMode ? '#9ca3af' : '#64748b' }}
                  tickFormatter={(value) => `${value} bpm`}
                  stroke={darkMode ? '#4b5563' : '#cbd5f5'}
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
                  stroke={gradientStops ? `url(#${gradientId})` : '#2563eb'}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: latestBPMColor }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={`h-56 flex flex-col items-center justify-center rounded-xl border border-dashed text-center text-sm ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
            <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              Not enough heart rate data yet
            </p>
            <p className={`mt-1 max-w-xs text-xs ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              Complete a full session to unlock the heart rate chart
              visualization.
            </p>
          </div>
        )}

        <div className={`mt-4 flex flex-wrap items-center gap-4 text-xs ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2 w-8 rounded-full"
              style={{
                background: '#2563eb',
              }}
            ></span>
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

export default React.memo(HeartRateChart);