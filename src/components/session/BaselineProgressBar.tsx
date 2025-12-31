import React from 'react';
import { Trophy, Activity, Zap, TrendingUp } from 'lucide-react';
import type { UserBaseline, UserProfile, PhaseData } from '@/types';

interface BaselineProgressBarProps {
    baseline: UserBaseline | null;
    userProfile?: UserProfile | null;
    phaseData?: PhaseData | null; // Phase data from analyze API (always has uniqueDays)
    isLoading?: boolean;
}

const BaselineProgressBar: React.FC<BaselineProgressBarProps> = ({
    baseline,
    userProfile,
    phaseData,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-pulse mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                        <div className="space-y-2">
                            <div className="w-24 h-3 bg-slate-200 rounded"></div>
                            <div className="w-32 h-2 bg-slate-100 rounded"></div>
                        </div>
                    </div>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full w-full"></div>
            </div>
        );
    }

    // Data Extraction - prefer phaseData (always available from analyze API) over baseline
    const uniqueDays = phaseData?.uniqueDays ?? baseline?.unique_morning_sessions_count ?? 0;
    const progressPercent = phaseData?.progress ?? baseline?.calibration_progress ?? 0;
    // Get phase from user profile, fallback to calculated phase
    let phase: 'calibration' | 'early_baseline' | 'full_baseline' = userProfile?.usage_phase || 'calibration';
    // Fallback calculation if user profile doesn't have usage_phase
    if (!userProfile?.usage_phase) {
        if (uniqueDays >= 15) phase = 'full_baseline';
        else if (uniqueDays >= 4) phase = 'early_baseline';
        else phase = 'calibration';
    }

    // Phase Configuration
    const getPhaseInfo = () => {
        switch (phase) {
            case 'full_baseline':
                return {
                    label: 'Pro Baseline Active',
                    description: 'Engine optimized for your physiology',
                    icon: <Trophy size={18} className="text-emerald-600" />,
                    color: 'from-emerald-400 to-teal-500',
                    bgColor: 'bg-emerald-50/40',
                    status: 'full_baseline',
                    percentage: 100
                };
            case 'early_baseline':
                return {
                    label: 'Building Baseline',
                    description: 'Keep tracking to unlock full precision',
                    icon: <TrendingUp size={18} className="text-blue-600" />,
                    color: 'from-blue-400 to-indigo-500',
                    bgColor: 'bg-blue-50/40',
                    status: 'early_baseline',
                    percentage: progressPercent
                };
            case 'calibration':
            default:
                return {
                    label: 'System Calibration',
                    description: 'Record morning sessions to calibrate',
                    icon: <Zap size={18} className="text-amber-600" />,
                    color: 'from-amber-400 to-orange-500',
                    bgColor: 'bg-amber-50/40',
                    status: 'calibration',
                    percentage: progressPercent
                };
        }
    };

    const phaseInfo = getPhaseInfo();
    const sessionCount = uniqueDays;

    return (
        <div className={`w-full p-4 rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-500 mb-6 ${phaseInfo.bgColor}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100/80">
                        {phaseInfo.icon}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 leading-none flex items-center gap-1.5">
                            {phaseInfo.label}
                            {phaseInfo.status === 'full' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            {phaseInfo.description}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Progress</span>
                    <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-slate-100/50 shadow-sm">
                        Day {sessionCount}
                    </span>
                </div>
            </div>

            <div className="relative w-full h-2.5 bg-slate-200/50 rounded-full overflow-hidden">
                <div
                    className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${phaseInfo.color} transition-all duration-1000 ease-out shadow-sm`}
                    style={{ width: `${Math.max(phaseInfo.percentage, 5)}%` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                </div>
            </div>

            {/* Markers for Early Phase to show progress visual context */}
            {phaseInfo.status === 'early_baseline' && (
                <div className="flex justify-between mt-1.5 px-0.5">
                    <span className="text-[9px] font-bold text-slate-400/80 uppercase tracking-wide">Day 4</span>
                    <div className="flex-1 border-t border-dotted border-slate-300/50 mx-3 self-center" />
                    <span className="text-[9px] font-bold text-slate-400/80 uppercase tracking-wide">Day 15</span>
                </div>
            )}

            {/* Markers for Calibration Phase */}
            {phaseInfo.status === 'calibration' && (
                <div className="flex justify-between mt-1.5 px-0.5">
                    <span className="text-[9px] font-bold text-slate-400/80 uppercase tracking-wide">Day 0</span>
                    <div className="flex-1 border-t border-dotted border-slate-300/50 mx-3 self-center" />
                    <span className="text-[9px] font-bold text-slate-400/80 uppercase tracking-wide">Day 3</span>
                </div>
            )}
        </div>
    );
};

export default BaselineProgressBar;
