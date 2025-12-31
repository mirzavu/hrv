import React, { useEffect, useState } from 'react';
import {
    X,
    Activity,
    Calendar,
    AlertCircle,
    Loader2,
    Heart,
    Brain,
    Zap,
    Scale
} from 'lucide-react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from 'recharts';

interface MonthlyAnalysisReportProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    currentMonth?: Date; // Context for which month to load
}

interface WeeklyDataPoint {
    label: string; // "Week 1", "Week 2"
    startDate: string;
    endDate: string;
    rmssd: number;
    rmssdRolling: number;
    sdnn: number;
    sdnnRolling: number; // Baseline line
    hfnu: number;
    stressRatio: number; // SD2/SD1
    score: number;
    scoreRolling: number;
    hasData: boolean;
}

interface MonthlyStats {
    monthlyCV: number;
    sessionCount: number;
    avgRMSSD: number;
}

const MonthlyAnalysisReport: React.FC<MonthlyAnalysisReportProps> = ({
    isOpen,
    onClose,
    userId,
    currentMonth = new Date()
}) => {
    // Tabs: Score, Recovery (RMSSD), Resilience (SDNN), Stress (Ratio), Vagal (HFnu)
    const [activeTab, setActiveTab] = useState<'score' | 'adaptation' | 'resilience' | 'balance' | 'vagal'>('score');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyDataPoint[]>([]);
    const [stats, setStats] = useState<MonthlyStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    // const monthStr = currentMonth.toISOString().slice(0, 7); // Buggy with timezones
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
                setData(result.weeks || []); // Fallback
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

    // Helper for rendering charts based on activeTab
    const renderChart = () => {
        // Common components to reduce boilerplate
        const CommonAxes = ({ yLabel, domain }: { yLabel: string, domain?: [number, number] }) => (
            <>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    domain={domain}
                    label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
            </>
        );

        switch (activeTab) {
            case 'score':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CommonAxes yLabel="Score /100" domain={[0, 100]} />
                            <Bar dataKey="score" name="Avg Score" barSize={32} radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#d97706" fillOpacity={0.8} />
                                ))}
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="scoreRolling"
                                name="30d Baseline"
                                stroke="#78350f"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 5"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'adaptation':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CommonAxes yLabel="RMSSD (ms)" />
                            <Bar dataKey="rmssd" name="Weekly RMSSD" barSize={32} radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#059669" fillOpacity={0.8} />
                                ))}
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="rmssdRolling"
                                name="30d Baseline"
                                stroke="#64748b"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 5"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'resilience':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CommonAxes yLabel="SDNN (ms)" />
                            <Bar dataKey="sdnn" name="Weekly SDNN" barSize={32} radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#3b82f6" fillOpacity={0.8} />
                                ))}
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="sdnnRolling"
                                name="30d Baseline"
                                stroke="#1e3a8a"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 5"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'balance': // Stress Ratio
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CommonAxes yLabel="Ratio (Lower is better)" />
                            <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'High Stress', fill: '#ef4444', fontSize: 10 }} />
                            <Bar dataKey="stressRatio" name="Stress Ratio (SD2/SD1)" barSize={32} radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#6366f1" />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'vagal': // HFnu
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CommonAxes yLabel="HF Norm (%)" domain={[0, 100]} />
                            <Bar dataKey="hfnu" name="Vagal Tone (HFnu)" barSize={32} radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#8b5cf6" />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            default:
                return null;
        }
    };

    const getInsightText = () => {
        const _count = stats?.sessionCount || 0;
        switch (activeTab) {
            case 'score': return `Overall wellness trend. Staying close to or above the dashed line indicates positive adaptation.`;
            case 'adaptation': return `Parasympathetic recovery. Higher RMSSD generally means better recovery.`;
            case 'resilience': return `Total variability (SDNN). Higher values suggest better overall health and resilience to stress.`;
            case 'balance': return `Sympathetic vs Parasympathetic balance. Ratios > 3.0 indicate dominance of stress systems.`;
            case 'vagal': return `Pure vagal tone (Normalized HF). Higher percentages indicate strong recovery system activation.`;
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans text-slate-800 animate-in fade-in duration-200">
            <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                            <Calendar className="text-indigo-600" size={24} />
                            Monthly Analysis
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium">{monthLabel} • {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <Loader2 className="animate-spin" size={32} />
                        <p className="font-medium text-sm">Analyzing {monthLabel} trends...</p>
                    </div>
                ) : error ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4 text-rose-500">
                        <AlertCircle size={32} />
                        <p className="font-medium">{error}</p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">

                        {/* Stats Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Monthly CV */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                <span className="text-slate-500 font-semibold text-sm flex items-center gap-2">
                                    <Activity size={16} /> Monthly Variance (CV)
                                </span>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">{stats?.monthlyCV}%</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {stats?.monthlyCV && stats.monthlyCV > 15 ? 'High variation. Unstable.' : 'Stable baseline.'}
                                </p>
                            </div>

                            {/* Avg RMSSD */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                <span className="text-slate-500 font-semibold text-sm flex items-center gap-2">
                                    <Heart size={16} /> Avg RMSSD
                                </span>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">{stats?.avgRMSSD}</span>
                                    <span className="text-sm font-medium text-slate-400">ms</span>
                                </div>
                            </div>

                            {/* Insight Tile */}
                            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold text-sm">
                                    <Brain size={16} />
                                    <span>Analysis Insight</span>
                                </div>
                                <p className="text-slate-700 text-xs leading-relaxed font-medium">
                                    Based on {stats?.sessionCount} sessions. {getInsightText()}
                                </p>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm min-h-[400px]">
                            {/* Controls */}
                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                                <button
                                    onClick={() => setActiveTab('score')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'score' ? 'bg-amber-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <Activity size={14} /> HRV Score
                                </button>
                                <button
                                    onClick={() => setActiveTab('adaptation')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'adaptation' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    Adaptation (RMSSD)
                                </button>
                                <button
                                    onClick={() => setActiveTab('resilience')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'resilience' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <Zap size={14} /> Resilience (SDNN)
                                </button>
                                <button
                                    onClick={() => setActiveTab('balance')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'balance' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    <Scale size={14} /> Stress
                                </button>
                                <button
                                    onClick={() => setActiveTab('vagal')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'vagal' ? 'bg-violet-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    Vagal (HFnu)
                                </button>
                            </div>

                            <div className="h-[300px]">
                                {renderChart()}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default MonthlyAnalysisReport;
