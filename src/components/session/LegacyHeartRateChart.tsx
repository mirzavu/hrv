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
} from 'recharts';
import { RawHeartData } from '@/types';

type ChartPoint = {
  seconds: number;
  heartRate: number;
};

type LegacyHeartRateChartProps = {
  data: RawHeartData[];
  darkMode?: boolean;
  height?: number;
  maxPoints?: number;
  sessionActive?: boolean;
  emptyMessage?: string;
};

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0.0s';
  }

  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  const precision = seconds < 10 ? 1 : seconds < 60 ? 1 : 0;
  return `${seconds.toFixed(precision)}s`;
};

const buildChartPoints = (data: RawHeartData[], maxPoints: number): ChartPoint[] => {
  if (!data || data.length === 0) {
    return [];
  }

  const latestSamples = data.slice(-maxPoints);
  const referenceTimestamp = latestSamples.find((item) => typeof item.timestamp === 'number')?.timestamp ?? Date.now();

  return latestSamples.reduce<ChartPoint[]>((acc, sample, index) => {
    const timestamp = typeof sample.timestamp === 'number'
      ? sample.timestamp
      : referenceTimestamp + index * 1000;

    let heartRate: number | null = null;
    if (typeof sample.heartRate === 'number' && Number.isFinite(sample.heartRate)) {
      heartRate = sample.heartRate;
    } else if (typeof sample.rrInterval === 'number' && sample.rrInterval > 0) {
      heartRate = Math.round(60000 / sample.rrInterval);
    }

    if (heartRate !== null) {
      acc.push({
        seconds: (timestamp - referenceTimestamp) / 1000,
        heartRate,
      });
    }

    return acc;
  }, []);
};

export default function LegacyHeartRateChart({
  data,
  darkMode = false,
  height = 300,
  maxPoints = 256,
  sessionActive = false,
  emptyMessage = 'Start a session to see the chart.',
}: LegacyHeartRateChartProps) {
  const chartData = useMemo(() => buildChartPoints(data, maxPoints), [data, maxPoints]);

  if (chartData.length < 2) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {sessionActive ? 'Waiting for heart rate data...' : emptyMessage}
        </p>
      </div>
    );
  }

  const maxHeartRate = chartData.reduce((max, point) => Math.max(max, point.heartRate), 0);
  const roundedMax = Math.max(100, Math.ceil(maxHeartRate / 25) * 25);
  const yTicks: number[] = [];
  for (let tick = 0; tick <= roundedMax; tick += 25) {
    yTicks.push(tick);
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 24, left: 12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#4A5568' : '#d1d5db'} />
        <XAxis
          dataKey="seconds"
          stroke={darkMode ? '#A0AEC0' : '#4B5563'}
          tick={{ fill: darkMode ? '#CBD5F5' : '#4A5568', fontSize: 12 }}
          tickFormatter={formatSeconds}
          tickLine={{ stroke: darkMode ? '#4A5568' : '#d1d5db' }}
          axisLine={{ stroke: darkMode ? '#4A5568' : '#d1d5db' }}
        />
        <YAxis
          dataKey="heartRate"
          stroke={darkMode ? '#A0AEC0' : '#4B5563'}
          tick={{ fill: darkMode ? '#CBD5F5' : '#4A5568', fontSize: 12 }}
          allowDecimals={false}
          ticks={yTicks}
          domain={[0, yTicks[yTicks.length - 1] || 100]}
          label={{
            value: 'Heart Rate (bpm)',
            angle: -90,
            position: 'insideLeft',
            fill: darkMode ? '#CBD5F5' : '#4A5568',
            fontSize: 12,
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${Math.round(value)} bpm`, 'Heart Rate']}
          labelFormatter={(label) => `Time ${formatSeconds(Number(label))}`}
          contentStyle={{
            backgroundColor: darkMode ? 'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: darkMode ? '#4A5568' : '#ccc',
            color: darkMode ? '#E2E8F0' : '#333',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="heartRate"
          stroke="#8884d8"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
