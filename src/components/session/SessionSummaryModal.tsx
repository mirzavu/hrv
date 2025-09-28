import React, { useMemo } from 'react';
import { SessionSummary } from '@/types';
import { X, Heart, Activity, TrendingUp, Clock, Waves, Target } from 'lucide-react';
import MetricCard from './MetricCard';
import HeartRateChart from './HeartRateChart';
import PoincarePlot from './PoincarePlot';
import RestorationIndexGauge from './RestorationIndexGauge';
import StressIndexGauge from './StressIndexGauge';
import BreathingCoherenceChart from './BreathingCoherenceChart'; // Import the new component
import TachogramChart from './TachogramChart';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  summary,
  onReset,
  isGuest,
  onGuestLogin,
  onClose,
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
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>
          </section>

          <div className="flex flex-col gap-8">
            <section className="space-y-8">
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <Waves className="w-6 h-6 text-blue-600" />
                  HRV Analysis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard
                    title="Session RMSSD"
                    value={summary.sessionRMSSD.value}
                    unit={summary.sessionRMSSD.unit}
                  />
                  <MetricCard
                    title="RMSSD Change"
                    value={summary.rmssdDelta.value}
                    unit={summary.rmssdDelta.unit}
                  />
                  <MetricCard
                    title="Stress Index"
                    value={summary.sessionStressIndex.value}
                  />
                  <MetricCard
                    title="Restoration Index"
                    value={summary.restorationIndex.value}
                    unit="/100"
                  />
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <RestorationIndexGauge score={summary.restorationIndex.value} />
                  <StressIndexGauge score={summary.sessionStressIndex.value} />
                </div>
                
                <div className="mt-8">
                  <HeartRateChart
                    data={heartRateData}
                    stabilizationTime={stabilizationTime}
                  />
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