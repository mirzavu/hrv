import React, { useEffect, useState, useRef } from 'react';
import {
    X,
    Activity,
    Calendar,
    AlertCircle,
    Loader2,
    Heart,
    Brain,
    Zap,
    Eye,
    Info,
    TrendingUp,
    TrendingDown,
    Sparkles,
    Wind
} from 'lucide-react';
import {
    AreaChart,
    Area,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

// --- Types ---

interface WeeklyDataPoint {
    label: string; // "1", "2", "3", etc. (day numbers)
    startDate: string;
    endDate: string;

    // Core Metrics for Deep Dive
    rmssd: number;
    rmssdRolling: number;
    hfnu: number;
    score: number;
    scoreRolling: number;

    // Additional Metrics for Body/Mind Chart
    energy: number;
    stress: number;
    health: number;
    focus: number;

    // Resting HR for Balance chart
    restingHR: number;

    // Flag to indicate if this week has actual data
    hasData?: boolean;
}

interface MonthlyStats {
    monthlyCV: number;
    sessionCount: number;
    avgRMSSD: number;

    // Top Score Averages
    avgScore: number;
    avgEnergy: number;
    avgStress: number;
    avgHealth: number;
    avgFocus: number;

    // Changes (Percentage points)
    changeScore: number;
    changeEnergy: number;
    changeStress: number;
    changeHealth: number;
    changeFocus: number;

    insightTitle?: string;
    insightObservation?: string;
    insightAction?: string;
    avgRestingHR: number;
}

interface MonthlyAnalysisReportProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    currentMonth?: Date;
}

// --- Configuration ---

const METRICS = {
    hrv: { label: 'HRV Score', color: '#14b8a6', icon: Activity, key: 'score' },
    energy: { label: 'Energy', color: '#f59e0b', icon: Zap, key: 'energy' },
    health: { label: 'Health', color: '#10b981', icon: Heart, key: 'health' },
    stress: { label: 'Stress', color: '#8b5cf6', icon: Brain, key: 'stress' },
    focus: { label: 'Focus', color: '#3b82f6', icon: Eye, key: 'focus' },
};

type MetricKey = keyof typeof METRICS;

