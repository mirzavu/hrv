'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useHrvSession } from '@/hooks/useHrvSession';
import { useBluetooth } from '@/hooks/useBluetooth';
// HRV calculations removed - now collecting raw data only

import Header from '@/components/ui/Header';
import LoginModal from '@/components/auth/LoginModal';
import UserOnboardingModal from '@/components/UserOnboardingModal';
import AuthCallback from '@/components/auth/AuthCallback';
import BluetoothCompatibilityCheck from '@/components/ui/BluetoothCompatibilityCheck';
import MetricCard from '@/components/ui/MetricCard';
import MilestoneProgressBar from '@/components/session/MilestoneProgressBar';
import SessionSummaryModal from '@/components/session/SessionSummaryModal';
import LegacyHeartRateChart from '@/components/session/LegacyHeartRateChart';
import { AuthProvider } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/ui/Toast';
import { RawHeartData } from '@/types';

const AppContent = () => {
    const [darkMode, setDarkMode] = useState(false);
    
    const { 
        user, 
        showLoginModal, 
        showOnboardingModal,
        handleLoginSuccess, 
        handleLogout, 
        handleOnboardingComplete,
        handleOnboardingSkip,
        setShowLoginModal 
    } = useAuthContext();
    
    const { addToast } = useToast();
    
    // authToken is no longer needed here
    const {
        sessionActive,
        sessionPaused,
        setSessionActive,
        startSession,
        pauseSession,
        resumeSession,
        elapsedTime,
        rawHeartData,
        addRawHeartData,
        sessionSummary,
        setSessionSummary,
        endSession,
        resetSession,
        demoDataGenerator
    } = useHrvSession(user, addToast); // Pass user and addToast

    // Create a ref to hold the latest session data for callbacks
    const latestSessionData = useRef<{ elapsedTime: number; rawHeartData: RawHeartData[]; sessionActive: boolean; sessionPaused: boolean }>({
        elapsedTime: 0,
        rawHeartData: [],
        sessionActive: false,
        sessionPaused: false,
    });
    useEffect(() => {
        latestSessionData.current = { elapsedTime, rawHeartData, sessionActive, sessionPaused };
    }, [elapsedTime, rawHeartData, sessionActive, sessionPaused]);

    const sessionPausedRef = useRef(sessionPaused);

    useEffect(() => {
        sessionPausedRef.current = sessionPaused;
    }, [sessionPaused]);

    const {
        isConnected,
        statusMessage,
        setStatusMessage,
        startRealSession,
        disconnectDevice,
    } = useBluetooth(
        setSessionActive, 
        addRawHeartData, 
        (incomingHr) => {
            if (!sessionPausedRef.current) {
                setHr(incomingHr);
            }
        }, 
        endSession, 
        addToast,
        latestSessionData // Pass the ref to the hook
    );

    const [hr, setHr] = useState<number | null>(null);

    // Live metrics now show dummy data - calculations removed
    const liveMetrics = useMemo(() => {
        let status = 'Idle';
        if (sessionActive) {
            if (sessionPaused) {
                status = 'Paused';
            } else {
                // If we have heart rate data, we're recording (demo or real)
                // If no HR data but session active, we're connecting (real session only)
                status = hr !== null ? 'Recording' : 'Connecting...';
            }
        }
        
        return {
            dataPoints: rawHeartData.length,
            avgHeartRate: hr || 0,
            sessionTime: elapsedTime,
            status,
        };
    }, [rawHeartData.length, hr, elapsedTime, sessionActive, sessionPaused]);

    const startDemoSession = () => {
        // Clear any existing intervals first
        sessionPausedRef.current = false;

        if (demoDataGenerator.current) {
            clearInterval(demoDataGenerator.current);
        }
        
        // Reset session data
        resetSession();
        setHr(null);
        
        startSession();
        setStatusMessage('Demo session running...');

        demoDataGenerator.current = setInterval(() => {
            if (!latestSessionData.current.sessionActive || sessionPausedRef.current) {
                return;
            }

            const baseHr = 65 + Math.sin(Date.now() / 10000) * 15;
            const baseRr = 60000 / baseHr;
            const newRr = baseRr + (Math.random() - 0.5) * 80;
            const currentHr = Math.round(60000 / newRr);
            
            setHr(currentHr);
            addRawHeartData({
                timestamp: Date.now(),
                heartRate: currentHr,
                rrInterval: newRr,
                rawValue: Math.random() * 1000 // dummy raw sensor value
            });
        }, 900);
    };

    const resetApp = () => {
        // Clear demo data generator
        if (demoDataGenerator.current) {
            clearInterval(demoDataGenerator.current);
        }
        
        disconnectDevice();
        resetSession();
        setHr(null);
        sessionPausedRef.current = false;
        setStatusMessage('Click "Start Session" to begin.');
    };

    // Reset status message when session ends
    useEffect(() => {
        if (!sessionActive && statusMessage === 'Demo session running...') {
            setStatusMessage('Click "Start Session" to begin.');
        }
    }, [sessionActive, statusMessage, setStatusMessage]);
    

    const handleViewCalendar = () => {
        window.location.href = '/calendar';
    };

    useEffect(() => {
        document.body.className = darkMode ? 'bg-gray-900' : 'bg-gray-100';
    }, [darkMode]);

    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
        return <AuthCallback onAuthComplete={handleLoginSuccess} />;
    }

    return (
        <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'text-white bg-gray-900' : 'text-gray-800 bg-gray-100'}`}>
            {showLoginModal && <LoginModal darkMode={darkMode} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} />}
            {showOnboardingModal && user && (
                <UserOnboardingModal 
                    darkMode={darkMode} 
                    user={user}
                    onComplete={handleOnboardingComplete}
                    onClose={handleOnboardingSkip}
                />
            )}
            
            <Header 
                user={user} 
                handleLogout={handleLogout} 
                handleViewCalendar={handleViewCalendar}
                toggleDarkMode={() => setDarkMode(!darkMode)} 
                darkMode={darkMode}
                onLoginClick={() => setShowLoginModal(true)}
            />
            
            {/* Simple HomePage without charts for now */}
            <main className="container mx-auto p-4 md:p-8">
                <BluetoothCompatibilityCheck darkMode={darkMode} />
                {sessionSummary && (
                    <SessionSummaryModal
                        summary={sessionSummary}
                        darkMode={darkMode}
                        onReset={resetApp}
                        isGuest={user?.$id === 'guest'}
                        onGuestLogin={() => setShowLoginModal(true)}
                        onClose={() => setSessionSummary(null)}
                    />
                )}
                <div className={`p-4 rounded-lg shadow-md mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${
                                sessionActive
                                    ? (sessionPaused ? 'bg-yellow-400' : 'bg-green-500 animate-pulse')
                                    : isConnected
                                        ? 'bg-green-500'
                                        : 'bg-red-500'
                            }`}></div>
                            <p className="text-sm text-center sm:text-left">{statusMessage}</p>
                        </div>
                        {!sessionActive ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        sessionPausedRef.current = false;
                                        const connectionSuccess = await startRealSession();
                                        if (connectionSuccess) {
                                            startSession();
                                        }
                                    }}
                                    disabled={sessionSummary !== null}
                                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Start Session
                                </button>
                                <button onClick={startDemoSession} disabled={sessionSummary !== null} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                    Start Demo
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
                                {!sessionPaused ? (
                                    <button
                                        onClick={() => {
                                            pauseSession();
                                            setStatusMessage('Session paused. Click resume to continue recording.');
                                        }}
                                        className="px-4 py-2 bg-yellow-400 text-gray-900 font-semibold rounded-lg shadow-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-75 transition-transform transform hover:scale-105"
                                    >
                                        Pause
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            resumeSession();
                                            setStatusMessage('Session resumed.');
                                        }}
                                        className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-opacity-75 transition-transform transform hover:scale-105"
                                    >
                                        Resume
                                    </button>
                                )}
                                <button onClick={() => endSession(elapsedTime, rawHeartData)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-transform transform hover:scale-105">
                                    End Session
                                </button>
                            </div>
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
                    <MetricCard title="Beats" value={liveMetrics.dataPoints} unit="" precision={0} darkMode={darkMode} />
                    <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
                        <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Session Time</h3>
                        <p className="text-2xl md:text-3xl font-bold">{Math.floor(liveMetrics.sessionTime / 60)}:{(liveMetrics.sessionTime % 60).toString().padStart(2, '0')}/15:00</p>
                    </div>
                    <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
                        <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Status</h3>
                        <p className="text-2xl md:text-3xl font-bold">{liveMetrics.status}</p>
                    </div>
                </div>

                <div className={`rounded-lg p-6 shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                Live Heartbeat Stream
                            </h2>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Total samples {rawHeartData.length}
                            </p>
                        </div>
                        <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                sessionActive
                                    ? sessionPaused
                                        ? darkMode
                                            ? 'border-amber-400 text-amber-200'
                                            : 'border-amber-300 text-amber-600'
                                        : isConnected
                                            ? (darkMode
                                                ? 'border-emerald-400 text-emerald-200'
                                                : 'border-emerald-400 text-emerald-600')
                                            : (darkMode
                                                ? 'border-orange-400 text-orange-200'
                                                : 'border-orange-400 text-orange-600')
                                    : darkMode
                                        ? 'border-slate-600 text-slate-300'
                                        : 'border-slate-300 text-slate-600'
                            }`}
                        >
                            <span className="h-2 w-2 rounded-full bg-current"></span>
                            {sessionActive 
                                ? (sessionPaused 
                                    ? 'Paused' 
                                    : (isConnected ? 'Streaming' : 'Connecting...'))
                                : 'Idle'}
                        </span>
                    </div>
                    <div
                        className={`relative rounded-md border border-dashed p-2 ${
                            darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-300 bg-white/90'
                        }`}
                    >
                        <LegacyHeartRateChart
                            data={rawHeartData}
                            darkMode={darkMode}
                            sessionActive={sessionActive}
                            emptyMessage={sessionActive ? 'Waiting for live heart rate data…' : 'Start a session to see the chart.'}
                        />
                        {sessionPaused && rawHeartData.length > 0 && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold uppercase tracking-[0.32em] text-white">
                                Paused
                            </div>
                        )}
                    </div>
                </div>

                <footer className="text-center mt-8 text-xs text-gray-500">
                    <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'} border`}>
                        <h3 className={`font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-blue-800'}`}>
                            Web Bluetooth Requirements
                        </h3>
                        <div className={`text-sm space-y-1 ${darkMode ? 'text-gray-300' : 'text-blue-700'}`}>
                            <p>• Use Chrome, Edge, or Opera browser</p>
                            <p>• Must be on HTTPS or localhost (secure context)</p>
                            <p>• Compatible with Android, Chrome OS, and desktop</p>
                            <p>• Polar H10 should not be paired to other devices</p>
                            <p>• If issues persist, try enabling Web Bluetooth in Chrome flags</p>
                        </div>
                    </div>
                    <p>This app is for informational purposes only and is not a medical device.</p>
                </footer>
            </main>
        </div>
    );
};

export default function Home() {
    const { toasts, addToast, removeToast } = useToast();

    return (
        <AuthProvider addToast={addToast}>
            {toasts.map(toast => <Toast key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />)}
            <AppContent />
        </AuthProvider>
    );
}