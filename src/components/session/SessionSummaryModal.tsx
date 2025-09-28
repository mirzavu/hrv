import React, { useMemo } from 'react';
import { SessionSummary } from '@/types';
import { formatRmssdDelta } from '@/utils/sessionSummaryFormat';
import { 
  X, 
  Heart, 
  Activity, 
  TrendingUp, 
  Clock, 
  Waves, 
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingDown,
  Minus
} from 'lucide-react';
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
  ScatterChart,
  Scatter
} from 'recharts';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
}

type SignalType = 'good' | 'warning' | 'alert' | 'info';
type TrendType = 'up' | 'down' | 'neutral';

interface Signal {
  type: SignalType;
  message: string;
}

type HeartRateDataPoint = {
  time: number;
  bpm: number;
};

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

interface HeartRateTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | string }>;
  label?: number | string;
}

// Helper functions for signal detection and styling
const getSignalIcon = (type: SignalType) => {
  const iconProps = { className: "w-5 h-5" };
  switch (type) {
    case 'good': return <CheckCircle {...iconProps} className="w-5 h-5 text-emerald-500" />;
    case 'warning': return <AlertTriangle {...iconProps} className="w-5 h-5 text-amber-500" />;
    case 'alert': return <AlertTriangle {...iconProps} className="w-5 h-5 text-rose-500" />;
    case 'info': return <Info {...iconProps} className="w-5 h-5 text-sky-500" />;
  }
};

const getSignalGradient = (type: SignalType) => {
  switch (type) {
    case 'good': return 'from-emerald-300 to-green-400';
    case 'warning': return 'from-amber-200 to-yellow-300';
    case 'alert': return 'from-rose-400 to-red-500';
    case 'info': return 'from-sky-300 to-blue-400';
    default: return 'from-slate-200 to-slate-200';
  }
};

const getTrendIcon = (trend: TrendType) => {
  const iconProps = { className: "w-5 h-5" };
  switch (trend) {
    case 'up': return <TrendingUp {...iconProps} className="w-5 h-5 text-emerald-600" />;
    case 'down': return <TrendingDown {...iconProps} className="w-5 h-5 text-rose-600" />;
    case 'neutral': return <Minus {...iconProps} className="w-5 h-5 text-slate-500" />;
  }
};

// Determine signal based on metric values (reasonable defaults)
const getMetricSignal = (metricName: string, value: number | null): Signal | undefined => {
  if (value === null) return undefined;
  
  switch (metricName) {
    case 'Session Duration':
      if (value >= 300) return { type: 'good', message: 'Excellent session duration for comprehensive analysis.' };
      if (value >= 120) return { type: 'info', message: 'Good session length for basic HRV assessment.' };
      return { type: 'warning', message: 'Short session - consider longer duration for better accuracy.' };
      
    case 'Mean Heart Rate':
      if (value >= 60 && value <= 100) return { type: 'good', message: 'Normal resting heart rate range.' };
      if (value < 60) return { type: 'info', message: 'Low heart rate - common in well-trained athletes.' };
      return { type: 'warning', message: 'Elevated heart rate - ensure you are well-rested during measurement.' };
      
    case 'Data Points':
      if (value >= 50) return { type: 'good', message: 'Excellent data quality with sufficient measurement points.' };
      if (value >= 20) return { type: 'info', message: 'Good data quality for reliable analysis.' };
      return { type: 'warning', message: 'Limited data points - longer session recommended.' };
      
    case 'Session RMSSD':
      if (value >= 50) return { type: 'good', message: 'Excellent HRV indicating good autonomic function.' };
      if (value >= 30) return { type: 'info', message: 'Good HRV levels within normal range.' };
      if (value >= 15) return { type: 'warning', message: 'Moderate HRV - consider stress management techniques.' };
      return { type: 'alert', message: 'Low HRV detected - prioritize recovery and stress reduction.' };
      
    case 'RMSSD Change':
      if (Math.abs(value) < 5) return { type: 'good', message: 'Stable HRV throughout session indicates consistency.' };
      if (value > 0) return { type: 'info', message: 'HRV improved during session - positive adaptation.' };
      return { type: 'warning', message: 'HRV decreased during session - may indicate fatigue or stress.' };
      
    case 'Stress Index':
      if (value < 50) return { type: 'good', message: 'Low stress levels - excellent autonomic balance.' };
      if (value < 150) return { type: 'info', message: 'Moderate stress levels - within normal range.' };
      if (value < 300) return { type: 'warning', message: 'Elevated stress detected - consider relaxation techniques.' };
      return { type: 'alert', message: 'High stress levels - prioritize recovery and stress management.' };
      
    case 'Restoration Index':
      if (value >= 70) return { type: 'good', message: 'Excellent restoration capacity - well-recovered state.' };
      if (value >= 50) return { type: 'info', message: 'Good restoration levels indicating adequate recovery.' };
      if (value >= 30) return { type: 'warning', message: 'Moderate restoration - ensure adequate sleep and recovery.' };
      return { type: 'alert', message: 'Low restoration score - prioritize rest and recovery activities.' };
      
    default:
      return { type: 'info', message: 'Metric recorded successfully.' };
  }
};

