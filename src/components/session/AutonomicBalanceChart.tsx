import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Tooltip as RechartsTooltip,
  Cell,
  Label,
} from 'recharts';
import { Target } from 'lucide-react';

import {
  AUTONOMIC_ACTIVITY_DOMAIN,
  AUTONOMIC_BALANCE_DOMAIN,
  computeAutonomicActivity,
  computeAutonomicBalance,
  classifyAutonomicZone,
} from '@/utils/autonomicBalance';

interface AutonomicBalancePoint {
  balance: number;
  activity: number;
  ratio: number | null;
  totalPower: number | null;
  date?: string;
}

interface AutonomicBalanceChartProps {
  currentRatio?: number | null;
  currentTotalPower?: number | null;
  historicalSessions?: Array<{
    ratio: number | null | undefined;
    totalPower: number | null | undefined;
    date?: string;
  }>;
  darkMode?: boolean;
}

interface TooltipPayloadValue {
  balance: number;
  activity: number;
  totalPower: number | null;
  ratio: number | null;
  date?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: TooltipPayloadValue;
  }>;
}

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;

  if (payload.value % 50 !== 0) {
    return null;
  }

  let label = payload.value;
  let subLabel = '';

  if (payload.value === 50) {
    label = '50(S)';
    subLabel = 'Sympathetic';
  } else if (payload.value === 150) {
    label = '150(P)';
    subLabel = 'Parasympathetic';
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={11}>
        {label}
      </text>
      <text x={0} y={0} dy={30} textAnchor="middle" fill="#888" fontSize={10}>
        {subLabel}
      </text>
    </g>
  );
};

// === StatusCard Component ===
const StatusCard: React.FC<{ zone: ReturnType<typeof classifyAutonomicZone>; darkMode?: boolean }> = ({ zone, darkMode = false }) => {
  const icon = (
    <Target className="w-5 h-5" />
  );

  return (
    <div className={`rounded-lg border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center space-x-2 mb-2">
        <span style={{ color: zone.color }}>{icon}</span>
        <h5 className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>Your Status</h5>
      </div>
      <p className="text-xl font-bold" style={{ color: zone.color }}>
        {zone.name}
      </p>
      <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
        {zone.description}
      </p>
    </div>
  );
};

// === MetricCard Component ===
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  borderColor?: string;
  darkMode?: boolean;
}> = ({ title, value, unit, icon, borderColor = 'border-slate-200', darkMode = false }) => {
  const actualBorderColor = darkMode ? 'border-gray-700' : borderColor;
  return (
    <div className={`rounded-lg border p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} ${actualBorderColor}`}>
      <div className="flex items-center space-x-2 mb-3">
        <span className={darkMode ? 'text-gray-500' : 'text-slate-500'}>{icon}</span>
        <h5 className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>{title}</h5>
      </div>
      <div className="flex items-baseline">
        <p className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>{value}</p>
        {unit && <p className={`text-sm ml-1.5 ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>{unit}</p>}
      </div>
    </div>
  );
};

// === Icon definitions ===
const Icons = {
  Balance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2" /></svg>
  ),
  Activity: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  ),
  Ratio: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Power: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  ),
};

