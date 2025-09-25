import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/ui/MetricCard';
import MilestoneProgressBar from '@/components/session/MilestoneProgressBar';
import SessionSummaryModal from '@/components/session/SessionSummaryModal';
import { HrvSummary } from '@/types';

interface HomePageProps {
  darkMode: boolean;
  hr: number | null;
  rrIntervals: number[];
  liveHrvMetrics: {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    meanHR: number;
  };
  isConnected: boolean;
  statusMessage: string;
  sessionActive: boolean;
  sessionSummary: HrvSummary | null;
  setSessionSummary: (summary: HrvSummary | null) => void;
  elapsedTime: number;
  startRealSession: () => void;
  startDemoSession: () => void;
  endSession: (elapsedTime: number, rrIntervals: number[]) => void;
  resetApp: () => void;
  isGuest: boolean;
  setShowLoginModal: (show: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  darkMode,
  hr,
  rrIntervals,
  liveHrvMetrics,
  isConnected,
  statusMessage,
  sessionActive,
  sessionSummary,
  setSessionSummary,
  elapsedTime,
  startRealSession,
  startDemoSession,
  endSession,
  resetApp,
  isGuest,
  setShowLoginModal,
}) => {
  const chartData = useMemo(() =>
    rrIntervals.map((rr, index) => ({ name: index + 1, rr })),
    [rrIntervals]
  );

  return (
    <main className="container mx-auto p-4 md:p-8">
      {sessionSummary && (
        <SessionSummaryModal
          summary={sessionSummary}
          darkMode={darkMode}
          onReset={resetApp}
          isGuest={isGuest}
          onGuestLogin={() => setShowLoginModal(true)}
          onClose={() => setSessionSummary(null)}
        />
      )}
      <div className={`p-4 rounded-lg shadow-md mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <p className="text-sm text-center sm:text-left">{statusMessage}</p>
          </div>
          {!sessionActive ? (
            <div className="flex gap-2">
              <button onClick={startRealSession} disabled={sessionSummary !== null} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                Start Session
              </button>
              <button onClick={startDemoSession} disabled={sessionSummary !== null} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                Start Demo
              </button>
            </div>
          ) : (
            <button onClick={() => endSession(elapsedTime, rrIntervals)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-transform transform hover:scale-105">
              End Session
            </button>
          )}
        </div>
        {sessionActive && (
          <MilestoneProgressBar 
            elapsedTime={elapsedTime} 
            darkMode={darkMode}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Live HR" value={hr} unit="BPM" darkMode={darkMode} />
        <MetricCard title="Live RMSSD" value={liveHrvMetrics.rmssd} unit="ms" darkMode={darkMode} />
        <MetricCard title="Live SDNN" value={liveHrvMetrics.sdnn} unit="ms" darkMode={darkMode} />
        <MetricCard title="Live pNN50" value={liveHrvMetrics.pnn50} unit="%" darkMode={darkMode} />
      </div>

      <div className={`p-4 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className="text-xl font-semibold mb-4">Live RR Intervals (Total: {rrIntervals.length})</h2>
        {sessionActive && rrIntervals.length > 1 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.slice(-256)}>
              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#4A5568' : '#ccc'} />
              <XAxis dataKey="name" stroke={darkMode ? '#A0AEC0' : '#666'} />
              <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke={darkMode ? '#A0AEC0' : '#666'} label={{ value: 'RR Interval (ms)', angle: -90, position: 'insideLeft', fill: darkMode ? '#A0AEC0' : '#666' }} />
              <Tooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(45, 55, 72, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderColor: darkMode ? '#4A5568' : '#ccc', color: darkMode ? '#E2E8F0' : '#333' }} />
              <Line type="monotone" dataKey="rr" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-gray-500">{sessionActive ? "Waiting for RR interval data..." : "Start a session to see the chart."}</p>
          </div>
        )}
      </div>

      <footer className="text-center mt-8 text-xs text-gray-500">
        <p>Ensure you are on a secure context (HTTPS or localhost) for Web Bluetooth to work.</p>
        <p>This app is for informational purposes only and is not a medical device.</p>
      </footer>
    </main>
  );
};

export default HomePage;