const getTrend = (metricName: string, value: number | null): TrendType | undefined => {
  if (value === null) return undefined;
  
  // For RMSSD Change, we can determine trend from the value itself
  if (metricName === 'RMSSD Change') {
    if (value > 2) return 'up';
    if (value < -2) return 'down';
    return 'neutral';
  }
  
  // For other metrics, we don't have historical data, so return undefined
  return undefined;
};

const MetricCard: React.FC<{
  icon?: React.ReactNode;
  title: string;
  value: number | null;
  unit?: string;
  trend?: TrendType;
  signal?: Signal;
}> = ({ icon, title, value, unit, trend, signal }) => {
  const displayValue = value !== null ? 
    (title === 'RMSSD Change' ? formatRmssdDelta(value).value : value.toFixed(1)) 
    : 'N/A';
  
  const actualSignal = signal || getMetricSignal(title, value);
  const actualTrend = trend || getTrend(title, value);

  return (
    <div className={`p-[1px] bg-gradient-to-br ${getSignalGradient(actualSignal?.type || 'info')} rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300`}>
      <div className="bg-white rounded-[15px] p-5 h-full relative group">
        {actualSignal && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 min-w-[220px] max-w-[280px] px-4 py-3 bg-[#0f172a] text-white text-sm rounded-xl border border-white/10 shadow-2xl backdrop-blur-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-20 mb-3">
            <div className="flex items-start gap-2.5">
              {getSignalIcon(actualSignal.type)}
              <div>
                <span className="font-semibold text-sm capitalize tracking-wide text-white/90">{actualSignal.type}</span>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">{actualSignal.message}</p>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0f172a] border border-white/10 border-t-transparent border-l-transparent rotate-45 -mt-1.5"></div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-medium text-[#737b87]">{title}</h3>
          </div>
          {actualTrend && getTrendIcon(actualTrend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-700">{displayValue}</span>
          {unit && <span className="text-base font-medium text-slate-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

const HeartRateChart: React.FC<{
  data: HeartRateDataPoint[];
  stabilizationTime?: number | null;
}> = ({ data, stabilizationTime }) => {
  const [minBpm, maxBpm] = useMemo(() => {
    if (!data.length) {
      return [50, 110];
    }
    const values = data.map(point => point.bpm);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(3, Math.round((max - min) * 0.12));
    const paddedMin = Math.max(30, Math.floor(min - padding));
    const paddedMax = Math.ceil(max + padding);
    return [paddedMin, paddedMax];
  }, [data]);

  const stableTime = typeof stabilizationTime === 'number' && Number.isFinite(stabilizationTime)
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
        <p className="text-xs uppercase tracking-wide text-slate-300">{`Time ${Number(label).toFixed(1)}s`}</p>
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
            <p className="text-sm text-slate-500">Beat-to-beat heart rate throughout the session.</p>
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
                <RechartsTooltip content={renderTooltip} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} />
                {stableTime !== null && sessionEnd !== null && sessionEnd > stableTime && (
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
                      offset: 12
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
            <p className="font-medium text-slate-600">Not enough RR interval data yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Complete a full session to unlock the heart rate tachogram visualization.
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

const PoincarePlot: React.FC<{
  data: PoincarePlotDataPoint[];
}> = ({ data }) => {
  const [minRR, maxRR] = useMemo(() => {
    if (!data.length) return [0, 1000];
    const allRRs = data.flatMap(d => [d.rrn, d.rrn1]);
    const min = Math.min(...allRRs);
    const max = Math.max(...allRRs);
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [data]);

  const renderPoincarTooltip = (tooltipProps: PoincareTooltipProps) => {
    const { active, payload } = tooltipProps;
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-slate-700">RR Interval Pair</p>
        <p className="text-slate-600">RR(n): <span className="font-mono">{data.rrn.toFixed(0)} ms</span></p>
        <p className="text-slate-600">RR(n+1): <span className="font-mono">{data.rrn1.toFixed(0)} ms</span></p>
        <p className="mt-1 text-slate-500">Δ: {Math.abs(data.rrn1 - data.rrn).toFixed(0)} ms</p>
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Heart Rhythm Analysis</h3>
        <p className="text-sm text-slate-500">
          Poincaré plot showing RR interval variability patterns. Each point represents consecutive RR intervals.
        </p>
      </div>

      <div className="space-y-4">
        {data.length ? (
          <div className="h-64">
            <ResponsiveContainer>
              <ScatterChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="rrn"
                  type="number"
                  domain={[minRR, maxRR]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${Math.round(value)}`}
                  stroke="#cbd5f5"
                  label={{ value: 'RR(n) interval (ms)', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: 12, fill: '#64748b' } }}
                />
                <YAxis
                  dataKey="rrn1"
                  type="number"
                  domain={[minRR, maxRR]}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(value) => `${Math.round(value)}`}
                  stroke="#cbd5f5"
                  label={{ value: 'RR(n+1) interval (ms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12, fill: '#64748b' } }}
                />
                <RechartsTooltip content={renderPoincarTooltip} cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }} />
                <Scatter
                  dataKey="rrn1"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  stroke="#2563eb"
                  strokeWidth={1}
                />
                {/* Add identity line (RR(n) = RR(n+1)) */}
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
          <div className="h-56 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-600">Not enough RR interval data yet</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Complete a full session to unlock the heart rhythm Poincaré plot visualization.
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
  );
};

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ 
  summary, 
  onReset, 
  isGuest, 
  onGuestLogin, 
  onClose 
}) => {
  const heartRateData = useMemo<HeartRateDataPoint[]>(() => {
    const intervals = summary.rrIntervals ?? [];
    const valid = intervals.filter((interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0);
    if (!valid.length) {
      return [] as HeartRateDataPoint[];
    }

    const startTimestamp = typeof valid[0].timestamp === 'number' ? valid[0].timestamp : null;
    let elapsedSeconds = 0;
    let lastRR = valid[0].value ?? 0;

    return valid.map((interval, index) => {
      const rr = interval.value ?? lastRR;
      if (!rr || rr <= 0) {
        return null;
      }

      if (startTimestamp !== null && typeof interval.timestamp === 'number') {
        elapsedSeconds = (interval.timestamp - startTimestamp) / 1000;
      } else if (index === 0) {
        elapsedSeconds = 0;
      } else {
        elapsedSeconds += rr / 1000;
      }

      lastRR = rr;

      return {
        time: Number(elapsedSeconds.toFixed(1)),
        bpm: Number((60000 / rr).toFixed(1))
      };
    }).filter((point): point is HeartRateDataPoint => Boolean(point) && Number.isFinite(point?.bpm));
  }, [summary.rrIntervals]);

  const poincareData = useMemo<PoincarePlotDataPoint[]>(() => {
    const intervals = summary.rrIntervals ?? [];
    const valid = intervals.filter((interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0);
    if (valid.length < 2) {
      return [] as PoincarePlotDataPoint[];
    }

    const points: PoincarePlotDataPoint[] = [];
    for (let i = 0; i < valid.length - 1; i++) {
      const rrn = valid[i].value ?? 0;
      const rrn1 = valid[i + 1].value ?? 0;
      
      if (rrn > 0 && rrn1 > 0) {
        points.push({
          rrn: Number(rrn.toFixed(1)),
          rrn1: Number(rrn1.toFixed(1))
        });
      }
    }

    return points;
  }, [summary.rrIntervals]);

  const stabilizationTime = typeof summary.timeToStabilize?.value === 'number'
    ? summary.timeToStabilize.value
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white text-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in flex flex-col shadow-2xl">
        <header className="sticky top-0 bg-white/70 backdrop-blur-md rounded-t-3xl border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Session Summary</h1>
            <p className="text-slate-500 mt-1">A complete analysis of your session.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </header>

        <main className="p-8 space-y-8">
          {/* Key Metrics Section */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                icon={<Clock className="w-5 h-5 text-slate-400"/>} 
                title="Session Duration" 
                value={summary.duration.value} 
                unit={summary.duration.unit} 
              />
              <MetricCard 
                icon={<Heart className="w-5 h-5 text-slate-400"/>} 
                title="Mean Heart Rate" 
                value={summary.meanHR.value} 
                unit={summary.meanHR.unit} 
              />
              <MetricCard 
                icon={<Target className="w-5 h-5 text-slate-400"/>} 
                title="Data Points" 
                value={summary.dataPoints.value} 
              />
            </div>
          </section>
          
          <div className="flex flex-col gap-8">
            <section className="space-y-8">
              {/* HRV Analysis */}
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <Waves className="w-6 h-6 text-blue-600" />
                  HRV Analysis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard 
                    title="Session RMSSD" 
                    value={summary.sessionRMSSD.value} 
                    unit={summary.sessionRMSSD.unit} 
                  />
                  <MetricCard 
                    title="RMSSD Change" 
                    value={summary.rmssdDelta.value} 
                    unit={summary.rmssdDelta.unit} 
                  />
                  <MetricCard 
                    title="Stress Index" 
                    value={summary.sessionStressIndex.value} 
                  />
                  <MetricCard 
                    title="Restoration Index" 
                    value={summary.restorationIndex.value} 
                    unit="/100" 
                  />
                </div>
              </section>

              {/* Detailed Metrics Section - Placeholder for future graphs */}
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  Detailed Metrics
                </h2>
                <div className="space-y-6">
                  <HeartRateChart data={heartRateData} stabilizationTime={stabilizationTime} />
                  <PoincarePlot data={poincareData} />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">📊 Additional Visualizations Coming Soon</p>
                      <p className="text-sm text-slate-500">
                        Stress Index Gauge • Restoration Gauge • Breathing Coherence Wave • Signal Quality Timeline
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </main>

        <footer className="sticky bottom-0 bg-white/70 backdrop-blur-md rounded-b-3xl border-t border-slate-200 p-5 mt-auto">
          {/* Guest Login Prompt */}
          {isGuest && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <p className="font-semibold mb-2 text-blue-800">
                    Create an Account for Full Features
                  </p>
                  <p className="text-sm mb-3 text-blue-600">
                    Log in to save your session history, track progress over time, and access advanced analytics.
                  </p>
                  <button
                    onClick={onGuestLogin}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all transform hover:scale-105"
                  >
                    Create Account / Login
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              Session completed at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button 
              onClick={onReset} 
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
            >
              Start New Session
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SessionSummaryModal;
