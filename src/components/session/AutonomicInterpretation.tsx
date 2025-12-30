import React, { useState, useEffect } from 'react';
import {
  Waves,
  TrendingUp,
  TrendingDown,
  Wind,
  Info,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';
import type { SessionSummary, UserBaseline } from '@/types';

interface HistoricalComparison {
  rmssd?: { change: number; direction: 'up' | 'down' };
  sdnn?: { change: number; direction: 'up' | 'down' };
  lf?: { change: number; direction: 'up' | 'down' };
  hf?: { change: number; direction: 'up' | 'down' };
  amo50?: { change: number; direction: 'up' | 'down' };
}

interface AutonomicInterpretationProps {
  interpretation: InterpretationResult | null;
  isLoading?: boolean;
  summary: SessionSummary;
  userId?: string | null;
  firstSessionDate?: string | null;
}

// Reusable Metric Card matching the requested design
const MetricCard = ({
  label,
  value,
  subValue,
  change,
  trend,
  unit = "ms",
  borderColor = "border-slate-200",
  showComparison = true
}: {
  label: string,
  value: string,
  subValue: string | number,
  change: string | number,
  trend: 'up' | 'down' | 'stable',
  unit?: string,
  borderColor?: string,
  showComparison?: boolean
}) => (
  <div className={`bg-white border-[2.5px] ${borderColor} ${showComparison ? 'p-4' : 'p-3'} rounded-xl hover:border-indigo-200 transition-all flex flex-col justify-between group flex-1 min-w-[140px]`}>
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">{label}</span>
      {showComparison && (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
          trend === 'down' ? 'bg-slate-100 text-slate-600' :
            'bg-emerald-50/50 text-emerald-600/70'
          }`}>
          {trend === 'up' && <TrendingUp size={10} className="mr-1" />}
          {trend === 'down' && <TrendingDown size={10} className="mr-1" />}
          {trend === 'stable' && <span className="mr-1">=</span>}
          {change}%
        </span>
      )}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-black text-slate-800 tabular-nums">{value}</span>
      <span className="text-slate-400 text-[9px] font-bold uppercase">{unit}</span>
    </div>
    {showComparison && subValue !== '-' && subValue !== '' && (
      <div className="mt-3 pt-2 border-t border-slate-50 flex justify-center items-center text-[9px]">
        <span className="text-slate-600 font-bold">{subValue}</span>
      </div>
    )}
  </div>
);

const AutonomicInterpretation: React.FC<AutonomicInterpretationProps> = ({
  interpretation,
  isLoading = false,
  summary,
  userId,
  firstSessionDate,
}) => {
  const [sevenDayComparison, setSevenDayComparison] = useState<HistoricalComparison | null>(null);
  const [loadingComparisons, setLoadingComparisons] = useState(false);

  // Fetch historical sessions for comparison
  useEffect(() => {
    const fetchHistoricalComparisons = async () => {
      if (!userId || !summary || isLoading) {
        return;
      }

      setLoadingComparisons(true);
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch session from 7 days ago
        const response = await fetch(`/api/sessions/calendar?userId=${userId}&startDate=${sevenDaysAgo.toISOString().split('T')[0]}&endDate=${sevenDaysAgo.toISOString().split('T')[0]}`);
        const data = await response.json();
        const sevenDaySession = data.sessions?.[0];

        // Fetch summary if session exists
        let sevenDaySummary = null;
        if (sevenDaySession) {
          try {
            const sumResp = await fetch(`/api/sessions/summary?sessionId=${sevenDaySession.id}`);
            if (sumResp.ok) {
              const sumData = await sumResp.json();
              sevenDaySummary = sumData.summary;
            }
          } catch (e) { console.error(e); }
        }

        // Calculate comparisons
        if (sevenDaySummary) {
          const comparison: HistoricalComparison = {};

          if (summary.sessionRMSSD.value && sevenDaySession.rmssd) {
            const change = ((summary.sessionRMSSD.value - sevenDaySession.rmssd) / sevenDaySession.rmssd) * 100;
            comparison.rmssd = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.sdnn?.value && sevenDaySummary.sdnn_session_ms) {
            const change = ((summary.sdnn.value - sevenDaySummary.sdnn_session_ms) / sevenDaySummary.sdnn_session_ms) * 100;
            comparison.sdnn = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.lfPower.value && sevenDaySummary.lf_power_ms2) {
            const change = ((summary.lfPower.value - sevenDaySummary.lf_power_ms2) / sevenDaySummary.lf_power_ms2) * 100;
            comparison.lf = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.hfPower.value && sevenDaySummary.hf_power_ms2) {
            const change = ((summary.hfPower.value - sevenDaySummary.hf_power_ms2) / sevenDaySummary.hf_power_ms2) * 100;
            comparison.hf = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          // AMo50 comparison
          if (summary.amode50 && sevenDaySummary.amode_50) {
            const change = ((summary.amode50 - sevenDaySummary.amode_50) / sevenDaySummary.amode_50) * 100;
            comparison.amo50 = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }

          setSevenDayComparison(comparison);
        }

      } catch (error) {
        console.error('Error fetching historical comparisons:', error);
      } finally {
        setLoadingComparisons(false);
      }
    };

    fetchHistoricalComparisons();
  }, [userId, summary, isLoading]);

  if (isLoading || loadingComparisons) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="animate-pulse flex items-center space-x-4">
          <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!interpretation) return null;

  // Check if this is calibration phase (patternId: 0)
  const isCalibrationPhase = interpretation.patternId === 0;

  // Check if this is a score-based session (no comparison) - first session or <4h gap
  // These sessions don't have baselineDetails, so we hide comparison elements
  const isScoreBasedSession = isCalibrationPhase && !interpretation.baselineDetails;

  // Configuration based on physiological state (Pattern ID)
  // Optimal (Green) - only for established baseline patterns
  const isOptimalPattern = !isCalibrationPhase && [1, 2, 4, 11, 15, 20].includes(interpretation.patternId);

  // Check if RMSSD is trending up or stable-positive to force Green theme (User Feedback)
  const rmssdDetail = interpretation.baselineDetails?.find(d => d.metric === 'RMSSD');
  const isPositiveTrend = rmssdDetail?.direction === 'up' || (rmssdDetail?.direction === 'stable' && (rmssdDetail.percentChange || 0) >= 0);

  // For calibration phase, use neutral theme unless positive trend
  const useGreenTheme = isCalibrationPhase ? isPositiveTrend : (isOptimalPattern || isPositiveTrend);

  let theme = {
    headerBg: "bg-slate-900", // Static dark header
    accent: "text-indigo-400",
    bannerContainer: "bg-slate-100/50 border-slate-200/50", // Default Grey
    bannerIcon: "text-slate-500",
    pulseColor: "bg-indigo-400",
    protocolBg: "bg-indigo-600",
    protocolShadow: "shadow-indigo-100"
  };

  if (useGreenTheme) {
    theme = {
      headerBg: "bg-slate-900",
      accent: "text-emerald-400",
      bannerContainer: "bg-emerald-50/40 border-emerald-100/50", // Green for Optimal/Positive
      bannerIcon: "text-emerald-600",
      pulseColor: "bg-emerald-400",
      protocolBg: "bg-emerald-600",
      protocolShadow: "shadow-emerald-100"
    };
  } else {
    // All other states (Stress, Warning, Neutral) use the 'Grey' (Slate) theme for negative/neutral feedback
    theme = {
      headerBg: "bg-slate-900",
      accent: "text-indigo-400",
      bannerContainer: "bg-slate-100/50 border-slate-200/50",
      bannerIcon: "text-slate-500",
      pulseColor: "bg-slate-400",
      protocolBg: "bg-slate-700",
      protocolShadow: "shadow-slate-100"
    };
  }

  // Format 7D comparison for display
  const get7DDisplay = (metricKey: keyof HistoricalComparison) => {
    const comp = sevenDayComparison?.[metricKey];
    if (!comp) return '-';
    const arrow = comp.direction === 'up' ? '↗' : '↘';
    return `${arrow} ${comp.change.toFixed(0)}%`;
  };

  // Generate dynamic calibration message
  const getCalibrationMessage = () => {
    const coreMessage = "Try to record one session everyday day. Continue tracking to establish your personalized baseline. Consider relaxation techniques and ensure adequate recovery.";

    // Fallback if no date provided
    if (!firstSessionDate) return coreMessage;

    try {
      const startDate = new Date(firstSessionDate);
      // Calibration is established on Day 4 (after 3 full days of data)
      // So target is Start + 4 Days
      const targetDate = new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const diffMs = targetDate.getTime() - now.getTime();

      // If we are PAST the target date but baseline isn't established yet (e.g. valid days < 3),
      // we show a generic "Keep going" message instead of negative time.
      if (diffMs <= 0) {
        return "Continue tracking to establish your personalized baseline. You are close! Ensure you record on different days.";
      }

      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

      // Construct dynamic time string
      if (days > 0) {
        return `Your baseline will be established in ${days} days and ${hours} hours. ${coreMessage}`;
      } else {
        return `Your baseline will be established in ${hours} hours. ${coreMessage}`;
      }
    } catch (e) {
      console.error("Error calculating calibration time:", e);
      return coreMessage;
    }
  };

  return (
    <div className="w-full">

      {/* Status Header */}
      <div className={`bg-slate-900 text-white rounded-t-2xl p-6 flex items-center gap-6 shadow-lg relative overflow-hidden transition-colors duration-500`}>
        {/* Subtle wave pattern background */}
        <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none scale-150">
          <Waves size={400} strokeWidth={1} />
        </div>

        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10 relative z-10">
          <Activity size={28} className={theme.accent} />
        </div>

        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase tracking-[0.3em] opacity-80 ${theme.accent}`}>System Insight</span>
            <div className="flex gap-1">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme.pulseColor}`}></span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase leading-none text-slate-50">
            {interpretation.physiologicalState}
          </h1>
        </div>
      </div>

      {/* Dashboard Body */}
      <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-6">

        {/* Dynamic Title Separator */}
        {interpretation.title && (
          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="h-[1px] flex-1 bg-slate-200/70"></div>
            <div className="flex items-center gap-2.5">
              <Activity size={18} className={theme.accent} strokeWidth={2.5} />
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                {interpretation.title}
              </h3>
            </div>
            <div className="h-[1px] flex-1 bg-slate-200/70"></div>
          </div>
        )}

        {/* Interpretation Info Banner - REMOVED (Replaced by Title) */}

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          <MetricCard
            label="RMSSD"
            value={summary.sessionRMSSD.value?.toFixed(0) || '-'}
            subValue={get7DDisplay('rmssd')}
            change={interpretation.baselineDetails?.find(d => d.metric === 'RMSSD')?.percentChange.toFixed(0) || '-'}
            trend={interpretation.baselineDetails?.find(d => d.metric === 'RMSSD')?.direction as any || 'stable'}
            showComparison={!isScoreBasedSession}
          />
          <MetricCard
            label="SDNN"
            value={summary.sdnn?.value?.toFixed(0) || '-'}
            subValue={get7DDisplay('sdnn')}
            change={interpretation.baselineDetails?.find(d => d.metric === 'SDNN')?.percentChange.toFixed(0) || '-'}
            trend={interpretation.baselineDetails?.find(d => d.metric === 'SDNN')?.direction as any || 'stable'}
            showComparison={!isScoreBasedSession}
          />
          <MetricCard
            label="LF"
            value={summary.lfPower.value?.toFixed(0) || '-'}
            subValue={get7DDisplay('lf')}
            unit="ms²"
            change={interpretation.baselineDetails?.find(d => d.metric === 'LF')?.percentChange.toFixed(0) || '-'}
            trend={interpretation.baselineDetails?.find(d => d.metric === 'LF')?.direction as any || 'stable'}
            showComparison={!isScoreBasedSession}
          />
          <MetricCard
            label="HF"
            value={summary.hfPower.value?.toFixed(0) || '-'}
            subValue={get7DDisplay('hf')}
            unit="ms²"
            change={interpretation.baselineDetails?.find(d => d.metric === 'HF')?.percentChange.toFixed(0) || '-'}
            trend={interpretation.baselineDetails?.find(d => d.metric === 'HF')?.direction as any || 'stable'}
            showComparison={!isScoreBasedSession}
          />
          <MetricCard
            label="AMo50"
            value={summary.amode50?.toFixed(1) || '-'}
            subValue={get7DDisplay('amo50')}
            unit="%"
            change={interpretation.baselineDetails?.find(d => d.metric === 'AMo50')?.percentChange.toFixed(0) || '-'}
            trend={interpretation.baselineDetails?.find(d => d.metric === 'AMo50')?.direction as any || 'stable'}
            showComparison={!isScoreBasedSession}
          />
        </div>

        {/* Protocol Recommendation Section */}
        <div className="bg-slate-50 rounded-[2.5rem] p-8 lg:p-10 flex flex-col items-center text-center relative overflow-hidden border border-slate-100 mb-10">
          {/* Watermark detail */}
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Wind size={160} />
          </div>

          {/* Protocol Header - Simplified for calibration phase */}
          {!isCalibrationPhase && (
            <>
              {/* Pill Header */}
              <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-1.5 rounded-full shadow-lg shadow-indigo-100 mb-8">
                <Wind size={16} strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Active Recovery Protocol</span>
              </div>

              {/* Main Instruction */}
              <p className="text-slate-900 text-xl md:text-2xl font-black tracking-tight leading-tight mb-6 max-w-2xl">
                {interpretation.recommendedAction || "Focus on recovery"}
              </p>

              {/* Soft Separator */}
              <div className="w-16 h-1 bg-indigo-200 rounded-full mb-6 opacity-50"></div>
            </>
          )}

          {isCalibrationPhase && (
            <>
              <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-1.5 rounded-full shadow-lg shadow-indigo-100 mb-8">
                <Activity size={16} strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Calibration Phase</span>
              </div>

              {/* Main Instruction - Simplified for calibration */}
              <p className="text-slate-900 text-xl md:text-2xl font-black tracking-tight leading-tight mb-6 max-w-2xl">
                {interpretation.recommendedAction || "Continue tracking to establish your baseline"}
              </p>

              {/* Soft Separator */}
              <div className="w-16 h-1 bg-slate-200 rounded-full mb-6 opacity-50"></div>
            </>
          )}

          {/* Secondary Context - Clean advice only */}
          <p className="text-slate-500 text-sm md:text-base font-medium leading-relaxed max-w-3xl">
            {interpretation.combinedAdvice}
          </p>

          {/* Bottom Info Box for Calibration Phase */}
          {/* Bottom Info Box for Calibration Phase - MOVED OUTSIDE */}
        </div>

        {/* Interpretation Info Banner - Calibration */}
        {isCalibrationPhase && (
          <div className={`mb-6 flex items-center gap-4 p-4 border rounded-xl transition-colors duration-500 ${theme.bannerContainer}`}>
            <div className={`shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm ${theme.bannerIcon}`}>
              <Activity size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 leading-tight">
                <span className="font-bold text-slate-900">{getCalibrationMessage()}</span>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer meta info */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 px-2 opacity-40">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">HRV Analytics • v1.0</p>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.pulseColor} shadow-sm`}></div>
            <span className="text-[9px] font-black text-slate-600 uppercase">Analysis Complete</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-300"></div>
          <CheckCircle2 size={12} className="text-slate-400" />
        </div>
      </div>

    </div >
  );
};

export default AutonomicInterpretation;
