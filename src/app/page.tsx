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
        setSessionActive,
        startSession,
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
    const latestSessionData = useRef({});
    useEffect(() => {
        latestSessionData.current = { elapsedTime, rawHeartData, sessionActive };
    }, [elapsedTime, rawHeartData, sessionActive]);

    const {
        isConnected,
        statusMessage,
        setStatusMessage,
        startRealSession,
        disconnectDevice,
    } = useBluetooth(
        setSessionActive, 
        addRawHeartData, 
        (hr) => setHr(hr), 
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
            status: sessionActive ? 'Recording' : 'Idle',
        };
    }, [rawHeartData.length, hr, elapsedTime, sessionActive]);

    const startDemoSession = () => {
        // Clear any existing intervals first
        if (demoDataGenerator.current) {
            clearInterval(demoDataGenerator.current);
        }
        
        // Reset session data
        resetSession();
        setHr(null);
        
        startSession();
        setStatusMessage('Demo session running...');

        demoDataGenerator.current = setInterval(() => {
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
                            <button onClick={() => endSession(elapsedTime, rawHeartData)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-transform transform hover:scale-105">
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
                    <MetricCard title="Data Points" value={liveMetrics.dataPoints} unit="" darkMode={darkMode} />
                    <MetricCard title="Session Time" value={liveMetrics.sessionTime} unit="s" darkMode={darkMode} />
                    <MetricCard title="Status" value={liveMetrics.status} unit="" darkMode={darkMode} />
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