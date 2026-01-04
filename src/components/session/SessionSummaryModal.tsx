import React, { useMemo, useState, useEffect } from 'react';
import { SessionSummary, UserBaseline, UserProfile } from '@/types';
import { X, Heart, Activity, TrendingUp, TrendingDown, Clock, Waves, Target, Zap, AlertTriangle, Shield, Brain, Sparkles, BarChart3, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import MetricCard from './MetricCard';
import HeartRateChart from './HeartRateChart';
import PoincarePlot from './PoincarePlot';
import RestorationIndexGauge from './RestorationIndexGauge';
import NervousSystemBalanceGauge from './NervousSystemBalanceGauge';
import WellnessScoreGrid from './WellnessScoreGrid';
import BreathingCoherenceChart from './BreathingCoherenceChart';
import TachogramChart from './TachogramChart';
import AutonomicBalanceChart from './AutonomicBalanceChart';
import AutonomicInterpretation from './AutonomicInterpretation';
import { interpretHRVSession } from '@/utils/autonomicInterpretation';
import {
  generateScoreBasedInterpretation,
  generateCalibrationInterpretation,
  detectCrashSession,
  findComparisonSession
} from '@/utils/sessionComparison';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';
import type { SessionSummaryRecord } from '@/types';
import AdvancedMetricsToggle from './AdvancedMetricsToggle';
import BaselineProgressBar from './BaselineProgressBar';

// Compact HRV Metric Card for the HRV Analysis section
const HrvMetricCard = ({
  label,
  value,
  unit,
  change,
  trend,
  showComparison = true
}: {
  label: string;
  value: string;
  unit: string;
  change: string | number;
  trend: 'up' | 'down' | 'stable';
  showComparison?: boolean;
}) => (
  <div className="bg-white border border-slate-200 p-4 rounded-xl hover:border-indigo-200 transition-all flex flex-col justify-between min-h-[100px]">
    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <div className="flex justify-between items-end mt-2">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-800 tabular-nums">{value}</span>
        <span className="text-slate-400 text-[10px] font-medium">{unit}</span>
      </div>
      {showComparison && change !== '-' && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
          trend === 'down' ? 'bg-slate-100 text-slate-600' :
            'bg-slate-50 text-slate-500'
          }`}>
          {trend === 'up' && <TrendingUp size={12} className="mr-1" />}
          {trend === 'down' && <TrendingDown size={12} className="mr-1" />}
          {trend === 'stable' && <span className="mr-1">=</span>}
          {change}%
        </span>
      )}
    </div>
  </div>
);

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
  rrQuality?: { percentage: number, quality: string, totalNotifications: number, withRR: number, withoutRR: number };
  userId?: string | null;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  summary,
  onReset,
  isGuest,
  onGuestLogin,
  onClose,
  rrQuality,
  userId,
}) => {
  // Separate states for button animation (instant) and content expansion (deferred)
  const [isToggleExpanded, setIsToggleExpanded] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [firstSessionDate, setFirstSessionDate] = useState<string | null>(null);

  // Sync content state with toggle state slightly deferred to allow button animation to start
  useEffect(() => {
    // We use a small timeout for BOTH open and close to ensure the button animation
    // has a chance to paint its first frame before the heavy layout change occurs.
    // This entirely decouples the button UI from the heavy content layout.
    const timer = setTimeout(() => {
      setIsContentExpanded(isToggleExpanded);
    }, 16); // ~1 frame delay

    return () => clearTimeout(timer);
  }, [isToggleExpanded]);

  // Fetch baseline and user profile when modal opens
  useEffect(() => {
    const fetchData = async () => {
      if (!userId || isGuest) {
        setBaselineLoading(false);
        return;
      }
      try {
        setBaselineLoading(true);
        console.log(`[SessionSummaryModal] Fetching baseline and user profile for user ${userId}`);

        // Fetch baseline
        const baselineResponse = await fetch(`/api/user/baseline?userId=${userId}`);
        if (baselineResponse.ok) {
          const baselineData = await baselineResponse.json();
          console.log(`[SessionSummaryModal] Baseline fetched:`, {
            exists: !!baselineData.baseline,
            established: baselineData.baseline?.established,
            id: baselineData.baseline?.id
          });
          setBaseline(baselineData.baseline);
        } else {
          console.log(`[SessionSummaryModal] Baseline fetch failed: ${baselineResponse.status}`);
          setBaseline(null);
        }

        // Fetch user profile for usage_phase
        const userResponse = await fetch(`/api/user/profile?userId=${userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserProfile(userData.profile);
        } else {
          console.log(`[SessionSummaryModal] User profile fetch failed: ${userResponse.status}`);
        }
      } catch (error) {
        console.error('[SessionSummaryModal] Error fetching data:', error);
        setBaseline(null);
      } finally {
        setBaselineLoading(false);
      }
    };

    fetchData();
  }, [userId, isGuest, summary.session_id]); // Refetch when session_id changes (e.g., after analyze API completes)

  // Calculate interpretation when baseline or summary changes
  useEffect(() => {
    const calculateInterpretation = async () => {
      if (baselineLoading) {
        console.log('[SessionSummaryModal] baseline loading...', { baseline, baselineLoading });
        return;
      }

      // If baseline is established, use existing interpretation logic
      if (baseline?.established) {
        console.log('[SessionSummaryModal] Baseline established, using interpretHRVSession');
        const result = interpretHRVSession(summary, baseline);
        console.log('[SessionSummaryModal] Interpretation result:', {
          hasResult: !!result,
          patternId: result?.patternId
        });
        setInterpretation(result);
        return;
      }

      // No baseline - calibration phase (Days 1-3)
      // No baseline - calibration phase (Days 1-3)
      if (!userId && !isGuest) {
        console.log('[SessionSummaryModal] No userId and not guest, skipping interpretation');
        setInterpretation(null);
        return;
      }

      // Guest user handling
      if (isGuest) {
        console.log('[SessionSummaryModal] Guest user - using score-based interpretation');
        // Use true for isFirstSession to show generic text 
        const result = generateScoreBasedInterpretation(summary, true);
        setInterpretation(result);
        setComparisonLoading(false);
        return;
      }

      console.log('[SessionSummaryModal] Calibration phase - fetching comparison data');
      setComparisonLoading(true);

      try {
        // Fetch all previous session summaries for this user
        const response = await fetch(`/api/sessions/comparison?userId=${userId}`);

        if (!response.ok) {
          console.error('[SessionSummaryModal] Failed to fetch comparison sessions:', response.status);
          // Fallback to score-based if API fails
          const result = generateScoreBasedInterpretation(summary, true);
          setInterpretation(result);
          setComparisonLoading(false);
          return;
        }

        const comparisonData = await response.json();
        const previousSessions: SessionSummaryRecord[] = comparisonData.previousSessions || [];
        const isFirstSession = comparisonData.isFirstSession || previousSessions.length === 0;

        // Detect crash session
        if (previousSessions.length > 0) {
          const crashResult = detectCrashSession(summary, previousSessions);
          if (crashResult.isCrash) {
            console.log('[SessionSummaryModal] Crash detected:', crashResult.zScore);
            // Note: Crash marking is handled server-side in analyze route
          }
        }

        // Determine First Session Date for Calibration Timer
        // Sort sessions by date ascending to find the true first session
        const allSessions = [...previousSessions];
        allSessions.sort((a, b) => {
          const dateA = new Date(a.session_date || a.createdAt).getTime();
          const dateB = new Date(b.session_date || b.createdAt).getTime();
          return dateA - dateB;
        });

        const firstSession = allSessions[0];
        // If we have history, use first session. If not, use current session date or NOW.
        const firstDate = firstSession
          ? (firstSession.session_date || firstSession.createdAt)
          : (summary.rrIntervals?.[0]?.timestamp ? new Date(summary.rrIntervals[0].timestamp).toISOString() : new Date().toISOString());

        setFirstSessionDate(firstDate);

        if (isFirstSession) {
          // First session - use score-based
          console.log('[SessionSummaryModal] First session - using score-based interpretation');
          const result = generateScoreBasedInterpretation(summary, true);
          setInterpretation(result);
          setComparisonLoading(false);
          return;
        }

        // Find comparison session using time gaps
        // Use current time as reference (session was just completed)
        const currentSessionDate = new Date();
        const comparisonResult = findComparisonSession(currentSessionDate, previousSessions);

        // Check if time gap is <4 hours (Priority 5)
        if (comparisonResult.session) {
          const timeGap = comparisonResult.timeGapHours;
          if (timeGap < 4) {
            // <4h gap - use score-based
            console.log('[SessionSummaryModal] <4h gap - using score-based interpretation');
            const result = generateScoreBasedInterpretation(summary, false);
            setInterpretation(result);
            setComparisonLoading(false);
            return;
          }

          // Has valid comparison session - use metric comparison
          console.log('[SessionSummaryModal] Using calibration interpretation with comparison');
          const result = generateCalibrationInterpretation(
            summary,
            comparisonResult.session,
            comparisonResult.insightText,
            comparisonResult.metricTitle
          );
          setInterpretation(result);
        } else {
          // No valid comparison found - check if <4h from most recent
          const mostRecent = previousSessions[0];
          if (mostRecent) {
            const mostRecentDate = mostRecent.session_date ? new Date(mostRecent.session_date) : new Date(mostRecent.createdAt);
            const timeGap = (currentSessionDate.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60);

            if (timeGap < 4) {
              // <4h gap - use score-based
              console.log('[SessionSummaryModal] <4h gap (no priority match) - using score-based interpretation');
              const result = generateScoreBasedInterpretation(summary, false);
              setInterpretation(result);
              setComparisonLoading(false);
              return;
            }
          }

          // Fallback to score-based
          console.log('[SessionSummaryModal] No comparison match - fallback to score-based interpretation');
          const result = generateScoreBasedInterpretation(summary, false);
          setInterpretation(result);
        }
      } catch (error) {
        console.error('[SessionSummaryModal] Error calculating calibration interpretation:', error);
        // Fallback to score-based
        const result = generateScoreBasedInterpretation(summary, false);
        setInterpretation(result);
      } finally {
        setComparisonLoading(false);
      }
    };

    calculateInterpretation();
  }, [summary, baseline, baselineLoading, userId, isGuest]);

  // Defer chart rendering briefly to allow the toggle animation to start
  // Note: We don't reset chartsReady to false when collapsing, so charts stay mounted
  // and won't re-render when re-opened (they're just hidden via CSS)
  useEffect(() => {
    if (isContentExpanded && !chartsReady) {
      // Minimal delay waiting for content transition to begin
      const timer = setTimeout(() => {
        setChartsReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isContentExpanded, chartsReady]);

  const heartRateData = useMemo(() => {
    const intervals = summary.rrIntervals ?? [];
    const valid = intervals.filter(
      (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
    );
    if (!valid.length) {
      return [];
    }

    const startTimestamp = typeof valid[0].timestamp === 'number' ? valid[0].timestamp : null;
    let elapsedSeconds = 0;
    let lastRR = valid[0].value ?? 0;

    return valid
      .map((interval, index) => {
        const rr = interval.value ?? lastRR;
        if (!rr || rr <= 0) {
          return null;
        }

        if (startTimestamp !== null && typeof interval.timestamp === 'number') {
          elapsedSeconds = (interval.timestamp - startTimestamp) / 1000;
        } else if (index === 0) {
          elapsedSeconds = 0;
        } else {
          elapsedSeconds += rr / 1000;
        }

        lastRR = rr;

        return {
          time: Number(elapsedSeconds.toFixed(1)),
          bpm: Number((60000 / rr).toFixed(1)),
          rr,
        };
      })
      .filter((point): point is { time: number; bpm: number; rr: number } =>
        Boolean(point) &&
        Number.isFinite(point?.bpm) &&
        Number.isFinite(point?.rr)
      );
  }, [summary.rrIntervals]);

  // Determine if session is "new" (within last 30 mins) to show Progress Bar
  const isRecentSession = useMemo(() => {
    if (!summary.rrIntervals || summary.rrIntervals.length === 0) return true;
    const lastInterval = summary.rrIntervals[summary.rrIntervals.length - 1];

    // Check if timestamp appears to be an absolute epoch (milliseconds)
    // 1600000000000 is approx year 2020
    if (lastInterval.timestamp > 1600000000000) {
      const diff = Date.now() - lastInterval.timestamp;
      // Show only if session ended within the last 60 minutes
      return diff < 1000 * 60 * 60;
    }

    // If relative timestamps or unsure, default to true (safest for fresh sessions)
    return true;
  }, [summary.rrIntervals]);

  const poincareData = useMemo(() => {
    const intervals = summary.rrIntervals ?? [];
    const valid = intervals.filter(
      (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
    );
    if (valid.length < 2) {
      return [];
    }

    const points = [];
    for (let i = 0; i < valid.length - 1; i++) {
      const rrn = valid[i].value ?? 0;
      const rrn1 = valid[i + 1].value ?? 0;

      if (rrn > 0 && rrn1 > 0) {
        points.push({
          rrn: Number(rrn.toFixed(1)),
          rrn1: Number(rrn1.toFixed(1)),
        });
      }
    }

    return points;
  }, [summary.rrIntervals]);

  const tachogramData = useMemo(() => {
    const intervals = summary.rrIntervals ?? [];
    const valid = intervals.filter(
      (interval) => typeof interval?.value === 'number' && (interval.value ?? 0) > 0
    );
    if (!valid.length) {
      return [];
    }

    const startTimestamp = typeof valid[0].timestamp === 'number' ? valid[0].timestamp : null;
    let elapsedSeconds = 0;

    return valid.map((interval, index) => {
      const rr = interval.value ?? 0;

      if (startTimestamp !== null && typeof interval.timestamp === 'number') {
        elapsedSeconds = (interval.timestamp - startTimestamp) / 1000;
      } else if (index === 0) {
        elapsedSeconds = 0;
      } else {
        elapsedSeconds += rr / 1000;
      }

      return {
        beatNumber: index + 1,
        time: Number(elapsedSeconds.toFixed(1)),
        rrInterval: Number(rr.toFixed(1)),
      };
    });
  }, [summary.rrIntervals]);


  const stabilizationTime =
    typeof summary.timeToStabilize?.value === 'number'
      ? summary.timeToStabilize.value
      : null;

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="text-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in flex flex-col shadow-2xl" style={{ backgroundColor: '#f9fafb' }}>
        <header className="sticky top-0 bg-white/95 backdrop-blur-md rounded-t-3xl border-b border-slate-200 p-6 flex items-center justify-between z-20">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">Session Summary</h1>
              {userProfile?.usage_phase && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${userProfile.usage_phase === 'calibration' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  userProfile.usage_phase === 'early_baseline' ? 'bg-sky-100 text-sky-700 border-sky-200' :
                    'bg-purple-100 text-purple-700 border-purple-200'
                  }`}>
                  {userProfile.usage_phase === 'calibration' ? 'Calibration Phase' :
                    userProfile.usage_phase === 'early_baseline' ? 'Early Baseline' : 'Full Baseline'}
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-1">
              {interpretation?.title && interpretation.title !== "HRV Summary" && interpretation.title !== "HRV Analysis"
                ? <>A complete analysis of your session and comparison <span className="font-semibold text-slate-600">{interpretation.title.replace("HRV Changes ", "").toLowerCase()}</span>.</>
                : "A complete analysis of your session."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </header>

        <main className="p-8 space-y-8">
          {/* Baseline Progress Bar (Top of Content) - Only for new sessions */}
          {userId && !isGuest && isRecentSession && (
            <BaselineProgressBar
              baseline={baseline}
              userProfile={userProfile}
              phaseData={summary.phaseData}
              isLoading={baselineLoading}
            />
          )}

          {/* Crash Alert */}
          {summary.is_crash && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">Significant Recovery Drop Detected</h3>
                <p className="text-sm text-red-700 mt-1">
                  Your HRV is significantly below your normal range (Crash).
                  This session will be excluded from your future baseline calculations to prevent skewing your data.
                  Prioritize rest and recovery today.
                </p>
              </div>
            </div>
          )}

          {/* Wellness Scores Section - Above Key Metrics */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Wellness Scores
            </h2>
            <WellnessScoreGrid
              summary={summary}
              baseline={baseline}
              interpretation={interpretation}
              phaseData={summary.phaseData}
              showProgress={isRecentSession}
            />

            {/* Nervous System Balance moved here */}
            <div className="mt-6">
              <NervousSystemBalanceGauge
                parasympatheticPercent={summary.sd1_sd2_parasympathetic_percent}
                sympatheticPercent={summary.sd1_sd2_sympathetic_percent}
                sd2_sd1_ratio={summary.sd2_sd1_ratio}
                comparison={interpretation?.baselineDetails?.find(d => d.metric === 'NS Balance') ? {
                  percentChange: interpretation.baselineDetails.find(d => d.metric === 'NS Balance')!.percentChange,
                  direction: interpretation.baselineDetails.find(d => d.metric === 'NS Balance')!.direction
                } : undefined}
              />
            </div>
          </section>

          {/* Session Overview Section - Always Visible */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              Session Overview
            </h2>

            {/* First Row: Session Duration, Mean Heart Rate, Beats */}
            <div className={`grid grid-cols-1 gap-6 ${rrQuality ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              <MetricCard
                icon={<Clock className="w-5 h-5 text-slate-400" />}
                title="Session Duration"
                value={summary.duration.value}
                unit={summary.duration.unit}
              />
              <MetricCard
                icon={<Heart className="w-5 h-5 text-slate-400" />}
                title="Mean Heart Rate"
                value={summary.meanHR.value}
                unit={summary.meanHR.unit}
              />
              <MetricCard
                icon={<Target className="w-5 h-5 text-slate-400" />}
                title="Beats"
                value={summary.dataPoints.value}
              />
              {rrQuality && (
                <MetricCard
                  icon={<Activity className={`w-5 h-5 ${rrQuality.quality === 'excellent' ? 'text-green-500' :
                    rrQuality.quality === 'good' ? 'text-blue-500' :
                      rrQuality.quality === 'fair' ? 'text-yellow-500' :
                        'text-red-500'
                    }`} />}
                  title="RR Quality"
                  value={rrQuality.percentage}
                  unit="%"
                />
              )}
            </div>

            <div className="mt-8">
              <HeartRateChart
                data={heartRateData}
                stabilizationTime={stabilizationTime}
              />
            </div>
          </section>

          {/* Advanced Metrics Toggle + Collapsible wrapper */}
          <div>
            <AdvancedMetricsToggle
              isOpen={isToggleExpanded}
              onClick={() => setIsToggleExpanded(!isToggleExpanded)}
            />

            {/* Collapsible Advanced Metrics Section */}
            <div className={`space-y-8 pt-6 transition-all duration-300 overflow-hidden ${isContentExpanded
              ? 'max-h-[99999px] opacity-100 pointer-events-auto'
              : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
              <div className="flex flex-col gap-8">
                <section className="space-y-8">
                  <section className="pt-4">
                    <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                      <Waves className="w-6 h-6 text-blue-600" />
                      HRV Analysis
                    </h2>

                    {/* Dynamic Title with Lines - moved from Analysis section */}
                    {interpretation?.title && (
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          <span className="text-sm font-bold uppercase tracking-widest text-slate-700">
                            {interpretation.title}
                          </span>
                        </div>
                        <div className="h-[1px] flex-1 bg-slate-200"></div>
                      </div>
                    )}

                    {/* HRV Metric Cards - moved from Analysis section */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                      <HrvMetricCard
                        label="RMSSD"
                        value={summary.sessionRMSSD.value?.toFixed(1) || '-'}
                        unit="ms"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'RMSSD')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'RMSSD')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                      />
                      <HrvMetricCard
                        label="SDNN"
                        value={summary.sdnn?.value?.toFixed(0) || '-'}
                        unit="ms"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'SDNN')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'SDNN')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                      />
                      <HrvMetricCard
                        label="LF"
                        value={summary.lfPower.value?.toFixed(0) || '-'}
                        unit="ms²"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'LF')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'LF')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                      />
                      <HrvMetricCard
                        label="HF"
                        value={summary.hfPower.value?.toFixed(0) || '-'}
                        unit="ms²"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'HF')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'HF')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                      />
                      <HrvMetricCard
                        label="AMo50"
                        value={summary.amode50?.toFixed(1) || '-'}
                        unit="%"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'AMo50')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'AMo50')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                      />
                    </div>

                    {/* Compact 3-column layout for remaining metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* HRV Stability */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">HRV Stability</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-bold text-slate-800 tabular-nums">{summary.hrvStability.value?.toFixed(1) ?? '-'}</span>
                          <span className="text-slate-400 text-sm font-medium">{summary.hrvStability.unit}</span>
                        </div>
                      </div>

                      {/* Restoration Index - Same style as others */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Restoration Index</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-bold text-slate-800 tabular-nums">{summary.restorationIndex.value?.toFixed(1) ?? '-'}</span>
                          <span className="text-slate-400 text-sm font-medium">/100</span>
                        </div>
                      </div>

                      {/* Respiratory Coherence */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Respiratory Coherence</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-2xl font-bold text-slate-800 tabular-nums">{summary.respCoherence.value?.toFixed(1) ?? '-'}</span>
                          <span className="text-slate-400 text-sm font-medium">{summary.respCoherence.unit}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                      Detailed Metrics
                    </h2>

                    {/* Charts with Deferred Rendering */}
                    <div className="space-y-6 min-h-[400px]">
                      {!chartsReady ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-slate-500 font-medium">Loading diagnostics...</p>
                        </div>
                      ) : (
                        <>
                          <TachogramChart data={tachogramData} />
                          <PoincarePlot data={poincareData} />
                          <BreathingCoherenceChart data={heartRateData} />
                          <AutonomicBalanceChart
                            currentRatio={summary.sd2_sd1_ratio ?? null}
                            currentTotalPower={summary.totalPower ?? null}
                          />
                        </>
                      )}
                    </div>
                  </section>
                </section>
              </div>
            </div>
          </div>

          {/* Autonomic Interpretation Section */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-purple-600" />
              Analysis
            </h2>
            <AutonomicInterpretation
              interpretation={interpretation}
              isLoading={baselineLoading}
              summary={summary}
              userId={userId}
              firstSessionDate={firstSessionDate}
              sessionId={summary.session_id ?? undefined}
              baseline={baseline}
            />
          </section>
        </main>

        <footer className="sticky bottom-0 bg-white/70 backdrop-blur-md rounded-b-3xl border-t border-slate-200 p-5 mt-auto">
          {isGuest && (
            <div className="mb-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <p className="font-semibold mb-2 text-blue-800">
                    Create an Account for Full Features
                  </p>
                  <p className="text-sm mb-3 text-blue-600">
                    Log in to save your session history, track progress over
                    time, and access advanced analytics.
                  </p>
                  <button
                    onClick={onGuestLogin}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all transform hover:scale-105"
                  >
                    Create Account / Login
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              Session completed at{' '}
              {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <button
              onClick={onReset}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 text-sm shadow-sm hover:shadow-md"
            >
              Start New Session
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SessionSummaryModal;