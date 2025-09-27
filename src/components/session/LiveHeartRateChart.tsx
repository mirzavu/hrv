'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from 'recharts';
import { RawHeartData } from '@/types';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

type LiveHeartRateChartProps = {
  data: RawHeartData[];
  darkMode?: boolean;
  height?: number;
  maxPoints?: number;
};

type ChartDatum = {
  time: number;
  heartRate: number | null;
};

const formatSeconds = (seconds: number) => {
  if (Number.isNaN(seconds)) {
    return '0s';
  }

  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
};

const CustomTooltip = (props: TooltipProps<ValueType, NameType> & { darkMode: boolean }) => {
  const { active, payload, label, darkMode } = props;

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const datum = payload[0];
  const heartRate = datum.value as number | null;

  return (
    <div
      className={`rounded-md border px-3 py-2 shadow-sm ${
        darkMode ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-800'
      }`}
    >
      <p className="text-xs font-medium">{formatSeconds(typeof label === 'number' ? label : Number(label))}</p>
      <p className="text-sm font-semibold">{heartRate ? `${Math.round(heartRate)} BPM` : 'No reading'}</p>
    </div>
  );
};

export default function LiveHeartRateChart({
  data,
  darkMode = false,
  height = 280,
  maxPoints = 180,
}: LiveHeartRateChartProps) {
  const chartData = useMemo<ChartDatum[]>(() => {
    if (!data?.length) {
      return [];
    }

    const limitedData = data.slice(-maxPoints);
    const referenceTimestamp = limitedData.find((item) => typeof item.timestamp === 'number')?.timestamp ?? Date.now();

    return limitedData.map((item, index) => {
      const timestamp = typeof item.timestamp === 'number' ? item.timestamp : referenceTimestamp + index * 1000;
      return {
        time: (timestamp - referenceTimestamp) / 1000,
        heartRate: typeof item.heartRate === 'number' ? item.heartRate : null,
      };
    });
  }, [data, maxPoints]);

  const gridColor = darkMode ? '#374151' : '#e5e7eb';
  const axisColor = darkMode ? '#9ca3af' : '#6b7280';
  const strokeColor = darkMode ? '#60a5fa' : '#2563eb';

  if (!chartData.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border text-sm transition-colors ${
          darkMode ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}
        style={{ height }}
      >
        Waiting for live heart rate data...
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid stroke={gridColor} strokeDasharray="6 6" />
          <XAxis
            dataKey="time"
            tickFormatter={formatSeconds}
            stroke={axisColor}
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={{ stroke: gridColor }}
            tickLine={{ stroke: gridColor }}
            padding={{ left: 10, right: 10 }}
          />
          <YAxis
            dataKey="heartRate"
            stroke={axisColor}
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={{ stroke: gridColor }}
            tickLine={{ stroke: gridColor }}
            domain={[0, 'auto']}
            allowDecimals={false}
            width={50}
            label={{
              value: 'BPM',
              angle: -90,
              position: 'insideLeft',
              style: { fill: axisColor, fontSize: 12 },
            }}
          />
          <Tooltip
            cursor={{ stroke: gridColor }}
            content={(tooltipProps) => <CustomTooltip {...tooltipProps} darkMode={darkMode} />}
          />
          <Line
            type="monotone"
            dataKey="heartRate"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
