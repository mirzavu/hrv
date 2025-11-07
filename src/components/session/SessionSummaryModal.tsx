import React, { useMemo } from 'react';
import { SessionSummary } from '@/types';
import { X, Heart, Activity, TrendingUp, Clock, Waves, Target, Zap, AlertTriangle, Shield, Brain, Sparkles } from 'lucide-react';
import MetricCard from './MetricCard';
import HeartRateChart from './HeartRateChart';
import PoincarePlot from './PoincarePlot';
import RestorationIndexGauge from './RestorationIndexGauge';
import NervousSystemBalanceGauge from './NervousSystemBalanceGauge';
import HRVScoreGauge from './HRVScoreGauge';
import BreathingCoherenceChart from './BreathingCoherenceChart'; // Import the new component
import TachogramChart from './TachogramChart';
import AutonomicBalanceChart from './AutonomicBalanceChart';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
  rrQuality?: {percentage: number, quality: string, totalNotifications: number, withRR: number, withoutRR: number};
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  summary,
  onReset,
  isGuest,
  onGuestLogin,
  onClose,
  rrQuality,
}) => {
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
        <header className="sticky top-0 bg-white/70 backdrop-blur-md rounded-t-3xl border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Session Summary</h1>
            <p className="text-slate-500 mt-1">
              A complete analysis of your session.
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
          {/* Wellness Scores Section - Above Key Metrics */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Wellness Scores
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <MetricCard
                icon={<Zap className="w-5 h-5 text-yellow-500" />}
                title="Energy Score"
                value={summary.energyScore.value}
                unit={summary.energyScore.unit}
              />
              <MetricCard
                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                title="Stress Score"
                value={summary.stressScore.value}
                unit={summary.stressScore.unit}
              />
              <MetricCard
                icon={<Shield className="w-5 h-5 text-green-500" />}
                title="Health Score"
                value={summary.healthScore.value}
                unit={summary.healthScore.unit}
              />
              <MetricCard
                icon={<Brain className="w-5 h-5 text-blue-500" />}
                title="Focus Score"
                value={summary.focusScore.value}
                unit={summary.focusScore.unit}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              Key Metrics
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
                  icon={<Activity className={`w-5 h-5 ${
                    rrQuality.quality === 'excellent' ? 'text-green-500' :
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

          <div className="flex flex-col gap-8">
            <section className="space-y-8">
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <Waves className="w-6 h-6 text-blue-600" />
                  HRV Analysis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  <MetricCard
                    title="Session RMSSD"
                    value={summary.sessionRMSSD.value}
                    unit={summary.sessionRMSSD.unit}
                  />
                  <MetricCard
                    title="HRV Stability"
                    value={summary.hrvStability.value}
                    unit={summary.hrvStability.unit}
                  />
                  <MetricCard
                    title="Respiratory Coherence"
                    value={summary.respCoherence.value}
                    unit={summary.respCoherence.unit}
                  />
                </div>
                
                {/* HRV Score and Nervous System Balance */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6 items-stretch">
                  <HRVScoreGauge 
                    score={summary.hrvScore.value}
                    baselineEstablished={false}
                  />
                  <NervousSystemBalanceGauge 
                    parasympatheticPercent={summary.sd1_sd2_parasympathetic_percent}
                    sympatheticPercent={summary.sd1_sd2_sympathetic_percent}
                    sd2_sd1_ratio={summary.sd2_sd1_ratio}
                  />
                </div>
                
                {/* Restoration Index */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <RestorationIndexGauge score={summary.restorationIndex.value} />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  Detailed Metrics
                </h2>
                <div className="space-y-6">
                  <TachogramChart data={tachogramData} />
                  <PoincarePlot data={poincareData} />
                  
                  {/* New Breathing Coherence Chart */}
                  <BreathingCoherenceChart data={heartRateData} />
                  
                  {/* Autonomic Balance Chart */}
                  <AutonomicBalanceChart
                    currentRatio={summary.sd2_sd1_ratio ?? null}
                    currentTotalPower={summary.totalPower ?? null}
                  />

                </div>
              </section>
            </section>
          </div>
        </main>
        
        <footer className="sticky bottom-0 bg-white/70 backdrop-blur-md rounded-b-3xl border-t border-slate-200 p-5 mt-auto">
          {isGuest && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
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