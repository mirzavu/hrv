'use client';

import React, { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
    ReferenceLine
} from 'recharts';

interface CalendarSession {
    id: string;
    date: string;
    time: string;
    rmssd: number;
    durationMin: number;
    hrvScore?: number;
    notes?: string;
}

interface StressChartProps {
    sessions: CalendarSession[];
    currentDate?: Date;
}

interface SimulatedPoint {
    time: string; // HH:MM
    hour: number;
    minStress: number;
    maxStress: number;
    avgStress: number;
    isForecast: boolean;
    event?: 'session' | null;
    hrvScore?: number;
}

export default function StressCopingChart({ sessions }: StressChartProps) {
    // --- Simulation Logic ---
    const data = useMemo(() => {
        const points: SimulatedPoint[] = [];
        const baseStressStart = 20; // Waking stress
        let currentStressBase = baseStressStart;

        // Sort sessions by time
        const sortedSessions = [...sessions].sort((a, b) => a.time.localeCompare(b.time));

        // Generate data for 8 AM to 11 PM (15 hours)
        for (let h = 8; h <= 23; h++) {
            const timeStr = `${h.toString().padStart(2, '0')}:00`;

            // Natural Accumulation (Sedentary Stress)
            // Stress naturally rises by ~3-5% per hour if unchecked
            const hourlyAccumulation = 4 + (Math.random() * 2);
            currentStressBase += hourlyAccumulation;

            // Check for session impact
            // Find sessions in this hour (simplified)
            const sessionInHour = sortedSessions.find(s => {
                const sessionHour = parseInt(s.time.split(':')[0]);
                return sessionHour === h;
            });

            let eventImpact = 0;
            let isSession = false;
            let score = undefined;

            if (sessionInHour) {
                isSession = true;
                score = sessionInHour.hrvScore;
                // Logic: High HRV score = High reduction
                // Score 80+ -> Reduces stress by 20-30%
                // Score < 50 -> Might increase or do nothing
                const hrv = sessionInHour.hrvScore || 50;
                const reductionFactor = hrv > 60 ? (hrv / 100) * 25 : 5; // Stronger reduction for better scores
                eventImpact = -reductionFactor;

                // Apply immediate reduction
                currentStressBase += eventImpact;
            }

            // Clamp stress
            currentStressBase = Math.max(10, Math.min(95, currentStressBase));

            // Calculate Range (The "Smoke" thickness)
            // Higher stress usually means more volatility (thicker smoke)
            const volatility = 5 + (currentStressBase * 0.15);
            const minS = Math.max(0, currentStressBase - volatility);
            const maxS = Math.min(100, currentStressBase + volatility);

            points.push({
                time: (h % 12 || 12) + (h >= 12 ? 'pm' : 'am'), // 8am, 9am...
                hour: h,
                minStress: Math.round(minS),
                maxStress: Math.round(maxS),
                avgStress: Math.round(currentStressBase),
                isForecast: h > new Date().getHours(), // Simple forecast logic based on current system time
                event: isSession ? 'session' : null,
                hrvScore: score
            });
        }
        return points;
    }, [sessions]);

    // --- Metrics Calculation ---
    const currentMetric = 92; // Placeholder or derived from latest Real point
    const reducedMetric = useMemo(() => {
        // Calculate total reduction from sessions
        // Simple heuristic: sum of drops calculated above? 
        // For now, let's derive it from the number of good sessions
        const goodSessions = sessions.filter(s => (s.hrvScore || 0) > 60).length;
        return goodSessions * -12; // -12% per good session
    }, [sessions]);

    const forecastMetric = 93; // Placeholder

    return (
        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-xl w-full max-w-md mx-auto sm:max-w-full">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        Your Stress-Coping Curve
                        <span className="text-slate-500 cursor-help">ⓘ</span>
                    </h2>
                    {/* Metrics Row */}
                    <div className="flex gap-6 mt-4 text-xs font-semibold tracking-wider">
                        <div className="flex flex-col">
                            <span className="text-slate-400 mb-1">CURRENT</span>
                            <span className="text-pink-500 text-lg">{currentMetric}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-400 mb-1">REDUCED</span>
                            <span className="text-white text-lg">{reducedMetric > 0 ? `+${reducedMetric}` : reducedMetric}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-400 mb-1">FORECAST</span>
                            <span className="text-pink-500 text-lg">{forecastMetric}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="smokeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff4d4d" stopOpacity={0.9} />
                                <stop offset="50%" stopColor="#ff9f43" stopOpacity={0.7} />
                                <stop offset="95%" stopColor="#ffcccc" stopOpacity={0.4} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={true} horizontal={false} stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            interval={3}
                        />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#94a3b8' }}
                        />

                        {/* The "Smoke" Range Area */}
                        {/* Recharts Area needs point data. To simulate range [min, max], we can use two connected areas or Stacked area? create a custom shape? 
               Actually, Recharts Area accepts 'dataKey' as array [min, max] logic is simpler:
               Use 'value' where value is [min, max] for Range Area chart.
               BUT standard AreaChart in Recharts takes Y value.
               Ref: <Area dataKey="range" /> where range = [min, max] works in recent Recharts versions.
            */}
                        <Area
                            type="monotone"
                            dataKey="maxStress"
                            stroke="none"
                            fill="url(#smokeGradient)"
                            baseLine={data.map(d => d.minStress) as any} // This uses the 'minStress' as the bottom of the area
                            connectNulls
                            activeDot={false}
                        />

                        {/* Session Markers (Dots) */}
                        {data.map((entry, index) => {
                            if (entry.event === 'session') {
                                return (
                                    <ReferenceDot
                                        key={index}
                                        x={entry.time}
                                        y={entry.avgStress}
                                        r={6}
                                        fill="#3b82f6"
                                        stroke="#bfdbfe"
                                        strokeWidth={2}
                                        isFront
                                    />
                                );
                            }
                            return null;
                        })}

                        {/* Current Time Line (Simulated) */}
                        <ReferenceLine x="4pm" stroke="#ffffff" strokeDasharray="3 3" label={{ position: 'top', value: '4:15pm', fill: '#94a3b8', fontSize: 10 }} />

                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Legend / Footer Text */}
            <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="flex gap-4 text-[10px] font-bold tracking-widest mb-3">
                    <span className="text-pink-500">STRESS</span>
                    <span className="text-green-500">ACTIVITY</span>
                    <span className="text-blue-500">REST</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                    This chart shows how sedentary stress built up throughout your day — and how your actions helped reduce its impact.
                </p>
            </div>
        </div>
    );
}
