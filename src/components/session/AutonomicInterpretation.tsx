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

interface AutonomicInterpretationProps {
  interpretation: InterpretationResult | null;
  isLoading?: boolean;
  summary: SessionSummary;
  userId?: string | null;
  firstSessionDate?: string | null;
  sessionId?: string;
  baseline?: UserBaseline | null;
  baseline?: UserBaseline | null;
  darkMode?: boolean;
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
  showComparison = true,
  darkMode = false
}: {
  label: string,
  value: string,
  subValue?: string | number,
  change: string | number,
  trend: 'up' | 'down' | 'stable',
  unit?: string,
  borderColor?: string,
  showComparison?: boolean,
  darkMode?: boolean
}) => (
  <div className={`border-[2.5px] ${borderColor} ${showComparison ? 'p-4' : 'p-3'} rounded-xl transition-all flex flex-col justify-between group flex-1 min-w-[140px] ${darkMode ? 'bg-gray-800 hover:border-indigo-400/50' : 'bg-white hover:border-indigo-200'}`}>
    <div className="mb-3">
      <span className={`text-base font-bold uppercase tracking-wider transition-colors ${darkMode ? 'text-gray-400 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'}`}>{label}</span>
    </div>

    <div className="flex justify-between items-end">
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-black tabular-nums ${darkMode ? 'text-gray-200' : 'text-slate-800'}`}>{value}</span>
        <span className={`text-[10px] font-bold uppercase ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{unit}</span>
      </div>

      {showComparison && (
        <span className={`text-[10px] font-black px-2 py-1 rounded-md flex items-center ${trend === 'up' ? (darkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
          trend === 'down' ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-600') :
            (darkMode ? 'bg-emerald-900/30 text-emerald-500/80' : 'bg-emerald-50/50 text-emerald-600/70')
          }`}>
          {trend === 'up' && <TrendingUp size={12} className="mr-1" />}
          {trend === 'down' && <TrendingDown size={12} className="mr-1" />}
          {trend === 'stable' && <span className="mr-1">=</span>}
          {change}%
        </span>
      )}
    </div>

    {showComparison && subValue !== undefined && subValue !== '-' && subValue !== '' && (
      <div className={`mt-3 pt-2 border-t flex justify-center items-center text-[9px] ${darkMode ? 'border-gray-700' : 'border-slate-50'}`}>
        <span className={`font-bold ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>{subValue}</span>
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
  sessionId,
  baseline,
  darkMode = false
}) => {
  // AI Insight State
  const [aiInsight, setAiInsight] = useState<{ title: string; interpretation: string } | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const [isError, setIsError] = useState(false);

  // Track which sessionId has already had AI insight generated to prevent duplicate calls
  const generatedForSessionRef = React.useRef<string | null>(null);

  const generateInsight = async (isRetry = false) => {
    // Logic inside effect handles the null checks safely
    if (!interpretation || !summary || (isLoading && !isRetry)) {
      return;
    }

    // 1. Check if we already have persisted AI insight - display stored data
    // If retrying, we ignore this check to force a new fetch
    if (!isRetry && summary.ai_title && summary.ai_interpretation) {
      setAiInsight({
        title: summary.ai_title,
        interpretation: summary.ai_interpretation
      });
      return;
    }

    // 2. Check if we already generated insight for this session (prevents duplicate calls)
    // If retrying, we bypass this check
    if (!isRetry && sessionId && generatedForSessionRef.current === sessionId) {
      return;
    }

    setIsError(false);
    setIsLoadingInsight(true);

    // Mark this session as being processed
    if (sessionId) {
      generatedForSessionRef.current = sessionId;
    }

    try {
      // Check if baseline is established (per plan requirement)
      const baselineEstablished = baseline?.established ?? false;
      let payload = {};
      let mode = '';

      if (!baselineEstablished) {
        // Calibration phase - use analysis mode
        mode = 'analysis';

        // Get metric changes from baselineDetails (comparison to previous session)
        const getMetricChange = (metricKey: string) => {
          const detail = interpretation.baselineDetails?.find(d => d.metric === metricKey);
          if (!detail) return 0;
          // Return signed change: positive for up, negative for down
          return detail.direction === 'up' ? detail.percentChange :
            detail.direction === 'down' ? -detail.percentChange : 0;
        };

        // Extract comparison context from interpretation
        let timeContext = "this session"; // Default fallback

        if (interpretation.relativeInterpretation) {
          const commaIndex = interpretation.relativeInterpretation.indexOf(',');
          if (commaIndex > 0) {
            // Extract the comparison text (e.g., "Compared to your state roughly 1 day ago")
            timeContext = interpretation.relativeInterpretation.substring(0, commaIndex).trim();
          } else {
            // If no comma, check if it's a comparison statement
            const lowerText = interpretation.relativeInterpretation.toLowerCase();
            if (lowerText.includes('compared') || lowerText.includes('since your')) {
              timeContext = interpretation.relativeInterpretation.trim();
            }
          }
        } else if (interpretation.title) {
          // Fallback: extract from title like "HRV Changes Since Yesterday"
          const titleMatch = interpretation.title.match(/Since (.+)$/i);
          if (titleMatch) {
            const timeRef = titleMatch[1].toLowerCase();
            // Convert title format to comparison format
            if (timeRef.includes('yesterday')) {
              timeContext = "Compared to your state roughly 1 day ago";
            } else if (timeRef.includes('2 days')) {
              timeContext = "Compared to your state roughly 2 days ago";
            } else if (timeRef.includes('last week')) {
              timeContext = "Compared to your state last week";
            } else if (timeRef.includes('last session')) {
              timeContext = "Since your earlier session in this cycle";
            } else {
              timeContext = `Compared to your state ${timeRef}`;
            }
          }
        }

        payload = {
          metricData: {
            rmssd: {
              value: summary.sessionRMSSD.value || 0,
              change: getMetricChange('RMSSD')
            },
            sdnn: {
              value: summary.sdnn?.value || 0,
              change: getMetricChange('SDNN')
            },
            lf: {
              value: summary.lfPower.value || 0,
              change: getMetricChange('LF')
            },
            hf: {
              value: summary.hfPower.value || 0,
              change: getMetricChange('HF')
            },
            amo50: {
              value: summary.amode50 || 0
            }
          },
          context: {
            timeContext: timeContext,
            phaseContext: "calibration phase"
          }
        };
      } else {
        // Baseline established - use rewording mode
        mode = 'rewording';
        payload = {
          existingInterpretation: {
            title: interpretation.title,
            physiologicalState: interpretation.physiologicalState,
            recommendedAction: interpretation.recommendedAction,
            combinedAdvice: interpretation.combinedAdvice
          }
        };
      }

      const response = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, data: payload })
      });

      if (response.ok) {
        const data = await response.json();

        // Transform API response to match expected format
        // API should return { title, interpretation } for single sessions
        // but handle both formats for robustness
        let transformedData;
        if (data.title && data.interpretation) {
          // Already in correct format
          transformedData = data;
        } else if (data.title && (data.observation || data.action)) {
          // Transform from weekly report format (fallback)
          transformedData = {
            title: data.title,
            interpretation: [data.observation, data.action].filter(Boolean).join(' ')
          };
        } else {
          console.error('[AutonomicInterpretation] ❌ API response missing required fields:', data);
          setIsError(true);
          return;
        }

        if (transformedData.title && transformedData.interpretation) {
          setAiInsight(transformedData);

          if (sessionId) {
            const updatePayload = {
              sessionId,
              ai_title: transformedData.title,
              ai_interpretation: transformedData.interpretation
            };

            const updateResponse = await fetch('/api/sessions/update-insight', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });

            if (!updateResponse.ok) {
              const errorText = await updateResponse.text();
              console.error('[AutonomicInterpretation] ❌ Failed to store AI insight to DB');
              // console.error('[AutonomicInterpretation] Error response:', errorText);
            }
          } else {
            console.warn('[AutonomicInterpretation] ⚠️ No sessionId available - cannot store to DB');
          }
        } else {
          console.error('[AutonomicInterpretation] ❌ Transformed data missing title or interpretation:', transformedData);
          setIsError(true);
        }
      } else {
        const errorText = await response.text();
        console.error('[AutonomicInterpretation] ❌ API call failed:', response.status, errorText);
        setIsError(true);
      }
    } catch (e) {
      console.error('[AutonomicInterpretation] ❌ Exception in generateInsight:', e);
      setIsError(true);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  // Determine if valid for AI generation
  useEffect(() => {
    generateInsight();
  }, [sessionId, summary?.ai_title, isLoading]); // Reduced dependencies to prevent loops


  if (isLoading) {
    return (
      <div className={`border rounded-lg shadow-sm p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="animate-pulse flex items-center space-x-4">
          <div className={`h-12 w-12 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className="space-y-2 flex-1">
            <div className={`h-4 rounded w-3/4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`h-4 rounded w-1/2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
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

  // For calibration phase, use Green theme to be welcoming/positive (as requested)
  // Otherwise use neutral or positive based on trend
  const useGreenTheme = isCalibrationPhase ? true : (isOptimalPattern || isPositiveTrend);

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
      bannerContainer: darkMode ? "bg-emerald-900/20 border-emerald-800/50" : "bg-emerald-50/40 border-emerald-100/50",
      bannerIcon: darkMode ? "text-emerald-400" : "text-emerald-600",
      pulseColor: "bg-emerald-400",
      protocolBg: darkMode ? "bg-emerald-900/40" : "bg-emerald-600",
      protocolShadow: darkMode ? "shadow-emerald-900/20" : "shadow-emerald-100"
    };
  } else {
    // All other states (Stress, Warning, Neutral) use the 'Grey' (Slate) theme for negative/neutral feedback
    theme = {
      headerBg: "bg-slate-900",
      accent: "text-indigo-400",
      bannerContainer: darkMode ? "bg-gray-800/50 border-gray-700/50" : "bg-slate-100/50 border-slate-200/50",
      bannerIcon: darkMode ? "text-gray-400" : "text-slate-500",
      pulseColor: darkMode ? "bg-gray-500" : "bg-slate-400",
      protocolBg: darkMode ? "bg-gray-800" : "bg-slate-700",
      protocolShadow: darkMode ? "shadow-gray-900/20" : "shadow-slate-100"
    };
  }

  // Generate dynamic calibration message
  const getCalibrationMessage = () => {
    const coreMessage = "Try to record one session everyday. Continue tracking to establish your personalized baseline. Consider relaxation techniques and ensure adequate recovery.";

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
      <div className={`border-x border-b rounded-b-2xl p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>

        {/* Dynamic Title Separator - REMOVED (moved to HRV Analysis section) */}

        {/* Interpretation Info Banner - REMOVED (Replaced by Title) */}

        {/* Metrics Row - REMOVED (moved to HRV Analysis section in SessionSummaryModal) */}

        {/* Protocol Recommendation Section */}
        <div className={`rounded-[2.5rem] p-6 lg:p-8 flex flex-col items-center text-center relative overflow-hidden border mb-6 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-slate-50 border-slate-100'}`}>
          {/* Watermark detail */}
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Wind size={160} />
          </div>

          {/* Protocol Header - Simplified for calibration phase */}
          {!isCalibrationPhase && (
            <>
              {/* Pill Header */}
              <div className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-full shadow-lg mb-8 ${darkMode ? 'bg-gray-700 text-gray-200 shadow-gray-900/50' : 'bg-indigo-600 text-white shadow-indigo-100'}`}>
                <Wind size={16} strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Active Recovery Protocol</span>
              </div>

              {/* Main Instruction - AI Only (no fallback) */}
              {isLoadingInsight ? (
                <div className="w-full max-w-2xl flex flex-col items-center gap-4 mb-3">
                  <div className="h-8 bg-slate-200 rounded w-3/4 animate-pulse"></div>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center gap-2 mb-3">
                  <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>Unavailable</p>
                  <button
                    onClick={() => generateInsight(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    <Wind size={14} /> Retry Analysis
                  </button>
                </div>
              ) : aiInsight?.title ? (
                <p className={`text-xl md:text-2xl font-black tracking-tight leading-tight mb-3 max-w-2xl ${darkMode ? 'text-gray-100' : 'text-slate-900'}`}>
                  {aiInsight.title}
                </p>
              ) : null}

              {/* Soft Separator - Only show if we have content */}
              {aiInsight && (isLoadingInsight || aiInsight.title) && (
                <div className="w-16 h-1 bg-indigo-200 rounded-full mb-3 opacity-50"></div>
              )}
            </>
          )}

          {isCalibrationPhase && (
            <>
              <div className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-full shadow-lg mb-8 ${darkMode ? 'bg-indigo-900/50 text-indigo-200 shadow-indigo-900/20' : 'bg-indigo-600 text-white shadow-indigo-100'}`}>
                <Activity size={16} strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Calibration Phase</span>
              </div>

              {/* Main Instruction - AI Only (no fallback) */}
              {isLoadingInsight ? (
                <div className="w-full max-w-2xl flex flex-col items-center gap-4 mb-3">
                  <div className={`h-8 rounded w-3/4 animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center gap-2 mb-3">
                  <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>Unavailable</p>
                  <button
                    onClick={() => generateInsight(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                  >
                    <Activity size={14} /> Retry Analysis
                  </button>
                </div>
              ) : aiInsight?.title ? (
                <p className={`text-xl md:text-2xl font-black tracking-tight leading-tight mb-3 max-w-2xl ${darkMode ? 'text-gray-100' : 'text-slate-900'}`}>
                  {aiInsight.title}
                </p>
              ) : null}

              {/* Soft Separator - Only show if we have content */}
              {aiInsight && (isLoadingInsight || aiInsight.title) && (
                <div className="w-16 h-1 bg-slate-200 rounded-full mb-3 opacity-50"></div>
              )}

              {/* Secondary Context - AI interpretation only (no fallback) */}
              {isLoadingInsight ? (
                <div className="w-full max-w-3xl flex flex-col items-center gap-2">
                  <div className={`h-4 rounded w-full animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
                  <div className={`h-4 rounded w-5/6 animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
                </div>
              ) : aiInsight?.interpretation ? (
                <p className={`text-sm md:text-base font-medium leading-relaxed max-w-3xl ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  {aiInsight.interpretation}
                </p>
              ) : null}
            </>
          )}

          {/* Secondary Context - AI Only (no fallback) */}
          {!isCalibrationPhase && (
            isLoadingInsight ? (
              <div className="w-full max-w-3xl flex flex-col items-center gap-2">
                <div className={`h-4 rounded w-full animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
                <div className={`h-4 rounded w-5/6 animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-slate-200'}`}></div>
              </div>
            ) : aiInsight?.interpretation ? (
              <p className={`text-sm md:text-base font-medium leading-relaxed max-w-3xl ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                {aiInsight.interpretation}
              </p>
            ) : null
          )}

          {/* For calibration phase, we use the bottom banner for the AI text usually, but if desired we could put it here too.
              The design requested "Use the existing grey box location" which is the bottom banner for calibration. */}

        </div>

        {/* Interpretation Info Banner - Calibration (Stealth AI Target) */}
        {isCalibrationPhase && (
          <div className={`mb-6 flex items-center gap-4 p-4 border rounded-xl transition-colors duration-500 ${theme.bannerContainer}`}>
            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${theme.bannerIcon} ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <Activity size={18} />
            </div>
            <div className="flex-1">
              {/* REMOVED LOADING CHECK HERE to show calibration countdown instantly */}
              <p className={`text-sm font-medium leading-tight ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                <span className={`font-bold ${darkMode ? 'text-gray-200' : 'text-slate-900'}`}>
                  {getCalibrationMessage()}
                </span>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer meta info */}
      <div className={`mt-6 flex flex-col md:flex-row justify-between items-center gap-4 px-2 opacity-40 ${darkMode ? 'text-gray-500' : 'text-slate-500'}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">HRV Analytics • v1.0</p>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.pulseColor} shadow-sm`}></div>
            <span className={`text-[9px] font-black uppercase ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>Analysis Complete</span>
          </div>
          <div className={`h-3 w-[1px] ${darkMode ? 'bg-gray-600' : 'bg-slate-300'}`}></div>
          <CheckCircle2 size={12} className={darkMode ? 'text-gray-500' : 'text-slate-400'} />
        </div>
      </div>

    </div >
  );
};

export default AutonomicInterpretation;
