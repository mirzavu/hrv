import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

type RRInterval = {
  timestamp: number;
  value: number;
};

interface SignalQualityTimelineProps {
  rrIntervals: RRInterval[];
  duration: number; // in seconds
}

type ArtifactPoint = {
  time: number;
  rr: number;
  type: 'artifact' | 'clean';
};

interface SignalQualityTooltipPayload {
  value: number | string;
  payload: ArtifactPoint;
}

interface SignalQualityTooltipArgs {
  active?: boolean;
  payload?: SignalQualityTooltipPayload[];
}

interface SignalQualityScatterShapeProps {
  cx?: number;
  cy?: number;
  payload?: ArtifactPoint;
}

const SignalQualityTimeline: React.FC<SignalQualityTimelineProps> = ({ rrIntervals, duration }) => {
  const artifactData = useMemo<ArtifactPoint[]>(() => {
    if (rrIntervals.length < 2) {
      return [];
    }

    const points: ArtifactPoint[] = [];
    const startTime = rrIntervals[0].timestamp;

    for (let i = 1; i < rrIntervals.length; i++) {
      const prevRR = rrIntervals[i - 1].value;
      const currentRR = rrIntervals[i].value;
      const time = (rrIntervals[i].timestamp - startTime) / 1000;

      // Simple artifact detection: if RR interval changes by more than 20%
      if (Math.abs(currentRR - prevRR) > prevRR * 0.2) {
        points.push({ time, rr: currentRR, type: 'artifact' });
      } else {
        points.push({ time, rr: currentRR, type: 'clean' });
      }
    }
    return points;
  }, [rrIntervals]);

  const artifactPercentage =
    (artifactData.filter((p) => p.type === 'artifact').length / (artifactData.length || 1)) * 100;

  const renderTooltip = ({ active, payload }: SignalQualityTooltipArgs) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-300">{`Time: ${point.time.toFixed(1)}s`}</p>
          <p className={`mt-1 text-sm font-semibold ${point.type === 'artifact' ? 'text-red-400' : 'text-green-400'}`}>
            {point.type === 'artifact' ? `Potential Artifact (${point.rr.toFixed(0)}ms)` : `Clean Signal (${point.rr.toFixed(0)}ms)`}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderPoint = (props: unknown) => {
    const { cx = 0, cy = 0, payload } = (props as SignalQualityScatterShapeProps) ?? {};
    if (!payload) {
      return <></>;
    }

    const radius = payload.type === 'artifact' ? 6 : 3;
    const fill = payload.type === 'artifact' ? '#ef4444' : '#22c55e';
    const opacity = payload.type === 'artifact' ? 0.8 : 0.4;

    return <circle cx={cx} cy={cy} r={radius} fill={fill} fillOpacity={opacity} />;
  };

  return (
    <div className="rounded-xl bg-white p-6 border border-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Signal Quality Timeline</h3>
        <p className="text-sm text-slate-500">
          Timeline of the session with potential data artifacts marked in red.
        </p>
      </div>
      <div className="h-24">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <XAxis
              dataKey="time"
              type="number"
              domain={[0, duration]}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `${value}s`}
              stroke="#cbd5f5"
            />
            <YAxis
              type="category"
              dataKey="type"
              domain={['clean', 'artifact']}
              tick={false}
              axisLine={false}
            />
            <RechartsTooltip content={renderTooltip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={artifactData} shape={renderPoint} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
       <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500/80"></span>
                <span>Clean Signal</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500/80"></span>
                <span>Potential Artifact</span>
            </div>
        </div>
        <div className="font-semibold text-sm text-slate-600">
            Signal Quality: <span className={artifactPercentage > 10 ? 'text-red-500' : 'text-green-600'}>
                {(100 - artifactPercentage).toFixed(1)}%
            </span>
        </div>
      </div>
    </div>
  );
};

export default SignalQualityTimeline;