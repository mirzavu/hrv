'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useHrvSession } from '@/hooks/useHrvSession';
import { useBluetooth } from '@/hooks/useBluetooth';
import { calculateRMSSD, calculateSDNN, calculatePNN50, calculateMeanHR } from '@/utils/hrv';
import MetricCard from '@/components/ui/MetricCard';

interface HrvAppProps {
  addToast: (message: string) => void;
}

const HrvApp: React.FC<HrvAppProps> = ({ addToast }) => {
  const { user } = useAuthContext();
  const [darkMode, setDarkMode] = useState(false);
  const [hr, setHr] = useState<number | null>(null);

  const {
    sessionActive,
    setSessionActive,
    elapsedTime,
    rrIntervals,
    setRrIntervals,
    sessionSummary,
    setSessionSummary,
    endSession,
    resetSession,
    demoDataGenerator,
    SESSION_MILESTONES,
    MAX_SESSION_DURATION,
  } = useHrvSession(user, addToast);

  // Create a ref to hold the latest session data for callbacks
  const latestSessionData = useRef({
    elapsedTime: 0,
    rrIntervals: [] as number[],
    sessionActive: false,
  });

  useEffect(() => {
    latestSessionData.current = { elapsedTime, rrIntervals, sessionActive };
  }, [elapsedTime, rrIntervals, sessionActive]);

  const {
    isConnected,
    statusMessage,
    setStatusMessage,
    startRealSession,
    disconnectDevice,
  } = useBluetooth(
    setSessionActive, 
    setRrIntervals, 
    setHr, 
    endSession, 
    addToast,
    latestSessionData
  );

  const liveHrvMetrics = useMemo(() => {
    const latestRR = rrIntervals.slice(-128);
    return {
      rmssd: calculateRMSSD(latestRR),
      sdnn: calculateSDNN(latestRR),
      pnn50: calculatePNN50(latestRR),
      meanHR: calculateMeanHR(latestRR),
    };
  }, [rrIntervals]);

  const startDemoSession = useCallback(() => {
    setSessionActive(true);
    setStatusMessage('Demo session running...');

    demoDataGenerator.current = setInterval(() => {
      const baseHr = 65 + Math.sin(Date.now() / 10000) * 15;
      const baseRr = 60000 / baseHr;
      const newRr = baseRr + (Math.random() - 0.5) * 80;
      
      setHr(Math.round(60000 / newRr));
      setRrIntervals(prev => [...prev, newRr]);
    }, 900);
  }, [setSessionActive, setStatusMessage, setRrIntervals, demoDataGenerator]);

  const resetApp = useCallback(() => {
    disconnectDevice();
    resetSession();
    setHr(null);
    setStatusMessage('Click "Start Session" to begin.');
  }, [disconnectDevice, resetSession, setStatusMessage]);

  const handleViewReport = useCallback(() => {
    addToast('Report feature coming soon!');
  }, [addToast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return Math.min((elapsedTime / MAX_SESSION_DURATION) * 100, 100);
  };

  const getCurrentMilestone = () => {
    for (let i = SESSION_MILESTONES.length - 1; i >= 0; i--) {
      if (elapsedTime >= SESSION_MILESTONES[i].value) {
        return SESSION_MILESTONES[i];
      }
    }
    return null;
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'text-white bg-gray-900' : 'text-gray-800 bg-gray-100'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">HRV Analysis App</h1>
            <p className="text-lg opacity-75">
              {user ? `Welcome back, ${user.name}!` : 'Heart Rate Variability Monitor'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'} shadow-md`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {user && user.$id !== 'guest' && (
              <button
                onClick={handleViewReport}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                View Reports
              </button>
            )}
          </div>
        </header>

        {/* Status */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Session Status</h2>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${sessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm">{sessionActive ? 'Recording' : 'Idle'}</span>
            </div>
          </div>
          
          <p className={`text-lg mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {statusMessage}
          </p>

          {sessionActive && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress: {formatTime(elapsedTime)}</span>
                <span className="text-sm">{getCurrentMilestone()?.label || 'Custom'}</span>
              </div>
              <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 flex-wrap">
            {!sessionActive ? (
              <>
                <button
                  onClick={startRealSession}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold"
                >
                  Start Real Session
                </button>
                <button
                  onClick={startDemoSession}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                  Start Demo Session
                </button>
              </>
            ) : (
              <button
                onClick={() => endSession(elapsedTime, rrIntervals)}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                End Session
              </button>
            )}
            
            <button
              onClick={resetApp}
              className={`px-6 py-3 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-colors font-semibold`}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Live Metrics */}
        {(sessionActive || rrIntervals.length > 0) && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
            <h2 className="text-2xl font-semibold mb-6">Live HRV Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                title="Heart Rate"
                value={hr}
                unit="bpm"
                darkMode={darkMode}
              />
              <MetricCard
                title="RMSSD"
                value={liveHrvMetrics.rmssd}
                unit="ms"
                darkMode={darkMode}
              />
              <MetricCard
                title="SDNN"
                value={liveHrvMetrics.sdnn}
                unit="ms"
                darkMode={darkMode}
              />
              <MetricCard
                title="pNN50"
                value={liveHrvMetrics.pnn50}
                unit="%"
                darkMode={darkMode}
              />
            </div>
            
            <div className="mt-6 text-center">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                RR Intervals Collected: {rrIntervals.length} | 
                Session Duration: {formatTime(elapsedTime)}
              </p>
            </div>
          </div>
        )}

        {/* Session Summary */}
        {sessionSummary && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className="text-2xl font-semibold mb-6">Session Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(sessionSummary).map(([key, metric]) => (
                <MetricCard
                  key={key}
                  title={metric.label}
                  value={metric.value}
                  unit={metric.unit}
                  darkMode={darkMode}
                />
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setSessionSummary(null)}
                className={`px-6 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-colors`}
              >
                Close Summary
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HrvApp;
