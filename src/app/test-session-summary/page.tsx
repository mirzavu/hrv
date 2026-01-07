'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    ScatterChart, Scatter
} from 'recharts';
import {
    X, Heart, Activity, Clock, Waves, Zap,
    Shield, Brain, Sparkles, BarChart3, ChevronDown, ChevronUp,
    Info
} from 'lucide-react';

// --- Shared UI Components ---

const InfoPopover: React.FC<{ title: string; description: string; className?: string }> = ({
    title,
    description,
    className = "top-2 right-2"
}) => {
    return (
        <div className={`absolute ${className} z-30 group/info`}>
            <button className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-1.5 rounded-full shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-md ring-1 ring-indigo-100 cursor-pointer pointer-events-auto">
                <Info size={14} strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-full right-0 mb-3 w-64 bg-slate-900 text-white text-xs p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 origin-bottom-right transform scale-95 group-hover/info:scale-100 z-50 pointer-events-none">
                <div className="font-bold mb-2 text-indigo-300 flex items-center gap-2 border-b border-indigo-500/30 pb-2">
                    <Activity size={14} /> {title}
                </div>
                <p className="leading-relaxed text-slate-300">{description}</p>
                <div className="absolute -bottom-1.5 right-3 w-3 h-3 bg-slate-900 rotate-45"></div>
            </div>
        </div>
    );
};

// --- Sub-Components ---

const MetricCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    value: string | number;
    unit?: string;
    description?: string;
}> = ({ icon, title, value, unit, description }) => (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 relative group hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-start mb-3">
            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">{title}</span>
            <div className="p-2 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                {icon}
            </div>
        </div>
        <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800 tracking-tight">{value}</span>
            {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
        </div>
        {description && <InfoPopover title={title} description={description} />}
    </div>
);

const WellnessScoreCard: React.FC<{
    label: string;
    score: number;
    icon: any;
    color: string;
}> = ({ label, score, icon: Icon, color }) => (
    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
        <div className={`p-3 rounded-xl ${color} text-white shadow-sm`}>
            <Icon size={20} />
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-700 text-sm">{label}</span>
                <span className="font-black text-slate-900">{score}/100</span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color}`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    </div>
);

// --- Mock Data Generators ---

const generateHeartRateData = () => {
    const points = [];
    let hr = 60;
    for (let i = 0; i < 60; i++) {
        hr += (Math.random() - 0.5) * 5;
        if (hr < 50) hr = 50;
        if (hr > 90) hr = 90;
        points.push({ time: `${i}m`, bpm: Math.round(hr) });
    }
    return points;
};

const generatePoincareData = () => {
    const points = [];
    for (let i = 0; i < 100; i++) {
        const rrn = 800 + (Math.random() - 0.5) * 100;
        const rrn1 = 800 + (Math.random() - 0.5) * 100;
        points.push({ x: rrn, y: rrn1 });
    }
    return points;
};

// --- Main Component ---

interface SessionSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    data?: any;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ isOpen, onClose, data }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [chartsReady, setChartsReady] = useState(false);

    // Generate chart data only once
    const { hrData, poincareData } = useMemo(() => {
        return {
            hrData: generateHeartRateData(),
            poincareData: generatePoincareData()
        };
    }, []);

    // Delay chart rendering for animation smoothness
    useEffect(() => {
        if (isExpanded) {
            // Short delay to allow accordion animation to start
            const timer = setTimeout(() => setChartsReady(true), 150);
            return () => clearTimeout(timer);
        }
    }, [isExpanded]);

    if (!isOpen) return null;

    const summary = data || {
        duration: '45:00',
        meanHR: 64,
        rmssd: 42,
        coherence: 4.5,
        restoration: 78,
        stability: 8.5
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200 font-sans">
            <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Session Summary</h2>
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
                                Completed
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs md:text-sm mt-0.5 font-medium flex items-center gap-2">
                            <Clock size={12} /> Today, 9:41 AM • Morning Routine
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 custom-scrollbar bg-[#f8fafc] p-6 space-y-8">

                    {/* 1. Wellness Grid */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="text-indigo-500" size={20} />
                            <h3 className="text-lg font-bold text-slate-800">Wellness Impact</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <WellnessScoreCard label="Mental Clarity" score={85} icon={Brain} color="bg-violet-500" />
                            <WellnessScoreCard label="Physical Energy" score={72} icon={Zap} color="bg-amber-500" />
                            <WellnessScoreCard label="Stress Balance" score={92} icon={Shield} color="bg-emerald-500" />
                        </div>
                    </section>

                    {/* 2. Key Metrics Row */}
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            icon={<Clock size={18} />}
                            title="Duration"
                            value={summary.duration}
                            unit="min"
                        />
                        <MetricCard
                            icon={<Heart size={18} />}
                            title="Avg HR"
                            value={summary.meanHR}
                            unit="bpm"
                            description="Average heart rate maintained during the session."
                        />
                        <MetricCard
                            icon={<Activity size={18} />}
                            title="RMSSD"
                            value={summary.rmssd}
                            unit="ms"
                            description="Root Mean Square of Successive Differences. A key measure of short-term HRV."
                        />
                        <MetricCard
                            icon={<Waves size={18} />}
                            title="Coherence"
                            value={summary.coherence}
                            description="Measure of the synchronization between your heart rate and breathing."
                        />
                    </section>

                    {/* 3. Nervous System Balance (Custom Visual) */}
                    <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Activity size={18} className="text-slate-400" />
                                Nervous System Balance
                            </h3>
                            <InfoPopover title="Autonomic Balance" description="Visualizes the ratio between Sympathetic (Alert) and Parasympathetic (Rest) activity." />
                        </div>

                        <div className="relative h-12 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-rose-400 flex items-center justify-center text-white font-bold text-xs" style={{ width: '35%' }}>
                                Sympathetic (35%)
                            </div>
                            <div className="h-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs" style={{ width: '65%' }}>
                                Parasympathetic (65%)
                            </div>
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                            <span>Fight / Flight</span>
                            <span>Rest / Digest</span>
                        </div>
                    </section>

                    {/* 4. Heart Rate Chart */}
                    <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Heart size={18} className="text-rose-500" />
                                Heart Rate Trend
                            </h3>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hrData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="bpm" stroke="#ef4444" strokeWidth={2} fill="url(#colorHr)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* 5. Advanced Metrics Toggle */}
                    <div className="border-t border-slate-100 pt-2 pb-6">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                        >
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                                <BarChart3 size={18} className="text-indigo-500" />
                                Advanced Diagnostics
                            </span>
                            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </button>

                        {/* Collapsible Content */}
                        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Poincare Plot Mock */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-slate-700 text-sm">Poincaré Plot</h4>
                                        <InfoPopover title="Poincaré Plot" description="A scatter plot of RR intervals. The shape indicates HRV health; an ellipse/fan shape is generally healthy." />
                                    </div>
                                    <div className="h-[250px] w-full flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">
                                        {chartsReady ? (
                                            <div className="w-full h-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis type="number" dataKey="x" name="RRn" unit="ms" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <YAxis type="number" dataKey="y" name="RRn+1" unit="ms" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                                                        <Scatter name="HRV" data={poincareData} fill="#6366f1" />
                                                    </ScatterChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="animate-pulse text-slate-300 font-medium text-sm">Loading Chart...</div>
                                        )}
                                    </div>
                                </div>

                                {/* Frequency Domain Mock */}
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-slate-700 text-sm">Power Spectral Density</h4>
                                        <InfoPopover title="PSD" description="Shows the distribution of power into frequency bands (VLF, LF, HF)." />
                                    </div>
                                    <div className="h-[250px] flex items-end justify-between px-4 gap-2 bg-slate-50 rounded-xl pt-10 pb-2">
                                        <div className="w-1/3 bg-slate-300 h-[30%] rounded-t-lg relative group">
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-500">VLF</span>
                                        </div>
                                        <div className="w-1/3 bg-indigo-400 h-[60%] rounded-t-lg relative group">
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-600">LF</span>
                                        </div>
                                        <div className="w-1/3 bg-emerald-400 h-[45%] rounded-t-lg relative group">
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-600">HF</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-center text-xs text-slate-400">
                                        Balanced Autonomic Profile
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <p className="text-slate-400 text-sm font-medium">
                        Analysis based on 2,403 heart beats
                    </p>
                    <button onClick={onClose} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all hover:-translate-y-0.5 active:translate-y-0">
                        Close Summary
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function TestSessionSummaryPage() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-slate-100">
            <h1 className="text-2xl font-bold mb-4">Session Summary Test Page</h1>
            <p className="mb-4 text-gray-500">This page is a standalone viewer for the SessionSummaryModal component.</p>
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm"
            >
                Open Session Summary
            </button>
            <SessionSummaryModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </div>
    );
}
