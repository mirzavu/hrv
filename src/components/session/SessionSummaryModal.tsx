import React from 'react';
import { SessionSummary } from '@/types';
import { formatRmssdDelta } from '@/utils/sessionSummaryFormat';
import { 
  X, 
  Heart, 
  Activity, 
  TrendingUp, 
  Clock, 
  Waves, 
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  TrendingDown,
  Minus
} from 'lucide-react';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
}

type SignalType = 'good' | 'warning' | 'alert' | 'info';
type TrendType = 'up' | 'down' | 'neutral';

interface Signal {
  type: SignalType;
  message: string;
}

// Helper functions for signal detection and styling
const getSignalIcon = (type: SignalType) => {
  const iconProps = { className: "w-5 h-5" };
  switch (type) {
    case 'good': return <CheckCircle {...iconProps} className="w-5 h-5 text-emerald-500" />;
    case 'warning': return <AlertTriangle {...iconProps} className="w-5 h-5 text-amber-500" />;
    case 'alert': return <AlertTriangle {...iconProps} className="w-5 h-5 text-rose-500" />;
    case 'info': return <Info {...iconProps} className="w-5 h-5 text-sky-500" />;
  }
};

const getSignalGradient = (type: SignalType) => {
  switch (type) {
    case 'good': return 'from-emerald-300 to-green-400';
    case 'warning': return 'from-amber-200 to-yellow-300';
    case 'alert': return 'from-rose-400 to-red-500';
    case 'info': return 'from-sky-300 to-blue-400';
    default: return 'from-slate-200 to-slate-200';
  }
};

const getTrendIcon = (trend: TrendType) => {
  const iconProps = { className: "w-5 h-5" };
  switch (trend) {
    case 'up': return <TrendingUp {...iconProps} className="w-5 h-5 text-emerald-600" />;
    case 'down': return <TrendingDown {...iconProps} className="w-5 h-5 text-rose-600" />;
    case 'neutral': return <Minus {...iconProps} className="w-5 h-5 text-slate-500" />;
  }
};

// Determine signal based on metric values (reasonable defaults)
const getMetricSignal = (metricName: string, value: number | null): Signal | undefined => {
  if (value === null) return undefined;
  
  switch (metricName) {
    case 'Session Duration':
      if (value >= 300) return { type: 'good', message: 'Excellent session duration for comprehensive analysis.' };
      if (value >= 120) return { type: 'info', message: 'Good session length for basic HRV assessment.' };
      return { type: 'warning', message: 'Short session - consider longer duration for better accuracy.' };
      
    case 'Mean Heart Rate':
      if (value >= 60 && value <= 100) return { type: 'good', message: 'Normal resting heart rate range.' };
      if (value < 60) return { type: 'info', message: 'Low heart rate - common in well-trained athletes.' };
      return { type: 'warning', message: 'Elevated heart rate - ensure you are well-rested during measurement.' };
      
    case 'Data Points':
      if (value >= 50) return { type: 'good', message: 'Excellent data quality with sufficient measurement points.' };
      if (value >= 20) return { type: 'info', message: 'Good data quality for reliable analysis.' };
      return { type: 'warning', message: 'Limited data points - longer session recommended.' };
      
    case 'Session RMSSD':
      if (value >= 50) return { type: 'good', message: 'Excellent HRV indicating good autonomic function.' };
      if (value >= 30) return { type: 'info', message: 'Good HRV levels within normal range.' };
      if (value >= 15) return { type: 'warning', message: 'Moderate HRV - consider stress management techniques.' };
      return { type: 'alert', message: 'Low HRV detected - prioritize recovery and stress reduction.' };
      
    case 'RMSSD Change':
      if (Math.abs(value) < 5) return { type: 'good', message: 'Stable HRV throughout session indicates consistency.' };
      if (value > 0) return { type: 'info', message: 'HRV improved during session - positive adaptation.' };
      return { type: 'warning', message: 'HRV decreased during session - may indicate fatigue or stress.' };
      
    case 'Stress Index':
      if (value < 50) return { type: 'good', message: 'Low stress levels - excellent autonomic balance.' };
      if (value < 150) return { type: 'info', message: 'Moderate stress levels - within normal range.' };
      if (value < 300) return { type: 'warning', message: 'Elevated stress detected - consider relaxation techniques.' };
      return { type: 'alert', message: 'High stress levels - prioritize recovery and stress management.' };
      
    case 'Restoration Index':
      if (value >= 70) return { type: 'good', message: 'Excellent restoration capacity - well-recovered state.' };
      if (value >= 50) return { type: 'info', message: 'Good restoration levels indicating adequate recovery.' };
      if (value >= 30) return { type: 'warning', message: 'Moderate restoration - ensure adequate sleep and recovery.' };
      return { type: 'alert', message: 'Low restoration score - prioritize rest and recovery activities.' };
      
    default:
      return { type: 'info', message: 'Metric recorded successfully.' };
  }
};

