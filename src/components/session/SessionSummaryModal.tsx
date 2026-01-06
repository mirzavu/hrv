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
import { toLocalDateString } from '@/utils/dateUtils';
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
  showComparison = true,
  darkMode = false
}: {
  label: string;
  value: string;
  unit: string;
  change: string | number;
  trend: 'up' | 'down' | 'stable';
  showComparison?: boolean;
  darkMode?: boolean;
}) => (
  <div className={`border p-4 rounded-xl transition-all flex flex-col justify-between min-h-[100px] ${darkMode ? 'bg-gray-800 border-gray-700 hover:border-indigo-400/50' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
    <span className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>{label}</span>
    <div className="flex justify-between items-end mt-2">
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold tabular-nums ${darkMode ? 'text-gray-200' : 'text-slate-800'}`}>{value}</span>
        <span className={`text-[10px] font-medium ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{unit}</span>
      </div>
      {showComparison && change !== '-' && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center ${trend === 'up' ? (darkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
          trend === 'down' ? (darkMode ? 'bg-gray-700 text-gray-400' : 'bg-slate-100 text-slate-600') :
            (darkMode ? 'bg-gray-800 text-gray-500' : 'bg-slate-50 text-slate-500')
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
  darkMode = false
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
  const [computedPhaseData, setComputedPhaseData] = useState<{ name: 'calibration' | 'early_baseline' | 'full_baseline'; progress: number; uniqueDays: number } | null>(null);
  const [previousSessions, setPreviousSessions] = useState<SessionSummaryRecord[]>([]);
  const [comparisonSessionDate, setComparisonSessionDate] = useState<Date | null>(null);
  const [baselineDatetime, setBaselineDatetime] = useState<Date | null>(null);

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

  // --- REFACTORED LOGIC FOR INTERPRETATION FLOW ---

  // 1. Fetch User Profile (for Timezone) & Comparison Data (for Phase)
  // This runs first when the modal opens or session changes
  useEffect(() => {
    const fetchContextData = async () => {
      if (!userId || isGuest) {
        setComparisonLoading(false);
        setBaselineLoading(false);
        return;
      }

      setComparisonLoading(true);

      try {


        // Fetch user profile (needed for Timezone)
        const userResponse = await fetch(`/api/user/profile?userId=${userId}`);
        let currentProfile: UserProfile | null = null;

        if (userResponse.ok) {
          const userData = await userResponse.json();
          currentProfile = userData.profile;
          setUserProfile(currentProfile);
        }

        // Determine session date
        let sessionDate: Date;
        if (summary.rrIntervals?.[0]?.timestamp && summary.rrIntervals[0].timestamp > 1600000000000) {
          sessionDate = new Date(summary.rrIntervals[0].timestamp);
        } else {
          sessionDate = new Date();
        }
        const sessionDateISO = sessionDate.toISOString();


        // Fetch comparison sessions
        const compResponse = await fetch(`/api/sessions/comparison?userId=${userId}&referenceDate=${sessionDateISO}`);
        if (compResponse.ok) {
          const comparisonData = await compResponse.json();
          const prevSessions: SessionSummaryRecord[] = comparisonData.previousSessions || [];
          setPreviousSessions(prevSessions);

          // Use fetched profile for timezone to avoid stale state issues
          const userTimezone = currentProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;


          const uniqueDatesSet = new Set<string>();
          prevSessions.forEach(s => {
            const d = s.session_date || s.createdAt;
            if (d) uniqueDatesSet.add(toLocalDateString(d, userTimezone));
          });
          // Add current session
          uniqueDatesSet.add(toLocalDateString(sessionDate, userTimezone));

          const uniqueDays = uniqueDatesSet.size;
          const progress = Math.min(Math.round((uniqueDays / 15) * 100), 100);

          let phaseName: 'calibration' | 'early_baseline' | 'full_baseline' = 'calibration';
          if (uniqueDays >= 15) phaseName = 'full_baseline';
          else if (uniqueDays >= 4) phaseName = 'early_baseline';


          setComputedPhaseData({ name: phaseName, progress, uniqueDays });

          // Also set first session date for display
          const allSessions = [...prevSessions];
          allSessions.sort((a, b) => {
            const dateA = new Date(a.session_date || a.createdAt).getTime();
            const dateB = new Date(b.session_date || b.createdAt).getTime();
            return dateA - dateB;
          });
          const firstSession = allSessions[0];
          setFirstSessionDate(firstSession ? (firstSession.session_date || firstSession.createdAt) : sessionDateISO);

        } else {
          console.error('Failed to fetch comparison sessions');
        }
      } catch (error) {
        console.error('[SessionSummaryModal] Error in Step 1:', error);
      } finally {
        setComparisonLoading(false);
      }
    };

    fetchContextData();
  }, [userId, isGuest, summary.session_id]);


  // 2. Decide Interpretation Strategy & Fetch Baseline if needed
  // This runs when computedPhaseData is available
  useEffect(() => {
    const decideStrategy = async () => {
      if (!userId || isGuest) {
        // Guest Logic
        if (isGuest) {
          const result = generateScoreBasedInterpretation(summary, true);
          setInterpretation(result);
        }
        return;
      }

      if (!computedPhaseData && !comparisonLoading) {
        return;
      }

      if (!computedPhaseData) return; // Wait for phase

      const { name: phaseName } = computedPhaseData;

      if (phaseName === 'calibration') {


        let sessionDate: Date;
        if (summary.rrIntervals?.[0]?.timestamp && summary.rrIntervals[0].timestamp > 1600000000000) {
          sessionDate = new Date(summary.rrIntervals[0].timestamp);
        } else {
          sessionDate = new Date();
        }

        const comparisonResult = findComparisonSession(sessionDate, previousSessions);

        if (comparisonResult.session) {
          const result = generateCalibrationInterpretation(
            summary,
            comparisonResult.session,
            comparisonResult.insightText,
            comparisonResult.metricTitle
          );
          setInterpretation(result);

          // Set Comparison Date
          if (comparisonResult.session.session_date || comparisonResult.session.createdAt) {
            setComparisonSessionDate(new Date(comparisonResult.session.session_date || comparisonResult.session.createdAt!));
          }

        } else {
          // Fallback to score-based if no valid comparison found
          const result = generateScoreBasedInterpretation(summary, false);
          setInterpretation(result);
          setComparisonSessionDate(null);
        }

      } else {

        setBaselineLoading(true);
        setComparisonSessionDate(null); // Comparison is vs Baseline, not a specific session (conceptually)

        // Determine session date
        let sessionDate: Date;
        if (summary.rrIntervals?.[0]?.timestamp && summary.rrIntervals[0].timestamp > 1600000000000) {
          sessionDate = new Date(summary.rrIntervals[0].timestamp);
        } else {
          sessionDate = new Date();
        }

        // Check if session is historical (more than 5 seconds old)
        const isHistoricalSession = (Date.now() - sessionDate.getTime()) > 5000;

        try {
          if (isHistoricalSession) {
            // For historical sessions, fetch baseline that existed at least 18 hours before the session

            const historyResponse = await fetch(`/api/user/baseline-history?userId=${userId}&beforeDate=${sessionDate.toISOString()}`);

            if (historyResponse.ok) {
              const data = await historyResponse.json();


              if (data.baseline && data.baseline.established) {
                setBaseline(data.baseline);
                setBaselineDatetime(data.baselineDatetime ? new Date(data.baselineDatetime) : null);
                const result = interpretHRVSession(summary, data.baseline);
                setInterpretation(result);
              } else {
                // No historical baseline found - don't show comparison
                console.warn('[SessionSummaryModal] No historical baseline found for this session. Not showing comparison.');
                setBaseline(null);
                setBaselineDatetime(null);
                const result = generateScoreBasedInterpretation(summary, false);
                setInterpretation(result);
              }
            }
          } else {
            // For recent sessions, use current baseline

            const baselineResponse = await fetch(`/api/user/baseline?userId=${userId}`);
            if (baselineResponse.ok) {
              const data = await baselineResponse.json();

              setBaseline(data.baseline);
              setBaselineDatetime(null); // Current baseline, no specific datetime to show

              if (data.baseline?.established) {
                const result = interpretHRVSession(summary, data.baseline);
                setInterpretation(result);
              } else {
                console.warn('[SessionSummaryModal] Phase says baseline but DB has none. Using score-based.');
                const result = generateScoreBasedInterpretation(summary, false);
                setInterpretation(result);
              }
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          setBaselineLoading(false);
        }
      }
    };

    decideStrategy();
  }, [computedPhaseData, userId, isGuest, previousSessions]);


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
    if (!summary.rrIntervals || summary.rrIntervals.length === 0) {
      return true;
    }

    const lastInterval = summary.rrIntervals[summary.rrIntervals.length - 1];

    // Check if timestamp appears to be an absolute epoch (milliseconds)
    // 1600000000000 is approx year 2020
    if (lastInterval.timestamp > 1600000000000) {
      const diff = Date.now() - lastInterval.timestamp;
      const isRecent = diff < 1000 * 5; // 5 seconds threshold
      // Show only if session ended within the last 5 seconds
      return isRecent;
    }

    // If relative timestamps or unsure, default to true (safest for fresh sessions)
    return true;
  }, [summary.rrIntervals, summary.session_id]);

  // Get session's actual date for display and calculations
  const sessionDate = useMemo(() => {
    if (summary.rrIntervals?.[0]?.timestamp && summary.rrIntervals[0].timestamp > 1600000000000) {
      return new Date(summary.rrIntervals?.[0].timestamp);
    }
    return new Date();
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

  const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formattedSessionDate = !isRecentSession
    ? sessionDate.toLocaleString('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    : null;



  const formattedComparisonDate = comparisonSessionDate
    ? comparisonSessionDate.toLocaleString('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    : null;

  const formattedBaselineDatetime = baselineDatetime
    ? baselineDatetime.toLocaleString('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className={`rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in flex flex-col shadow-2xl ${darkMode ? 'bg-gray-900 text-gray-100' : 'text-slate-800'}`} style={{ backgroundColor: darkMode ? '#111827' : '#f9fafb' }}>
        <header className={`sticky top-0 backdrop-blur-md rounded-t-3xl border-b p-6 flex items-center justify-between z-20 ${darkMode ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-slate-200'}`}>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {formattedSessionDate ? formattedSessionDate : "Session Summary"}
              </h1>
              {(computedPhaseData?.name || userProfile?.usage_phase) && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${(computedPhaseData?.name || userProfile?.usage_phase) === 'calibration' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  (computedPhaseData?.name || userProfile?.usage_phase) === 'early_baseline' ? (darkMode ? 'bg-sky-900/30 text-sky-300 border-sky-800' : 'bg-sky-100 text-sky-700 border-sky-200') :
                    (darkMode ? 'bg-purple-900/30 text-purple-300 border-purple-800' : 'bg-purple-100 text-purple-700 border-purple-200')
                  }`}>
                  {(computedPhaseData?.name || userProfile?.usage_phase) === 'calibration' ? 'Calibration Phase' :
                    (computedPhaseData?.name || userProfile?.usage_phase) === 'early_baseline' ? 'Early Baseline' : 'Full Baseline'}
                </span>
              )}
            </div>
            <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              {interpretation?.title && interpretation.title !== "HRV Summary" && interpretation.title !== "HRV Analysis"
                ? <>
                  A complete analysis of your session and comparison{' '}
                  <span className={`font-semibold ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                    {baselineDatetime
                      ? `with baseline on ${formattedBaselineDatetime}`
                      : comparisonSessionDate
                        ? `with session on ${formattedComparisonDate}`
                        : interpretation.title.replace("HRV Changes ", "").toLowerCase()}
                  </span>
                  .
                </>
                : "A complete analysis of your session."}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors duration-200 ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-slate-100'}`}
          >
            <X className={`w-6 h-6 ${darkMode ? 'text-gray-500' : 'text-slate-500'}`} />
          </button>
        </header>

        <main className="p-8 space-y-8">
          {/* Baseline Progress Bar (Top of Content) - Only for new sessions */}
          {userId && !isGuest && isRecentSession && (
            <BaselineProgressBar
              baseline={baseline}
              userProfile={userProfile}
              phaseData={summary.phaseData || computedPhaseData}
              isLoading={baselineLoading}
              darkMode={darkMode}
            />
          )}

          {/* Crash Alert */}
          {summary.is_crash && (
            <div className={`border rounded-2xl p-4 flex items-start gap-3 ${darkMode ? 'bg-red-900/20 border-red-900/50' : 'bg-red-50 border-red-200'}`}>
              <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
              <div>
                <h3 className={`font-semibold ${darkMode ? 'text-red-300' : 'text-red-800'}`}>Significant Recovery Drop Detected</h3>
                <p className={`text-sm mt-1 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                  Your HRV is significantly below your normal range (Crash).
                  This session will be excluded from your future baseline calculations to prevent skewing your data.
                  Prioritize rest and recovery today.
                </p>
              </div>
            </div>
          )}

          {/* Wellness Scores Section - Above Key Metrics */}
          <section>
            <h2 className={`text-xl font-medium mb-4 flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
              <Sparkles className="w-6 h-6 text-purple-600" />
              Wellness Scores
            </h2>
            <WellnessScoreGrid
              summary={summary}
              baseline={baseline}
              interpretation={interpretation}
              phaseData={summary.phaseData || computedPhaseData}
              showProgress={isRecentSession}
              darkMode={darkMode}
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
                darkMode={darkMode}
              />
            </div>
          </section>

          {/* Session Overview Section - Always Visible */}
          <section>
            <h2 className={`text-xl font-medium mb-4 flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
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
                darkMode={darkMode}
              />
              <MetricCard
                icon={<Heart className="w-5 h-5 text-slate-400" />}
                title="Mean Heart Rate"
                value={summary.meanHR.value}
                unit={summary.meanHR.unit}
                darkMode={darkMode}
              />
              <MetricCard
                icon={<Target className="w-5 h-5 text-slate-400" />}
                title="Beats"
                value={summary.dataPoints.value}
                darkMode={darkMode}
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
                  darkMode={darkMode}
                />
              )}
            </div>

            <div className="mt-8">
              <HeartRateChart
                data={heartRateData}
                stabilizationTime={stabilizationTime}
                darkMode={darkMode}
              />
            </div>
          </section>

          {/* Advanced Metrics Toggle + Collapsible wrapper */}
          <div>
            <AdvancedMetricsToggle
              isOpen={isToggleExpanded}
              onClick={() => setIsToggleExpanded(!isToggleExpanded)}
              darkMode={darkMode}
            />

            {/* Collapsible Advanced Metrics Section */}
            <div className={`space-y-8 pt-6 transition-all duration-300 overflow-hidden ${isContentExpanded
              ? 'max-h-[99999px] opacity-100 pointer-events-auto'
              : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
              <div className="flex flex-col gap-8">
                <section className="space-y-8">
                  <section className="pt-4">
                    <h2 className={`text-xl font-medium mb-4 flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
                      <Waves className="w-6 h-6 text-blue-600" />
                      HRV Analysis
                    </h2>

                    {/* Dynamic Title with Lines - moved from Analysis section */}
                    {interpretation?.title && (
                      <div className="flex items-center justify-center gap-4 mb-6">
                        <div className={`h-[1px] flex-1 ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}></div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          <span className={`text-sm font-bold uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-slate-700'}`}>
                            {interpretation.title}
                          </span>
                        </div>
                        <div className={`h-[1px] flex-1 ${darkMode ? 'bg-gray-700' : 'bg-slate-200'}`}></div>
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
                        darkMode={darkMode}
                      />
                      <HrvMetricCard
                        label="SDNN"
                        value={summary.sdnn?.value?.toFixed(0) || '-'}
                        unit="ms"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'SDNN')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'SDNN')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                        darkMode={darkMode}
                      />
                      <HrvMetricCard
                        label="LF"
                        value={summary.lfPower.value?.toFixed(0) || '-'}
                        unit="ms²"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'LF')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'LF')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                        darkMode={darkMode}
                      />
                      <HrvMetricCard
                        label="HF"
                        value={summary.hfPower.value?.toFixed(0) || '-'}
                        unit="ms²"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'HF')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'HF')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                        darkMode={darkMode}
                      />
                      <HrvMetricCard
                        label="AMo50"
                        value={summary.amode50?.toFixed(1) || '-'}
                        unit="%"
                        change={interpretation?.baselineDetails?.find(d => d.metric === 'AMo50')?.percentChange.toFixed(0) || '-'}
                        trend={(interpretation?.baselineDetails?.find(d => d.metric === 'AMo50')?.direction as 'up' | 'down' | 'stable') || 'stable'}
                        showComparison={!!interpretation?.baselineDetails}
                        darkMode={darkMode}
                      />
                    </div>

                    {/* Compact 3-column layout for remaining metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* HRV Stability */}
                      <div className={`border rounded-xl p-4 flex flex-col justify-between ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
                        <span className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>HRV Stability</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={`text-2xl font-bold tabular-nums ${darkMode ? 'text-gray-200' : 'text-slate-800'}`}>{summary.hrvStability.value?.toFixed(1) ?? '-'}</span>
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{summary.hrvStability.unit}</span>
                        </div>
                      </div>

                      {/* Restoration Index - Same style as others */}
                      <div className={`border rounded-xl p-4 flex flex-col justify-between ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
                        <span className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>Restoration Index</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={`text-2xl font-bold tabular-nums ${darkMode ? 'text-gray-200' : 'text-slate-800'}`}>{summary.restorationIndex.value?.toFixed(1) ?? '-'}</span>
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>/100</span>
                        </div>
                      </div>

                      {/* Respiratory Coherence */}
                      <div className={`border rounded-xl p-4 flex flex-col justify-between ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
                        <span className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>Respiratory Coherence</span>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className={`text-2xl font-bold tabular-nums ${darkMode ? 'text-gray-200' : 'text-slate-800'}`}>{summary.respCoherence.value?.toFixed(1) ?? '-'}</span>
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>{summary.respCoherence.unit}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className={`text-xl font-medium mb-4 flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
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
                          <TachogramChart data={tachogramData} darkMode={darkMode} />
                          <PoincarePlot data={poincareData} darkMode={darkMode} />
                          <BreathingCoherenceChart data={heartRateData} darkMode={darkMode} />
                          <AutonomicBalanceChart
                            currentRatio={summary.sd2_sd1_ratio ?? null}
                            currentTotalPower={summary.totalPower ?? null}
                            darkMode={darkMode}
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
            <h2 className={`text-xl font-medium mb-4 flex items-center gap-3 ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
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
              darkMode={darkMode}
            />
          </section>
        </main>

        <footer className={`sticky bottom-0 backdrop-blur-md rounded-b-3xl border-t p-5 mt-auto ${darkMode ? 'bg-gray-900/70 border-gray-800' : 'bg-white/70 border-slate-200'}`}>
          {isGuest && (
            <div className={`mb-4 p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <p className={`font-semibold mb-2 ${darkMode ? 'text-blue-400' : 'text-blue-800'}`}>
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
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              Session on{' '}
              {sessionDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: sessionDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
              })}
              {' at '}
              {sessionDate.toLocaleTimeString('en-US', {
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
      </div >
    </div >
  );
};

export default SessionSummaryModal;