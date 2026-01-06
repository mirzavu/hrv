import React, { useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ComposedChart,
    Bar,
    Line,
    ReferenceArea,
    Cell
} from 'recharts';
import {
    Activity,
    Zap,
    Brain,
    Heart,
    Focus,
    X,
    TrendingUp,
    TrendingDown,
    Calendar,
    Share2,
    Loader2,
    AlertCircle,
    Eye,
    Wind,
    Info
} from 'lucide-react';

// --- Types ---

interface WeeklyDataPoint {
    date: string;
    name: string;
    // 0-100 Scores
    score: number | null; 
    energy: number | null;
    stress: number | null;
    health: number | null;
    focus: number | null;
    readiness: number | null;
    // Biometrics
    rmssd: number | null;
    rmssdAvg: number | null;
    rmssdMin: number | null;
    rmssdMax: number | null;
    hr: number | null;
    hrAvg: number | null;
    hrMin: number | null;
    hrMax: number | null;
}

interface WeeklyStats {
    // Averages for the 5 Scores
    avgScore: number;
    avgEnergy: number;
    avgStress: number;
    avgHealth: number;
    avgFocus: number;
    
    // Changes for 5 Scores (Percentage points)
    changeScore: number;
    changeEnergy: number;
    changeStress: number;
    changeHealth: number;
    changeFocus: number;

    // Biometric Stats
    avgReadiness: number;
    changeReadiness: number;
    
    weeklyCV: number; // Stability
    changeCV: number;

    avgHR: number;
    avgRMSSD: number;
    trend: 'improving' | 'declining' | 'stable';
    insightTitle: string;
    insightText: string;
}

interface WeeklyRecoveryReportProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
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

