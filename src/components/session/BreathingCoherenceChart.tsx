import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceArea,
} from 'recharts';

type HeartRateDataPoint = {
  time: number;
  bpm: number;
  rr?: number;
};

interface BreathingTooltipPayload {
  value: number | string;
  payload: {
    time: number;
    bpm?: number;
    pacer?: number;
  };
}

interface BreathingTooltipProps {
  active?: boolean;
  payload?: BreathingTooltipPayload[];
  label?: number | string;
}

interface BreathingCoherenceChartProps {
  data: HeartRateDataPoint[];
}

const BreathingCoherenceChart: React.FC<BreathingCoherenceChartProps> = ({ data }) => {
  // Combine user HR data and the generated breathing pacer wave into a single, unified array
  const combinedData = useMemo(() => {
    if (data.length < 2) {
      return [];
    }

    const breathsPerMinute = 5.5;
    const secondsPerBreath = 60 / breathsPerMinute;
    const amplitude = 10;
    const verticalOffset = 60;
    const duration = data[data.length - 1].time;

    const finalData = [];
    let userHrIndex = 0;

    // Create a unified timeline at 0.5-second intervals
    for (let i = 0; i <= duration; i += 0.5) {
      // Find the most recent user HR reading for the current time 'i'
      while (userHrIndex + 1 < data.length && data[userHrIndex + 1].time <= i) {
        userHrIndex++;
      }

      finalData.push({
        time: i,
        // Calculate the pacer value for this time point
        pacer: verticalOffset + amplitude * Math.sin((2 * Math.PI * i) / secondsPerBreath),
        // Use the most recent bpm value
        bpm: data[userHrIndex]?.bpm,
      });
    }
    return finalData;
  }, [data]);

  const renderTooltip = ({ active, payload, label }: BreathingTooltipProps) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const userHr = point.bpm;
      const pacerVal = point.pacer;

      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-300">{`Time ${Number(
            label
          ).toFixed(1)}s`}</p>
          {userHr != null && (
            <p className="mt-1 text-sm font-semibold text-[#3b82f6]">{`Your HR: ${userHr.toFixed(1)} bpm`}</p>
          )}
          {pacerVal != null && (
            <p className="mt-1 text-sm font-semibold text-[#a5b4fc]">{`Pacer: ${pacerVal.toFixed(1)} bpm`}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-0.5 rounded-2xl bg-slate-200">
      <div className="bg-white rounded-[15px] p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Breathing Coherence</h3>
          <p className="text-sm text-slate-500">
            Follow the wave to pace your breathing. Inhale as it rises, exhale as it falls.
          </p>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={combinedData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[0, 'dataMax']}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => `${value}s`}
                stroke="#cbd5f5"
                label={{
                  value: 'Time (s)',
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#64748b' },
                }}
              />
              <YAxis
                domain={[40, 100]}
                tick={{ fontSize: 12, fill: '#64748b' }}
                stroke="#cbd5f5"
                label={{
                  value: 'Heart Rate (bpm)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: 12, fill: '#64748b' },
                }}
              />
              <RechartsTooltip content={renderTooltip} animationDuration={0} />
              <ReferenceArea y1={50} y2={70} fill="#bbf7d0" fillOpacity={0.15} strokeOpacity={0} />
              <Line
                type="monotone"
                dataKey="pacer"
                stroke="#a5b4fc"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bpm"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: '#1d4ed8' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-8 rounded-full bg-[#3b82f6]/80"></span>
            <span>Your Heart Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-8"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, #a5b4fc 0, #a5b4fc 4px, transparent 4px, transparent 8px)',
              }}
            ></span>
            <span>Breathing Pacer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-100 border border-emerald-300"></span>
            <span>Coherence Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreathingCoherenceChart;