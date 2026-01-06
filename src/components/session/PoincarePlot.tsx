import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';

type PoincarePlotDataPoint = {
  rrn: number;
  rrn1: number;
};

interface PoincareTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PoincarePlotDataPoint;
  }>;
}

interface PoincarePlotProps {
  data: PoincarePlotDataPoint[];
  darkMode?: boolean;
}

const PoincarePlot: React.FC<PoincarePlotProps> = ({ data, darkMode = false }) => {
  const [minRR, maxRR] = useMemo(() => {
    if (!data.length) return [0, 1000];
    const allRRs = data.flatMap((d) => [d.rrn, d.rrn1]);
    const min = Math.min(...allRRs);
    const max = Math.max(...allRRs);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [data]);

  const renderPoincareTooltip = (tooltipProps: PoincareTooltipProps) => {
    const { active, payload } = tooltipProps;
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-slate-700">RR Interval Pair</p>
        <p className="text-slate-600">
          RR(n): <span className="font-mono">{data.rrn.toFixed(0)} ms</span>
        </p>
        <p className="text-slate-600">
          RR(n+1): <span className="font-mono">{data.rrn1.toFixed(0)} ms</span>
        </p>
        <p className="mt-1 text-slate-500">
          Δ: {Math.abs(data.rrn1 - data.rrn).toFixed(0)} ms
        </p>
      </div>
    );
  };

  return (
    <div className={`p-0.5 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
      <div className={`rounded-[15px] p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="mb-4">
          <h3 className={`text-lg font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>
            Heart Rhythm Analysis
          </h3>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            Poincaré plot showing RR interval variability patterns. Each point
            represents consecutive RR intervals.
          </p>
        </div>

        <div className="space-y-4">
          {data.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <ScatterChart
                  data={data}
                  margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="rrn"
                    type="number"
                    domain={[minRR, maxRR]}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(value) => `${Math.round(value)}`}
                    stroke="#cbd5f5"
                    label={{
                      value: 'RR(n) interval (ms)',
                      position: 'insideBottom',
                      offset: -5,
                      style: {
                        textAnchor: 'middle',
                        fontSize: 12,
                        fill: '#64748b',
                      },
                    }}
                  />
                  <YAxis
                    dataKey="rrn1"
                    type="number"
                    domain={[minRR, maxRR]}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(value) => `${Math.round(value)}`}
                    stroke="#cbd5f5"
                    label={{
                      value: 'RR(n+1) interval (ms)',
                      angle: -90,
                      position: 'insideLeft',
                      style: {
                        textAnchor: 'middle',
                        fontSize: 12,
                        fill: '#64748b',
                      },
                    }}
                  />
                  <RechartsTooltip
                    content={renderPoincareTooltip}
                    cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
                    animationDuration={0}
                  />
                  <Scatter
                    dataKey="rrn1"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    stroke="#2563eb"
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                  <ReferenceLine
                    segment={[{ x: minRR, y: minRR }, { x: maxRR, y: maxRR }]}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={`h-56 flex flex-col items-center justify-center rounded-xl border border-dashed text-center text-sm ${darkMode ? 'border-gray-700 bg-gray-900/50 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <p className={`font-medium ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                Not enough RR interval data yet
              </p>
              <p className={`mt-1 max-w-xs text-xs ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                Complete a full session to unlock the heart rhythm Poincaré plot
                visualization.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-500/80 border border-blue-600"></span>
              <span>RR interval pairs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-0.5 w-6 bg-slate-400/80"></span>
              <span>Identity line (RR(n) = RR(n+1))</span>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default React.memo(PoincarePlot);