const WeeklyRecoveryReport: React.FC<WeeklyRecoveryReportProps> = ({ isOpen, onClose, userId }) => {
    // View States
    const [scoreView, setScoreView] = useState<'body' | 'mind'>('body');
    const [deepDiveTab, setDeepDiveTab] = useState<'readiness' | 'rmssd' | 'hr'>('readiness');
    
    // Data States
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyDataPoint[]>([]);
    const [stats, setStats] = useState<WeeklyStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [usagePhase, setUsagePhase] = useState<'calibration' | 'early_baseline' | 'full_baseline' | null>(null);
    const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null);

    useEffect(() => {
        if (isOpen && userId) {
            fetchData();
        }
    }, [isOpen, userId]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/trends/weekly?userId=${userId}`);
            if (!response.ok) throw new Error('Failed to fetch weekly data');
            const result = await response.json();
            if (result.error) {
                setData(result.data || []);
                setStats(result.stats || null);
                setError(result.error);
                setUsagePhase(result.usage_phase || null);
                setWeekRange(result.weekRange || null);
                return;
            }
            setData(result.data);
            setStats(result.stats);
            setUsagePhase(result.usage_phase || null);
            setWeekRange(result.weekRange || null);
        } catch (err) {
            setError('Could not load report data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // --- Helper for Deep Dive Chart Configuration ---
    const getDeepDiveConfig = () => {
        switch (deepDiveTab) {
            case 'readiness':
                return {
                    dataKey: 'readiness',
                    avgKey: null,
                    minKey: null,
                    maxKey: null,
                    color: '#4f46e5',
                    label: 'Readiness',
                    unit: '/100'
                };
            case 'rmssd':
                return {
                    dataKey: 'rmssd',
                    avgKey: 'rmssdAvg',
                    minKey: 'rmssdMin',
                    maxKey: 'rmssdMax',
                    color: '#10b981',
                    label: 'RMSSD',
                    unit: 'ms'
                };
            case 'hr':
                return {
                    dataKey: 'hr',
                    avgKey: 'hrAvg',
                    minKey: 'hrMin',
                    maxKey: 'hrMax',
                    color: '#ef4444',
                    label: 'Resting HR',
                    unit: 'bpm'
                };
        }
    };
    const ddConfig = getDeepDiveConfig();

    // Format week range for display
    const formatWeekRange = () => {
        if (!weekRange) return '';
        try {
            const start = new Date(weekRange.start);
            const end = new Date(weekRange.end);
            const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return `${startStr} - ${endStr}`;
        } catch {
            return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200 font-sans">
            <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
                
                {/* --- Header --- */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                                Weekly Report
                            </h2>
                            {usagePhase === 'calibration' && (
                                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-amber-500 text-white rounded-full">
                                    Calibration
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm mt-0.5 font-medium">
                            <Calendar size={14} />
                            <span>{formatWeekRange() || 'Loading...'}</span>
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
                            <p className="font-medium animate-pulse">Analyzing biometrics...</p>
                        </div>
                    ) : error || !data || data.length === 0 ? (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-slate-400 gap-3">
                            <AlertCircle size={40} className="text-slate-300" />
                            <p className="font-medium">{error || 'No data available for this week'}</p>
                            {error && (
                                <button onClick={fetchData} className="text-sm underline hover:text-slate-600">Try Again</button>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-5xl mx-auto">
                            
                            {/* SECTION 1: The 5 Scores (Selling Terms) */}
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
                                    />
                                ))}
                            </div>

                            {/* SECTION 2: Body vs Mind Overview */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                    <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                                        <button
                                            onClick={() => setScoreView('body')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                                scoreView === 'body' 
                                                ? 'bg-white text-slate-900 shadow-sm' 
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <Heart size={14} className={scoreView === 'body' ? 'text-rose-500' : ''} />
                                            Body
                                        </button>
                                        <button
                                            onClick={() => setScoreView('mind')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                                scoreView === 'mind' 
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
                                        <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                {Object.entries(METRICS).map(([key, config]) => (
                                                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={config.color} stopOpacity={0.2}/>
                                                        <stop offset="95%" stopColor={config.color} stopOpacity={0}/>
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
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
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                {/* 3A: The Chart Panel */}
                                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Activity size={18} className="text-slate-400" />
                                            Physiological Trends
                                        </h3>
                                        
                                        {/* Tabs */}
                                        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                                            {(['readiness', 'rmssd', 'hr'] as const).map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setDeepDiveTab(tab)}
                                                    className={`px-3 py-1.5 rounded-md text-[11px] uppercase font-bold tracking-wide transition-all ${
                                                        deepDiveTab === tab
                                                            ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                                            : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {tab === 'rmssd' ? 'HRV' : tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                                                <YAxis 
                                                    domain={['dataMin - 5', 'dataMax + 5']} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: '#f8fafc' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-xl">
                                                                    <div className="font-bold mb-1">{d.name}</div>
                                                                    <div>Value: {d[ddConfig.dataKey]}</div>
                                                                    {ddConfig.avgKey && <div className="text-slate-400">7d Avg: {Math.round(d[ddConfig.avgKey])}</div>}
                                                                </div>
                                                            )
                                                        }
                                                        return null;
                                                    }}
                                                />

                                                {/* Normal Range Area */}
                                                {ddConfig.minKey && ddConfig.maxKey && data.length > 0 && (
                                                    <ReferenceArea 
                                                        y1={data[0][ddConfig.minKey as keyof WeeklyDataPoint] as number} 
                                                        y2={data[0][ddConfig.maxKey as keyof WeeklyDataPoint] as number} 
                                                        fill={ddConfig.color} 
                                                        fillOpacity={0.05} 
                                                    />
                                                )}

                                                <Bar dataKey={ddConfig.dataKey} barSize={20} radius={[4, 4, 0, 0]}>
                                                    {data.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={ddConfig.color} fillOpacity={0.2} />
                                                    ))}
                                                </Bar>
                                                
                                                {ddConfig.avgKey && (
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey={ddConfig.avgKey} 
                                                        stroke={ddConfig.color} 
                                                        strokeWidth={3} 
                                                        dot={false} 
                                                    />
                                                )}
                                                {!ddConfig.avgKey && (
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey={ddConfig.dataKey} 
                                                        stroke={ddConfig.color} 
                                                        strokeWidth={3} 
                                                        dot={{r: 3, fill: ddConfig.color}}
                                                    />
                                                )}
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex justify-center mt-4 gap-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-sm opacity-20" style={{ backgroundColor: ddConfig.color }}></div>
                                            Daily
                                        </div>
                                        {ddConfig.avgKey && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-0.5" style={{ backgroundColor: ddConfig.color }}></div>
                                                7-Day Avg
                                            </div>
                                        )}
                                        {ddConfig.minKey && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-sm opacity-5" style={{ backgroundColor: ddConfig.color }}></div>
                                                Normal Range
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3B: Stability & Readiness Stats */}
                                <div className="space-y-4">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-[48%] group">
                                        <div className="flex justify-between items-start z-10">
                                            <span className="text-indigo-900/60 text-xs font-bold uppercase tracking-wider">Weekly Readiness</span>
                                            <Zap size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="z-10 mt-2">
                                            <div className="flex items-baseline">
                                                <span className="text-4xl font-black text-indigo-900">{stats?.avgReadiness}</span>
                                                <span className="text-indigo-900/40 text-sm font-bold ml-1">/ 100</span>
                                            </div>
                                            <ChangeBadge change={stats?.changeReadiness || 0} />
                                        </div>
                                        <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-indigo-600 transition-transform duration-500 group-hover:scale-110">
                                            <Zap size={100} />
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-[48%] group">
                                        <div className="flex justify-between items-start z-10">
                                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Stability (CV)</span>
                                            {stats?.weeklyCV && stats.weeklyCV < 10 ? (
                                                <TrendingDown size={16} className="text-emerald-500" />
                                            ) : (
                                                <TrendingUp size={16} className="text-rose-500" />
                                            )}
                                        </div>
                                        <div className="z-10 mt-2">
                                            <span className={`text-4xl font-black ${stats?.weeklyCV && stats.weeklyCV > 10 ? 'text-rose-500' : 'text-slate-900'}`}>
                                                {stats?.weeklyCV}%
                                            </span>
                                            <div className="mt-1">
                                                <ChangeBadge change={stats?.changeCV || 0} inverse={true} />
                                            </div>
                                        </div>
                                        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] text-slate-900 transition-transform duration-500 group-hover:scale-110">
                                            <Activity size={100} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 4: Trend & Insight (Requested Style) */}
                            <div className="bg-white border-x border-b border-slate-200 rounded-3xl p-2 shadow-sm">
                                <div className="bg-slate-50 rounded-[2rem] p-6 lg:p-10 flex flex-col items-center text-center relative overflow-hidden border border-slate-100">
                                    {/* Background Icon */}
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none text-slate-900">
                                        <Wind size={160} />
                                    </div>
                                    
                                    {/* Badge */}
                                    <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full shadow-xl shadow-slate-200 mb-6 z-10">
                                        <Wind size={16} strokeWidth={2.5} />
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">Analysis Protocol</span>
                                    </div>
                                    
                                    {/* Title */}
                                    <p className="text-slate-900 text-xl md:text-3xl font-black tracking-tight leading-tight mb-4 max-w-2xl z-10">
                                        {stats?.insightTitle || "Data Processing..."}
                                    </p>
                                    
                                    {/* Divider */}
                                    <div className="w-16 h-1.5 bg-indigo-500 rounded-full mb-4 opacity-20"></div>
                                    
                                    {/* Body Text */}
                                    <p className="text-slate-500 text-sm md:text-lg font-medium leading-relaxed max-w-3xl z-10">
                                        {stats?.insightText || "Gathering sufficient biometric data to generate actionable insights."}
                                    </p>
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

const ChangeBadge: React.FC<{ change: number, inverse?: boolean }> = ({ change, inverse = false }) => {
    const isPositive = change > 0;
    const isNeutral = change === 0;
    
    const isGood = inverse ? !isPositive : isPositive;
    
    const colorClass = isNeutral ? 'text-slate-400' : (isGood ? 'text-emerald-500' : 'text-rose-500');
    const Icon = isPositive ? TrendingUp : TrendingDown;

    if (isNeutral) return <span className="text-xs font-bold text-slate-400">- No Change</span>;

    return (
        <div className={`flex items-center text-xs font-bold ${colorClass} mt-1`}>
            <Icon size={14} className="mr-1" />
            <span>{Math.abs(change)}%</span>
        </div>
    );
}

const ScoreCard: React.FC<{ metricKey: MetricKey, value: number, change: number }> = ({ metricKey, value, change }) => {
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
                <ChangeBadge change={change} inverse={isInverse} />
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
                <p className="text-slate-400 font-bold uppercase tracking-wider mb-2">{d.name}</p>
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

export default WeeklyRecoveryReport;