const MonthlyAnalysisReport: React.FC<MonthlyAnalysisReportProps> = ({
    isOpen,
    onClose,
    userId,
    currentMonth = new Date()
}) => {
    // View States
    const [scoreView, setScoreView] = useState<'body' | 'mind'>('body');
    const [deepDiveTab, setDeepDiveTab] = useState<'score' | 'rmssd' | 'vagal' | 'balance'>('score');

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyDataPoint[]>([]);
    const [stats, setStats] = useState<MonthlyStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    useEffect(() => {
        if (isOpen && userId) {
            fetchData();
        }
    }, [isOpen, userId, monthStr]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/trends/monthly?userId=${userId}&month=${monthStr}`);
            if (!response.ok) throw new Error('Failed to fetch monthly data');
            const result = await response.json();

            if (result.error) {
                setError(result.error);
                setData(result.weeks || []);
                setStats(result.stats || null);
            } else {
                setData(result.weeks);
                setStats(result.stats);
            }
        } catch (err) {
            setError('Could not load monthly report.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Helper for Deep Dive Chart Configuration
    const getDeepDiveConfig = () => {
        switch (deepDiveTab) {
            case 'score':
                return {
                    dataKey: 'score',
                    baselineKey: 'scoreRolling',
                    color: '#14b8a6', // Teal
                    label: 'HRV Score',
                    unit: '/100',
                    info: "Your overall wellness score based on HRV and biometrics."
                };
            case 'rmssd':
                return {
                    dataKey: 'rmssd',
                    baselineKey: 'rmssdRolling',
                    color: '#10b981', // Emerald
                    label: 'RMSSD',
                    unit: 'ms',
                    info: "Root Mean Square of Successive Differences. A primary measure of recovery."
                };
            case 'vagal':
                return {
                    dataKey: 'hfnu',
                    baselineKey: null,
                    color: '#8b5cf6', // Violet
                    label: 'Vagal Tone',
                    unit: 'HFnu',
                    info: "Indicates the \"rest and digest\" system is dominant or suppressed.",
                    isDualAxis: false
                };
            case 'balance':
                return {
                    dataKey: 'score',
                    secondaryDataKey: 'restingHR',
                    baselineKey: null,
                    color: '#14b8a6', // Teal for HRV
                    secondaryColor: '#ef4444', // Red for HR
                    label: 'HRV vs HR Balance',
                    unit: '',
                    info: "Compares HRV Score against Resting HR. A 'cross-over' (HR rising + HRV falling) signals potential burnout.",
                    isDualAxis: true
                };
        }
    };
    const ddConfig = getDeepDiveConfig();

    // Filter out days without data to prevent graphs from showing 0 values
    const dataWithValues = data.filter(day => day.hasData === true);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200 font-sans">
            <div className="bg-white w-full max-w-6xl rounded-[32px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

                {/* --- Header --- */}
                <div className="relative z-10 bg-white border-b border-stone-100 p-4 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-stone-800 flex items-center gap-2">
                            Monthly Analysis
                        </h2>
                        <div className="flex items-center gap-2 text-stone-500 text-xs md:text-sm mt-0.5 font-medium">
                            <Calendar size={14} />
                            <span>{monthLabel}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* --- Scrollable Content --- */}
                <div className="overflow-y-auto flex-1 custom-scrollbar bg-[#f8fafc]">
                    {loading ? (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="animate-spin text-indigo-600" size={40} />
                            <p className="font-medium animate-pulse">Analyzing monthly trends...</p>
                        </div>
                    ) : error ? (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-rose-500 gap-3">
                            <AlertCircle size={40} />
                            <p className="font-medium">{error}</p>
                        </div>
                    ) : (
                        <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-6xl mx-auto">

                            {/* SECTION 1: The 5 Scores */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                    { key: 'energy', val: stats?.avgEnergy, chg: stats?.changeEnergy },
                                    { key: 'stress', val: stats?.avgStress, chg: stats?.changeStress },
                                    { key: 'health', val: stats?.avgHealth, chg: stats?.changeHealth },
                                    { key: 'focus', val: stats?.avgFocus, chg: stats?.changeFocus },
                                    { key: 'hrv', val: stats?.avgScore, chg: stats?.changeScore },
                                ].map((item) => (
                                    <ScoreCard
                                        key={item.key}
                                        metricKey={item.key as MetricKey}
                                        value={item.val || 0}
                                        change={item.chg || 0}
                                        showChange={dataWithValues.length >= 2}
                                    />
                                ))}
                            </div>

                            {/* SECTION 2: Body vs Mind Overview */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                                        <button
                                            onClick={() => setScoreView('body')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${scoreView === 'body'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Heart size={14} className={scoreView === 'body' ? 'text-rose-500' : ''} />
                                            Body
                                        </button>
                                        <button
                                            onClick={() => setScoreView('mind')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${scoreView === 'mind'
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Brain size={14} className={scoreView === 'mind' ? 'text-violet-500' : ''} />
                                            Mind
                                        </button>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-wrap gap-4 text-[10px] uppercase font-bold text-slate-500 tracking-wide">
                                        {scoreView === 'body' ? (
                                            <>
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Energy</div>
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Health</div>
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500"></div>HRV Score</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500"></div>Stress</div>
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Focus</div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dataWithValues} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                {Object.entries(METRICS).map(([key, config]) => (
                                                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                                            <Tooltip content={<CustomTooltip />} />

                                            {scoreView === 'body' ? (
                                                <>
                                                    <Area type="monotone" dataKey="energy" stroke={METRICS.energy.color} fill={`url(#grad-energy)`} strokeWidth={2} />
                                                    <Area type="monotone" dataKey="health" stroke={METRICS.health.color} fill={`url(#grad-health)`} strokeWidth={2} />
                                                    <Area type="monotone" dataKey="score" stroke={METRICS.hrv.color} fill={`url(#grad-hrv)`} strokeWidth={2} />
                                                </>
                                            ) : (
                                                <>
                                                    <Area type="monotone" dataKey="stress" stroke={METRICS.stress.color} fill={`url(#grad-stress)`} strokeWidth={2} />
                                                    <Area type="monotone" dataKey="focus" stroke={METRICS.focus.color} fill={`url(#grad-focus)`} strokeWidth={2} />
                                                </>
                                            )}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* SECTION 3: Biometrics Deep Dive */}
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                                {/* 3A: The Chart Panel */}
                                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative group">

                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <Activity size={18} className="text-slate-400" />
                                                Deep Dive
                                            </h3>
                                            <InfoPopover
                                                title={ddConfig.label}
                                                description={ddConfig.info}
                                                isAbsolute={false}
                                                align="left"
                                            />
                                        </div>

                                        {/* Tabs */}
                                        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            {(['score', 'rmssd', 'vagal', 'balance'] as const).map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setDeepDiveTab(tab)}
                                                    className={`px-3 py-1.5 rounded-md text-[11px] uppercase font-bold tracking-wide transition-all ${deepDiveTab === tab
                                                        ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {tab === 'score' ? 'HRV' : tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={dataWithValues} margin={{ top: 10, right: ddConfig.isDualAxis ? 20 : 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                                                <YAxis
                                                    yAxisId="left"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: ddConfig.isDualAxis ? '#14b8a6' : '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                                    domain={ddConfig.isDualAxis ? [0, 100] : ['auto', 'auto']}
                                                />
                                                {ddConfig.isDualAxis && (
                                                    <YAxis
                                                        yAxisId="right"
                                                        orientation="right"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#ef4444', fontSize: 11, fontWeight: 600 }}
                                                        domain={['dataMin - 5', 'dataMax + 5']}
                                                        tickFormatter={(value) => `${value}`}
                                                    />
                                                )}
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl">
                                                                    <div className="font-bold mb-1">{d.label}</div>
                                                                    {ddConfig.isDualAxis ? (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#14b8a6' }}></div>
                                                                                <span>HRV Score: {d.score}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                                                                                <span>Resting HR: {d.restingHR} bpm</span>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div>{ddConfig.label}: {d[ddConfig.dataKey as keyof WeeklyDataPoint]}</div>
                                                                            {ddConfig.baselineKey && <div className="text-slate-400">Baseline: {d[ddConfig.baselineKey as keyof WeeklyDataPoint]}</div>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )
                                                        }
                                                        return null;
                                                    }}
                                                />

                                                <Bar dataKey={ddConfig.dataKey} barSize={24} radius={[4, 4, 0, 0]} yAxisId="left">
                                                    {dataWithValues.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={ddConfig.color} fillOpacity={0.3} />
                                                    ))}
                                                </Bar>

                                                {ddConfig.isDualAxis && ddConfig.secondaryDataKey && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey={ddConfig.secondaryDataKey}
                                                        stroke={ddConfig.secondaryColor}
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: ddConfig.secondaryColor }}
                                                        yAxisId="right"
                                                    />
                                                )}

                                                {!ddConfig.isDualAxis && ddConfig.baselineKey && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey={ddConfig.baselineKey}
                                                        stroke={ddConfig.color}
                                                        strokeWidth={3}
                                                        dot={false}
                                                        strokeDasharray="4 4"
                                                        yAxisId="left"
                                                    />
                                                )}
                                                {!ddConfig.isDualAxis && !ddConfig.baselineKey && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey={ddConfig.dataKey}
                                                        stroke={ddConfig.color}
                                                        strokeWidth={3}
                                                        dot={{ r: 3, fill: ddConfig.color }}
                                                        yAxisId="left"
                                                    />
                                                )}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-center mt-4 gap-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                        {ddConfig.isDualAxis ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: '#14b8a6' }}></div>
                                                    HRV Score
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                                                    Resting HR
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: ddConfig.color }}></div>
                                                    Daily Avg
                                                </div>
                                                {ddConfig.baselineKey && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-0.5" style={{ backgroundColor: ddConfig.color }}></div>
                                                        30d Baseline
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 3B: Stability & Readiness Stats */}
                                <div className="space-y-4">

                                    {/* READINESS / AVG RMSSD CARD */}
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 relative flex flex-col justify-between h-[48%] group">
                                        <InfoPopover
                                            title="Avg RMSSD"
                                            description="Higher average RMSSD suggests better overall recovery and adaptation."
                                        />
                                        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                                            <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-indigo-600 transition-transform duration-500 group-hover:scale-110">
                                                <Zap size={100} />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-start z-10 relative">
                                            <span className="text-indigo-900/60 text-xs font-bold uppercase tracking-wider">Avg RMSSD</span>
                                        </div>
                                        <div className="z-10 mt-2 relative">
                                            <div className="flex items-baseline">
                                                <span className="text-4xl font-black text-indigo-900">{stats?.avgRMSSD}</span>
                                                <span className="text-indigo-900/40 text-sm font-bold ml-1">ms</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* STABILITY / CV CARD */}
                                    <div className="bg-white border border-slate-200 rounded-3xl relative flex flex-col justify-between h-[48%] group/card">
                                        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                            <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] text-slate-900 transition-transform duration-500 group-hover/card:scale-110">
                                                <Activity size={100} />
                                            </div>
                                        </div>
                                        <InfoPopover
                                            title="Monthly CV"
                                            description="Coefficient of Variation. Lower is better. <10% indicates stable physiology."
                                        />
                                        <div className="p-6 h-full flex flex-col justify-between relative z-10 pointer-events-none">
                                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Monthly Variance</span>
                                            <div className="mt-2">
                                                <span className={`text-4xl font-black ${stats?.monthlyCV && stats.monthlyCV > 10 ? 'text-rose-500' : 'text-slate-900'}`}>
                                                    {stats?.monthlyCV}%
                                                </span>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-xs text-slate-400 font-bold">
                                                        {stats?.monthlyCV && stats.monthlyCV > 10 ? 'Unstable' : 'Stable'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* SECTION 4: Analysis & Action */}
                            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                                {/* Top: Analysis (Observation) */}
                                <div className="p-8 relative overflow-hidden bg-white">
                                    <div className="z-10 relative">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-slate-100 p-2 rounded-xl text-slate-600">
                                                <Wind size={20} />
                                            </div>
                                            <span className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Analysis Protocol</span>
                                        </div>

                                        <h3 className="text-xl font-black text-slate-900 mb-4 leading-tight">
                                            {stats?.insightTitle || "Monthly Patterns"}
                                        </h3>

                                        <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">
                                            {stats?.insightObservation}
                                        </p>
                                    </div>
                                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                                        <Wind size={200} />
                                    </div>
                                </div>

                                {/* Bottom: Action (Recommendation) */}
                                <div className="bg-indigo-600 p-8 relative overflow-hidden text-white border-t border-indigo-500/30">
                                    <div className="z-10 relative">
                                        <div className="flex items-center gap-2 mb-4 opacity-90">
                                            <Sparkles size={16} className="text-yellow-300" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Recommended Action</span>
                                        </div>
                                        <p className="text-indigo-50 text-sm md:text-base font-medium leading-relaxed">
                                            {stats?.insightAction}
                                        </p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-700 opacity-50 z-0"></div>
                                    <div className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12 z-0">
                                        <Zap size={120} fill="currentColor" />
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Subcomponents ---

interface InfoPopoverProps {
    title: string;
    description: string;
    className?: string;
    isAbsolute?: boolean;
    align?: 'left' | 'right' | 'center';
}

const InfoPopover: React.FC<InfoPopoverProps> = ({
    title,
    description,
    className = "",
    isAbsolute = true,
    align = 'right'
}) => {
    const [showAtBottom, setShowAtBottom] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const positionClass = isAbsolute
        ? (className || "top-4 right-4")
        : (className || "");
    const wrapperClass = `${isAbsolute ? 'absolute' : 'relative'} ${positionClass} z-50 group/info`;

    useEffect(() => {
        const checkPosition = () => {
            if (!buttonRef.current || !popoverRef.current) return;

            const buttonRect = buttonRef.current.getBoundingClientRect();
            const popoverHeight = 200; // Approximate height of popover (w-64 + padding)
            const spaceAbove = buttonRect.top;
            const spaceBelow = window.innerHeight - buttonRect.bottom;

            // If not enough space above but enough space below, show at bottom
            if (spaceAbove < popoverHeight + 20 && spaceBelow >= popoverHeight + 20) {
                setShowAtBottom(true);
            } else {
                setShowAtBottom(false);
            }
        };

        const button = buttonRef.current;
        if (button) {
            button.addEventListener('mouseenter', checkPosition);
            return () => button.removeEventListener('mouseenter', checkPosition);
        }
    }, []);

    let tooltipPos = "";
    let arrowPos = "";
    let popoverPosition = "";
    let arrowPosition = "";

    if (align === 'right') {
        tooltipPos = "right-0";
        arrowPos = "right-3";
        if (showAtBottom) {
            popoverPosition = "top-full mt-3 origin-top-right";
            arrowPosition = "-top-1.5 rotate-45";
        } else {
            popoverPosition = "bottom-full mb-3 origin-bottom-right";
            arrowPosition = "-bottom-1.5 rotate-45";
        }
    } else if (align === 'left') {
        tooltipPos = "left-0";
        arrowPos = "left-3";
        if (showAtBottom) {
            popoverPosition = "top-full mt-3 origin-top-left";
            arrowPosition = "-top-1.5 rotate-45";
        } else {
            popoverPosition = "bottom-full mb-3 origin-bottom-left";
            arrowPosition = "-bottom-1.5 rotate-45";
        }
    } else {
        tooltipPos = "left-1/2 -translate-x-1/2";
        arrowPos = "left-1/2 -translate-x-1/2";
        if (showAtBottom) {
            popoverPosition = "top-full mt-3 origin-top";
            arrowPosition = "-top-1.5 rotate-45";
        } else {
            popoverPosition = "bottom-full mb-3 origin-bottom";
            arrowPosition = "-bottom-1.5 rotate-45";
        }
    }

    return (
        <div className={wrapperClass}>
            <button
                ref={buttonRef}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-2 rounded-full shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-md ring-1 ring-indigo-100 cursor-pointer pointer-events-auto"
            >
                <Info size={16} strokeWidth={2.5} />
            </button>
            <div
                ref={popoverRef}
                className={`absolute ${popoverPosition} ${tooltipPos} w-64 bg-slate-900 text-white text-xs p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 transform scale-95 group-hover/info:scale-100 pointer-events-none z-50`}
            >
                <div className="font-bold mb-2 text-indigo-300 flex items-center gap-2 border-b border-indigo-500/30 pb-2">
                    <Activity size={14} /> {title}
                </div>
                <p className="leading-relaxed text-slate-300">{description}</p>
                <div className={`absolute ${arrowPosition} ${arrowPos} w-3 h-3 bg-slate-900`}></div>
            </div>
        </div>
    );
};

const ChangeBadge: React.FC<{ change: number, inverse?: boolean, showChange?: boolean }> = ({ change, inverse = false, showChange = true }) => {
    if (!showChange) return null;

    const isPositive = change > 0;
    const isNeutral = change === 0;
    const isGood = inverse ? !isPositive : isPositive;
    const colorClass = isNeutral ? 'text-slate-400' : (isGood ? 'text-emerald-500' : 'text-rose-500');
    const Icon = isPositive ? TrendingUp : TrendingDown;

    if (isNeutral) return <span className="text-xs font-bold text-slate-400">- Stable</span>;

    return (
        <div className={`flex items-center text-xs font-bold ${colorClass} mt-1`}>
            <Icon size={14} className="mr-1" />
            <span>{Math.abs(change)}%</span>
        </div>
    );
}

const ScoreCard: React.FC<{ metricKey: MetricKey, value: number, change: number, showChange?: boolean }> = ({ metricKey, value, change, showChange = true }) => {
    const config = METRICS[metricKey];
    const Icon = config.icon;
    const isInverse = metricKey === 'stress';

    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
            <div className="flex justify-between items-start mb-3 z-10">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{config.label}</span>
                <div className="p-1.5 rounded-full bg-slate-50 group-hover:bg-white transition-colors" style={{ color: config.color }}>
                    <Icon size={16} />
                </div>
            </div>
            <div className="flex flex-col z-10">
                <span className="text-3xl font-black text-slate-800 leading-none mb-2">{value}</span>
                <ChangeBadge change={change} inverse={isInverse} showChange={showChange} />
            </div>
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-300 transform rotate-12" style={{ color: config.color }}>
                <Icon size={100} fill="currentColor" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: config.color }}></div>
        </div>
    );
};

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-white/90 backdrop-blur-sm border border-slate-200 p-3 rounded-xl shadow-xl text-xs">
                <p className="text-slate-400 font-bold uppercase tracking-wider mb-2">{d.label}</p>
                <div className="space-y-1">
                    {payload.map((p: any) => (
                        <div key={p.name} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke || p.fill }}></div>
                            <span className="font-semibold text-slate-600 capitalize">{p.name}:</span>
                            <span className="font-bold text-slate-900">{p.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default MonthlyAnalysisReport;
