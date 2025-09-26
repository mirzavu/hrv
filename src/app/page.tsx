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
import Toast from '@/components/ui/Toast';
import MetricCard from '@/components/ui/MetricCard';
import MilestoneProgressBar from '@/components/session/MilestoneProgressBar';
import SessionSummaryModal from '@/components/session/SessionSummaryModal';
import { AuthProvider } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
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
        return {
            dataPoints: rawHeartData.length,
            avgHeartRate: hr || 0,
            sessionTime: elapsedTime,
            status: sessionActive ? (sessionPaused ? 'Paused' : 'Recording') : 'Idle',
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
    
    const handleViewReport = () => {
        window.location.href = '/reports';
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
                handleViewReport={handleViewReport}
                toggleDarkMode={() => setDarkMode(!darkMode)} 
                darkMode={darkMode}
                onLoginClick={() => setShowLoginModal(true)}
            />
            
            {/* Simple HomePage without charts for now */}
            <main className="container mx-auto p-4 md:p-8">
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
                                    onClick={() => {
                                        sessionPausedRef.current = false;
                                        startRealSession();
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
                    <MetricCard title="Session Time" value={liveMetrics.sessionTime} unit="s" darkMode={darkMode} />
                    <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
                        <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Status</h3>
                        <p className="text-2xl md:text-3xl font-bold">{liveMetrics.status}</p>
                    </div>
                </div>

                <div className={`p-4 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h2 className="text-xl font-semibold mb-4">Raw Heart Data (Total: {rawHeartData.length})</h2>
                    <div className="flex items-center justify-center h-[300px]">
                        <p className="text-gray-500">{sessionActive ? "Chart will be added later..." : "Start a session to see the chart."}</p>
                    </div>
                </div>

                <footer className="text-center mt-8 text-xs text-gray-500">
                    <p>Ensure you are on a secure context (HTTPS or localhost) for Web Bluetooth to work.</p>
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