'use client';

import React, { useState, useEffect } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
    Cell,
} from 'recharts';
import {
    Activity,
    Heart,
    Zap,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    X,
    Info,
    Loader2
} from 'lucide-react';

interface WeeklyDataPoint {
    date: string;
    name: string;
    rmssd: number | null;
    hr: number | null;
    score: number | null;
    rmssdAvg: number | null;
    hrAvg: number | null;
    scoreAvg: number | null;
    rmssdMin: number | null;
    rmssdMax: number | null;
    hrMin: number | null;
    hrMax: number | null;
}

interface WeeklyStats {
    readiness: number;
    weeklyCV: number;
    avgHR: number;
    avgHRV: number;
}

interface WeeklyRecoveryReportProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
}

const WeeklyRecoveryReport: React.FC<WeeklyRecoveryReportProps> = ({ isOpen, onClose, userId }) => {
    const [activeTab, setActiveTab] = useState<'rmssd' | 'hr' | 'score'>('rmssd');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<WeeklyDataPoint[]>([]);
    const [stats, setStats] = useState<WeeklyStats | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                // Instead of throwing, set data to empty but set specific error message
                setData(result.data || []);
                setStats(result.stats || null);
                setError(result.error);
                return;
            }
            setData(result.data);
            setStats(result.stats);
        } catch (err) {
            setError('Could not load report data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Skip rendering if not open
    if (!isOpen) return null;

    // Stats Calculations from API (or defaults)
    const readiness = stats?.readiness ?? 0;
    const weeklyCV = stats?.weeklyCV ?? 0;
    // CV > 10% usually indicates instability/maladaptation in RMSSD
    const isUnstable = weeklyCV > 15; // Threshold adjusted to 15% as per some strict protocols, or 10%
    // Let's use 10-15 as warning, >15 as bad. User specified >10 in demo.
    const isWarning = weeklyCV > 10;

    const currentConfig =
        activeTab === 'rmssd' ? {
            key: 'rmssd',
            avgKey: 'rmssdAvg',
            minKey: 'rmssdMin',
            maxKey: 'rmssdMax',
            label: 'RMSSD (ms)',
            color: '#059669', // Emerald 600
            unit: 'ms'
        } : activeTab === 'hr' ? {
            key: 'hr',
            avgKey: 'hrAvg',
            minKey: 'hrMin',
            maxKey: 'hrMax',
            label: 'Resting HR (bpm)',
            color: '#dc2626', // Red 600
            unit: 'bpm'
        } : {
            key: 'score',
            avgKey: 'scoreAvg',
            minKey: null, // No normal range for score yet
            maxKey: null,
            label: 'HRV Score',
            color: '#d97706', // Amber 600
            unit: '/100'
        };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans text-slate-800 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                            <Activity className="text-emerald-600" size={24} />
                            Weekly Recovery Report
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium">Acute Response View • Last 7 Days</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
                        <Loader2 className="animate-spin" size={32} />
                        <p className="font-medium text-sm">Analyzing your data...</p>
                    </div>
                ) : error ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4 text-rose-500">
                        <AlertCircle size={32} />
                        <p className="font-medium">{error}</p>
                        <button onClick={fetchData} className="text-sm underline hover:text-rose-700">Try Again</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">

                        {/* Top Row: Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Readiness Tile */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <span className="text-slate-500 font-semibold text-sm">Readiness</span>
                                    <Zap size={18} className="text-amber-500 fill-amber-500" />
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-slate-900">{readiness}</span>
                                    <span className="text-slate-400 font-bold">/ 100</span>
                                </div>
                                <div className={`mt-2 text-xs font-bold px-2 py-1 rounded inline-block w-fit ${readiness >= 70 ? 'text-emerald-700 bg-emerald-100' :
                                    readiness >= 50 ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100'
                                    }`}>
                                    {readiness >= 70 ? 'OPTIMAL' : readiness >= 50 ? 'GOOD' : 'RECOVER'}
                                </div>
                                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500 text-slate-900">
                                    <Zap size={100} />
                                </div>
                            </div>

                            {/* Stability Gauge */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-start">
                                    <span className="text-slate-500 font-semibold text-sm">Stability (CV)</span>
                                    <div className="flex items-center gap-1">
                                        {/* Direction Arrow */}
                                        {isWarning ?
                                            <TrendingUp className="text-rose-600" size={18} /> :
                                            <TrendingDown className="text-emerald-600" size={18} />
                                        }
                                    </div>
                                </div>
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className={`text-4xl font-black ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {weeklyCV}%
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                                    {isWarning ? (
                                        <>
                                            <AlertCircle size={14} className="text-rose-600" />
                                            <span className="text-rose-600">Rising: Highly Unstable</span>
                                        </>
                                    ) : (
                                        <span className="text-emerald-700">Consistent: Well Recovered</span>
                                    )}
                                </div>
                            </div>

                            {/* Comparison/Trend Info */}
                            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-2 text-emerald-700 font-bold text-sm">
                                    <Info size={16} />
                                    <span>Trend Insight</span>
                                </div>
                                <p className="text-slate-600 text-xs leading-relaxed font-medium">
                                    {/* Dynamic Text Logic */}
                                    {isWarning
                                        ? "Your Stability (CV) is high, indicating your body is struggling to adapt to recent stress. Consider prioritizing sleep and light movement."
                                        : "Stability is excellent. Your 7-day trend shows positive adaptation, suggesting you can handle higher intensity training."
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Main Visualization Section */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">

                            {/* Chart Controls */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    <button
                                        onClick={() => setActiveTab('rmssd')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'rmssd' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        HRV (RMSSD)
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('score')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'score' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        HRV Score
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('hr')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'hr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Resting HR
                                    </button>
                                </div>


                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${currentConfig.color}20`, border: `1px solid ${currentConfig.color}` }}></div>
                                        <span className="text-slate-500">Daily</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-0.5" style={{ backgroundColor: currentConfig.color }}></div>
                                        <span className="text-slate-500">7d Avg</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-slate-200 rounded-sm"></div>
                                        <span className="text-slate-500">Normal Range</span>
                                    </div>
                                </div>
                            </div>

                            {/* The Chart */}
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            domain={['dataMin - 10', 'dataMax + 10']}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const point = payload[0].payload;
                                                    // Use any to bypass strict type check for dynamic key access
                                                    const val = (point as any)[currentConfig.key];
                                                    const avg = (point as any)[currentConfig.avgKey];

                                                    return (
                                                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl">
                                                            <p className="text-slate-400 text-[10px] font-black mb-2 uppercase tracking-widest">{point.name}</p>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between gap-4 items-center">
                                                                    <span className="text-slate-600 text-xs font-bold">Daily:</span>
                                                                    <span className="text-sm font-black" style={{ color: currentConfig.color }}>
                                                                        {val !== null ? val : '--'} {currentConfig.unit}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-4 items-center">
                                                                    <span className="text-slate-400 text-[11px] font-semibold">7d Avg:</span>
                                                                    <span className="text-slate-500 text-[11px] font-bold">
                                                                        {avg !== null ? avg : '--'} {currentConfig.unit}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />

                                        {/* Normal Range Shaded Area (Use first data point's limits as they come from global baseline) */}
                                        {data.length > 0 &&
                                            currentConfig.minKey &&
                                            currentConfig.maxKey &&
                                            typeof (data as any)[0][currentConfig.minKey] === 'number' && (
                                                <ReferenceArea
                                                    y1={(data as any)[0][currentConfig.minKey]}
                                                    y2={(data as any)[0][currentConfig.maxKey]}
                                                    fill="#f1f5f9"
                                                    fillOpacity={0.8}
                                                />
                                            )}

                                        {/* Daily Raw Data Bars */}
                                        <Bar
                                            dataKey={currentConfig.key}
                                            radius={[4, 4, 0, 0]}
                                            barSize={32}
                                        >
                                            {data.map((entry: any, index: number) => {
                                                // Default to solid border if no range keys
                                                let isOutOfRange = false;
                                                if (currentConfig.minKey && currentConfig.maxKey) {
                                                    const val = entry[currentConfig.key];
                                                    const min = entry[currentConfig.minKey];
                                                    const max = entry[currentConfig.maxKey];
                                                    if (min !== null && max !== null && (val > max || val < min)) {
                                                        isOutOfRange = true;
                                                    }
                                                }

                                                return (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={currentConfig.color}
                                                        fillOpacity={0.08}
                                                        stroke={currentConfig.color}
                                                        strokeWidth={1.5}
                                                        strokeDasharray={isOutOfRange ? "0" : "4 2"}
                                                    />
                                                );
                                            })}
                                        </Bar>

                                        {/* 7-Day Moving Avg Line */}
                                        <Line
                                            type="monotone"
                                            dataKey={currentConfig.avgKey}
                                            stroke={currentConfig.color}
                                            strokeWidth={4}
                                            dot={false}
                                            animationDuration={1500}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Footer Metrics */}
                        <div className="flex items-center justify-between pt-4 text-slate-400 border-t border-slate-100">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <Heart size={14} className="text-rose-500" />
                                    <span className="text-xs font-medium">Avg HR: <b className="text-slate-700">{stats?.avgHR || '--'} bpm</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-emerald-600" />
                                    <span className="text-xs font-medium">Avg HRV: <b className="text-slate-700">{stats?.avgHRV || '--'} ms</b></span>
                                </div>
                            </div>
                            {/* Optional historical link */}
                            <button
                                className="text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors tracking-tight opacity-50 cursor-not-allowed"
                                title="Historical data view coming soon"
                            >
                                VIEW HISTORICAL DATA →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeeklyRecoveryReport;
