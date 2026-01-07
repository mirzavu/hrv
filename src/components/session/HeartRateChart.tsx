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
  AreaChart,
  Area,
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
    <div className={`rounded-[15px] p-6 shadow-sm ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
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
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#374151' : '#f1f5f9'} />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, data[data.length - 1].time]}
                axisLine={{ stroke: '#22c55e', strokeDasharray: '4 4' }}
                tickLine={false}
                tick={{ fill: darkMode ? '#9ca3af' : '#94a3b8', fontSize: 11 }}
                tickFormatter={(value) => `${Math.round(value)}s`}
              />
              <YAxis
                domain={[minBpm, maxBpm]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: darkMode ? '#9ca3af' : '#94a3b8', fontSize: 11 }}
                tickFormatter={(value) => `${value}`}
              />
              <RechartsTooltip
                content={renderTooltip}
                cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
              />

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
              <Area
                type="monotone"
                dataKey="bpm"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorHr)"
              />
            </AreaChart>
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
  );
};

export default React.memo(HeartRateChart);