const AutonomicBalanceChart: React.FC<AutonomicBalanceChartProps> = ({
  currentRatio,
  currentTotalPower,
  historicalSessions = [],
  darkMode = false,
}) => {
  const currentPoint = useMemo<AutonomicBalancePoint | null>(() => {
    const balance = computeAutonomicBalance(currentRatio ?? null);
    const activity = computeAutonomicActivity(currentTotalPower ?? null);

    if (balance === null || activity === null) {
      return null;
    }

    return {
      balance,
      activity,
      ratio: currentRatio ?? null,
      totalPower: currentTotalPower ?? null,
    };
  }, [currentRatio, currentTotalPower]);

  const historicalPoints = useMemo<AutonomicBalancePoint[]>(() => {
    return (historicalSessions ?? [])
      .map((entry) => {
        const balance = computeAutonomicBalance(entry.ratio ?? null);
        const activity = computeAutonomicActivity(entry.totalPower ?? null);

        if (balance === null || activity === null) {
          return null;
        }

        const point: AutonomicBalancePoint = {
          balance,
          activity,
          ratio: entry.ratio ?? null,
          totalPower: entry.totalPower ?? null,
        };
        if (entry.date) {
          point.date = entry.date;
        }
        return point;
      })
      .filter((point): point is AutonomicBalancePoint => point !== null);
  }, [historicalSessions]);

  const balanceLabel = useMemo(() => {
    if (!currentPoint) return '';
    if (currentPoint.balance < 100) return '(S)';
    if (currentPoint.balance > 100) return '(P)';
    return '(Balanced)';
  }, [currentPoint]);

  const zone = useMemo(() => {
    return classifyAutonomicZone(
      currentPoint?.balance ?? null,
      currentPoint?.activity ?? null
    );
  }, [currentPoint]);

  const renderTooltip = (props: TooltipProps) => {
    const { active, payload } = props;
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const pointType = data.date ? 'Historical Session' : 'Current Session';
    const pointBalanceLabel = data.balance < 100 ? '(S)' : '(P)';

    return (
      <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-slate-700">{pointType}</p>
        <p className="text-slate-600">
          Balance Index: {data.balance.toFixed(1)} {pointBalanceLabel}
        </p>
        <p className="text-slate-600">
          Activity Index: {data.activity.toFixed(1)}
        </p>
        {data.date && (
          <p className="mt-1 text-slate-500">
            Date: {new Date(data.date).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  };

  const formatTotalPower = (power: number | null | undefined): string => {
    if (power === null || power === undefined) {
      return 'N/A';
    }
    // Now expects values in thousands
    if (power > 1_000) {
      return (power / 1_000).toFixed(2);
    }
    return power.toFixed(0);
  };

  const formatTotalPowerUnit = (power: number | null | undefined): string => {
    if (power === null || power === undefined) {
      return '';
    }
    // Now expects values in thousands
    if (power > 1_000) {
      return 'k ms²'; // k for Thousands
    }
    return 'ms²';
  };

  return (
    <div className={`p-0.5 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
      <div className={`rounded-[15px] p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="mb-4">
          <h3 className={`text-lg font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>
            Autonomic Activity Diagram
          </h3>
        </div>

        {/* === Two-column layout === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* === COLUMN 1: The Chart === */}
          <div className="h-[31.2rem] [&_svg]:!outline-none [&_svg]:!focus:outline-none [&_*]:!outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, left: 10, bottom: 40 }}
              >
                <defs>
                  {/*
                FIX 1: Changed cy="25%" to cy="20%".
                The box's center is y=96. On a 0-120 axis, this is 20%
                from the top, not 25%. This vertically centers the gradient.

                FIX 2: Changed all gradient "stop" percentages.
                The box's height is 36 (y=78 to y=114). The radius is 18.
                On a 0-120 axis, a radius of 18 is 15% (18 / 120).
                All stops are now based on this 15% radius.
              */}
                  <radialGradient id="bandedGradient" cx="50%" cy="20%" r="75%">
                    {/* Band 1: Green (Radius 0% -> 15%) */}
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="15%" stopColor="#22c55e" />

                    {/* Fade 1: Green to Yellow (15% -> 20%) */}
                    <stop offset="16.25%" stopColor="#3cc85b" />
                    <stop offset="17.5%" stopColor="#8fd252" />
                    <stop offset="18.75%" stopColor="#e2dd4a" />
                    <stop offset="20%" stopColor="#fde047" />

                    {/* Band 2: Yellow (20% -> 35%) */}
                    <stop offset="35%" stopColor="#fde047" />

                    {/* Fade 2: Yellow to Light Red (35% -> 40%) */}
                    <stop offset="36.25%" stopColor="#fbcd47" />
                    <stop offset="37.5%" stopColor="#f69246" />
                    <stop offset="38.75%" stopColor="#f15744" />
                    <stop offset="40%" stopColor="#ef4444" />

                    {/* Band 3: Light Red (40% -> 60%) */}
                    <stop offset="60%" stopColor="#ef4444" />

                    {/* Fade 3: Light Red to Dark Red (60% -> 65%) */}
                    <stop offset="61.25%" stopColor="#e83f3f" />
                    <stop offset="62.5%" stopColor="#d43030" />
                    <stop offset="63.75%" stopColor="#c02121" />
                    <stop offset="65%" stopColor="#b91c1c" />

                    {/* Band 4: Dark Red (65% -> 100%) */}
                    <stop offset="100%" stopColor="#b91c1c" />
                  </radialGradient>
                </defs>

                {/* === ALL REMAINING CODE IS IDENTICAL === */}

                <ReferenceArea
                  x1={AUTONOMIC_BALANCE_DOMAIN[0]}
                  x2={AUTONOMIC_BALANCE_DOMAIN[1]}
                  y1={AUTONOMIC_ACTIVITY_DOMAIN[0]}
                  y2={AUTONOMIC_ACTIVITY_DOMAIN[1]}
                  fill="url(#bandedGradient)"
                  fillOpacity={1}
                  strokeWidth={0}
                />

                <XAxis
                  type="number"
                  dataKey="balance"
                  axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                  tickLine={{ stroke: '#000000', strokeWidth: 1 }}
                  domain={AUTONOMIC_BALANCE_DOMAIN as [number, number]}
                  ticks={[0, 25, 50, 75, 100, 125, 150, 175, 200]}
                  tick={<CustomXAxisTick />}
                  height={50}
                >
                  <Label
                    value="Autonomic Balance"
                    position="insideBottom"
                    offset={-40}
                    style={{ fill: '#475569', fontSize: 12 }}
                  />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="activity"
                  axisLine={{ stroke: '#000000', strokeWidth: 2 }}
                  tickLine={{ stroke: '#000000', strokeWidth: 1 }}
                  domain={AUTONOMIC_ACTIVITY_DOMAIN as [number, number]}
                  ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    // Only render labels for major ticks (multiples of 20)
                    if (payload.value % 20 === 0) {
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={4} textAnchor="end" fill="#475569" fontSize={11}>
                            {payload.value}
                          </text>
                        </g>
                      );
                    }
                    // Return empty g for minor ticks (10, 30, 50...)
                    return <g transform={`translate(${x},${y})`} />;
                  }}
                >
                  <Label
                    value="Autonomic Activity"
                    angle={-90}
                    position="insideLeft"
                    style={{ textAnchor: 'middle', fill: '#475569', fontSize: 12 }}
                  />
                </YAxis>

                {/* --- Tooltip: Disabled "fly-in" animation --- */}
                <RechartsTooltip
                  isAnimationActive={false}
                  content={renderTooltip}
                  cursor={{ strokeDasharray: '3 3' }}
                />

                <ReferenceLine x={100} stroke="#000000" strokeWidth={0.5} />
                <ReferenceLine y={68} stroke="#000000" strokeWidth={0.5} />

                {/* === Dashed Box: Made narrower (80 to 120) to fit the oval gradient === */}
                <ReferenceArea
                  x1={75}
                  x2={125}
                  y1={80}
                  y2={112}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                />

                {/* Zone Text Labels (Z1-Z5) */}
                <ReferenceArea x1={20} x2={30} y1={110} y2={120} fill="none" stroke="none"
                  label={{ value: 'Z1', fill: '#fff', fontSize: 14, fontWeight: 'bold', position: 'inside' }} />
                <ReferenceArea x1={170} x2={180} y1={110} y2={120} fill="none" stroke="none"
                  label={{ value: 'Z2', fill: '#fff', fontSize: 14, fontWeight: 'bold', position: 'inside' }} />
                <ReferenceArea x1={20} x2={30} y1={10} y2={20} fill="none" stroke="none"
                  label={{ value: 'Z3', fill: '#fff', fontSize: 14, fontWeight: 'bold', position: 'inside' }} />
                <ReferenceArea x1={170} x2={180} y1={10} y2={20} fill="none" stroke="none"
                  label={{ value: 'Z4', fill: '#fff', fontSize: 14, fontWeight: 'bold', position: 'inside' }} />
                <ReferenceArea x1={95} x2={105} y1={90} y2={100} fill="none" stroke="none"
                  label={{ value: 'Z5', fill: '#000', fontSize: 14, fontWeight: 'bold', position: 'inside' }} />


                {/* === DATA POINTS === */}

                {/* Historical sessions */}
                {historicalPoints.length > 0 && (
                  <Scatter
                    name="Historical"
                    data={historicalPoints}
                  >
                    {historicalPoints.map((_, index) => (
                      <Cell
                        key={`historical-${index}`}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={1}
                        fillOpacity={0.7}
                      />
                    ))}
                  </Scatter>
                )}

                {/* Current session */}
                {currentPoint && (
                  <Scatter
                    name="Current"
                    data={[currentPoint]}
                    shape="circle"
                  >
                    <Cell
                      key="current"
                      fill="#ffffff"
                      stroke="#000000"
                      strokeWidth={2}
                      radius={6}
                    />
                  </Scatter>
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* === COLUMN 2: The New Details Panel === */}
          <div className="space-y-6">

            {/* --- Section 1: Session Analysis --- */}
            <div>
              <h4 className={`text-base font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                Session Analysis
              </h4>
              <StatusCard zone={zone} darkMode={darkMode} />
            </div>

            {/* --- Section 2: Key Metrics --- */}
            <div>
              <h4 className={`text-base font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                Key Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  title="Balance Index (X)"
                  value={currentPoint?.balance ?? 'N/A'}
                  unit="Index"
                  icon={Icons.Balance}
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Activity Index (Y)"
                  value={currentPoint?.activity ?? 'N/A'}
                  unit="Index"
                  icon={Icons.Activity}
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Raw SD2/SD1 Ratio"
                  value={currentPoint?.ratio?.toFixed(4) ?? 'N/A'}
                  unit=""
                  icon={Icons.Ratio}
                  borderColor="border-slate-200"
                  darkMode={darkMode}
                />
                <MetricCard
                  title="Raw Total Power"
                  value={formatTotalPower(currentPoint?.totalPower)}
                  unit={formatTotalPowerUnit(currentPoint?.totalPower)}
                  icon={Icons.Power}
                  borderColor="border-slate-200"
                  darkMode={darkMode}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AutonomicBalanceChart);