const getTrend = (metricName: string, value: number | null): TrendType | undefined => {
  if (value === null) return undefined;
  
  // For RMSSD Change, we can determine trend from the value itself
  if (metricName === 'RMSSD Change') {
    if (value > 2) return 'up';
    if (value < -2) return 'down';
    return 'neutral';
  }
  
  // For other metrics, we don't have historical data, so return undefined
  return undefined;
};

const MetricCard: React.FC<{
  icon?: React.ReactNode;
  title: string;
  value: number | null;
  unit?: string;
  trend?: TrendType;
  signal?: Signal;
}> = ({ icon, title, value, unit, trend, signal }) => {
  const displayValue = value !== null ? 
    (title === 'RMSSD Change' ? formatRmssdDelta(value).value : value.toFixed(1)) 
    : 'N/A';
  
  const actualSignal = signal || getMetricSignal(title, value);
  const actualTrend = trend || getTrend(title, value);

  return (
    <div className={`p-[1px] bg-gradient-to-br ${getSignalGradient(actualSignal?.type || 'info')} rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300`}>
      <div className="bg-white rounded-[15px] p-5 h-full relative group">
        {actualSignal && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-20 shadow-xl mb-2">
            <div className="flex items-start gap-2.5">
              {getSignalIcon(actualSignal.type)}
              <div>
                <span className="font-bold capitalize">{actualSignal.type} Signal</span>
                <p className="text-slate-300">{actualSignal.message}</p>
              </div>
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 rotate-45 -mt-1.5"></div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-medium text-[#737b87]">{title}</h3>
          </div>
          {actualTrend && getTrendIcon(actualTrend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-slate-700">{displayValue}</span>
          {unit && <span className="text-base font-medium text-slate-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ 
  summary, 
  onReset, 
  isGuest, 
  onGuestLogin, 
  onClose 
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in flex flex-col shadow-2xl border border-slate-200">
        <header className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Session Summary</h1>
            <p className="text-slate-500 mt-1">A complete analysis of your session.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </header>

        <main className="p-8 space-y-8">
          {/* Key Metrics Section */}
          <section>
            <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-600" />
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                icon={<Clock className="w-5 h-5 text-slate-400"/>} 
                title="Session Duration" 
                value={summary.duration.value} 
                unit={summary.duration.unit} 
              />
              <MetricCard 
                icon={<Heart className="w-5 h-5 text-slate-400"/>} 
                title="Mean Heart Rate" 
                value={summary.meanHR.value} 
                unit={summary.meanHR.unit} 
              />
              <MetricCard 
                icon={<Target className="w-5 h-5 text-slate-400"/>} 
                title="Data Points" 
                value={summary.dataPoints.value} 
              />
            </div>
          </section>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <section className="space-y-8">
              {/* HRV Analysis */}
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <Waves className="w-6 h-6 text-blue-600" />
                  HRV Analysis
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              </section>

              {/* Detailed Metrics Section - Including Heart Rhythm */}
              <section>
                <h2 className="text-xl font-medium text-slate-800 mb-4 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  Detailed Metrics
                </h2>
                <div className="space-y-6">
                  {/* Interactive Graphs Grid - 3 rows, 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Row 1 */}
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">� Heart Rate Timeline</p>
                      <p className="text-sm text-slate-500">Tachogram with stabilization markers</p>
                    </div>
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">🎯 Stress Index Gauge</p>
                      <p className="text-sm text-slate-500">Green/Amber/Red indicator</p>
                    </div>
                    
                    {/* Row 2 */}
                    <div className="p-0.5 bg-gradient-to-br from-sky-300 to-blue-400 rounded-2xl shadow-sm">
                      <div className="bg-white rounded-[15px] p-6">
                        <h3 className="font-semibold text-slate-700 mb-1">💓 Heart Rhythm</h3>
                        <p className="text-slate-500 text-sm mb-4">
                          Poincaré Plot - RRₙ vs RRₙ₊₁ scatter
                        </p>
                        <div className="bg-slate-50 rounded-xl p-8 border border-slate-200 text-center">
                          <p className="text-slate-600">Beat-to-beat pattern analysis</p>
                          <p className="text-sm text-slate-500 mt-1">Coming in next update</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">🎮 Restoration Index</p>
                      <p className="text-sm text-slate-500">Gamified gauge (0-100)</p>
                    </div>
                    
                    {/* Row 3 */}
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">🌊 Breathing Coherence</p>
                      <p className="text-sm text-slate-500">Waveform with breathing target line</p>
                    </div>
                    <div className="bg-slate-100 rounded-2xl p-6 text-center">
                      <p className="text-slate-600 mb-2">� Signal Quality Timeline</p>
                      <p className="text-sm text-slate-500">Artifact markers and quality indicators</p>
                    </div>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </main>

        <footer className="sticky bottom-0 bg-white rounded-b-3xl border-t border-slate-200 p-5 mt-auto">
          {/* Guest Login Prompt */}
          {isGuest && (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <p className="font-semibold mb-2 text-blue-800">
                    Create an Account for Full Features
                  </p>
                  <p className="text-sm mb-3 text-blue-600">
                    Log in to save your session history, track progress over time, and access advanced analytics.
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
              Session completed at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
