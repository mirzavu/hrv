'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useHrvSession } from '@/hooks/useHrvSession';
import { useBluetooth } from '@/hooks/useBluetooth';
import { Activity, LogOut, Pause, HeartPulse } from 'lucide-react';
// HRV calculations removed - now collecting raw data only

import Header from '@/components/ui/Header';
import LoginModal from '@/components/auth/LoginModal';
import UserOnboardingModal from '@/components/UserOnboardingModal';
import AuthCallback from '@/components/auth/AuthCallback';
import BluetoothCompatibilityCheck from '@/components/ui/BluetoothCompatibilityCheck';
import SessionSummaryModal from '@/components/session/SessionSummaryModal';
import LegacyHeartRateChart from '@/components/session/LegacyHeartRateChart';
import EndSessionConfirmationModal from '@/components/session/EndSessionConfirmationModal';
import { AuthProvider } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/ui/Toast';
import { RawHeartData, User } from '@/types';

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
        sessionStatus,
        isConnecting,
        startRealSession: startRealSessionFromHook,
        startDemoSession: startDemoSessionFromHook,
        pauseSession,
        resumeSession,
        elapsedTime,
        rawHeartData,
        addRawHeartData,
        sessionSummary,
        setSessionSummary,
        endSession,
        resetSession,
        demoDataGenerator,
        MIN_SESSION_DURATION
    } = useHrvSession(user, addToast); // Pass user and addToast

    // Create a ref to hold the latest session data for callbacks
    const latestSessionData = useRef<{ elapsedTime: number; rawHeartData: RawHeartData[]; sessionActive: boolean; sessionPaused: boolean; sessionStatus: string }>({
        elapsedTime: 0,
        rawHeartData: [],
        sessionActive: false,
        sessionPaused: false,
        sessionStatus: 'idle',
    });
    useEffect(() => {
        latestSessionData.current = { elapsedTime, rawHeartData, sessionActive, sessionPaused, sessionStatus };
    }, [elapsedTime, rawHeartData, sessionActive, sessionPaused, sessionStatus]);

    // Reset session when user signs in (to clear any previous demo session progress)
    const prevUserRef = useRef<User | null>(null);
    useEffect(() => {
        const prevUser = prevUserRef.current;
        const currentUser = user;

        // If user changed from null/guest to a logged-in user, reset session
        if (currentUser && currentUser.$id !== 'guest' &&
            (!prevUser || prevUser.$id === 'guest')) {
            // User just signed in - reset any existing session state
            if (sessionStatus === 'idle' && (elapsedTime > 0 || rawHeartData.length > 0)) {
                resetSession();
                setHr(null);
            }
        }

        prevUserRef.current = currentUser;
    }, [user, sessionStatus, elapsedTime, rawHeartData.length, resetSession]);

    const {
        isConnected,
        statusMessage,
        setStatusMessage,
        connectBluetooth,
        disconnectDevice,
        getRRQuality,
    } = useBluetooth(
        () => { }, // No longer need to setSessionActive here
        addRawHeartData,
        (incomingHr) => {
            if (sessionStatus !== 'paused') {
                setHr(incomingHr);
            }
        },
        endSession,
        addToast,
        latestSessionData // Pass the ref to the hook
    );

    const [hr, setHr] = useState<number | null>(null);
    const [rrQuality, setRrQuality] = useState<{ percentage: number, quality: string, totalNotifications: number, withRR: number, withoutRR: number } | null>(null);
    const [poorQualityWarningShown, setPoorQualityWarningShown] = useState(false);
    const [finalRRQuality, setFinalRRQuality] = useState<{ percentage: number, quality: string, totalNotifications: number, withRR: number, withoutRR: number } | null>(null);
    const [showBluetoothMessage, setShowBluetoothMessage] = useState(false);
    const [showLoginFromStart, setShowLoginFromStart] = useState(false);
    const [showEndSessionConfirmation, setShowEndSessionConfirmation] = useState(false);

    // Check if Web Bluetooth is supported
    const isWebBluetoothSupported = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return 'bluetooth' in navigator && window.isSecureContext;
    }, []);

    // Handle start button click logic
    const handleStartButtonClick = async () => {
        if (process.env.NODE_ENV === 'development') {
            console.log('🔵 [DEBUG] Start button clicked at', new Date().toISOString());
        }

        // Clear any existing demo interval first
        if (demoDataGenerator.current) {
            clearInterval(demoDataGenerator.current);
            demoDataGenerator.current = null;
        }

        // Reset session data
        resetSession();
        setHr(null);

        // Check if Web Bluetooth is supported
        if (!isWebBluetoothSupported) {
            // Show Bluetooth compatibility message
            setShowBluetoothMessage(true);
            return;
        }

        // Check if user is logged in
        if (!user || user.$id === 'guest') {
            // Show login modal
            setShowLoginFromStart(true);
            return;
        }

        // User is logged in and Bluetooth is supported - start session immediately
        await startRealSession();
    };

    // Custom login success handler for start button flow
    const handleStartLoginSuccess = async (userData?: User) => {
        if (userData) {
            await handleLoginSuccess(userData);
        }
        setShowLoginFromStart(false);

        // Don't auto-start session after login - user needs to click Start again
        // This ensures proper user gesture for Bluetooth
    };

    // Start real session function
    const startRealSession = async () => {
        // Start session timer immediately
        const sessionStarted = startRealSessionFromHook();
        if (sessionStarted) {
            if (process.env.NODE_ENV === 'development') {
                console.log('🟢 [DEBUG] Timer started, connecting to Bluetooth at', new Date().toISOString());
            }
            // Connect Bluetooth in background
            const connectionSuccess = await connectBluetooth();
            if (!connectionSuccess) {
                // Connection failed, reset to idle
                resetSession();
                // Show Bluetooth compatibility message
                setShowBluetoothMessage(true);
            } else {
                // Connection successful, hide Bluetooth message
                setShowBluetoothMessage(false);
            }
            // Timer will start automatically when first data received
        }
    };

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
        if (demoDataGenerator.current) {
            clearInterval(demoDataGenerator.current);
        }

        // Reset local UI state
        setHr(null);
        // Hide Bluetooth message when starting demo
        setShowBluetoothMessage(false);
        // Hide login modal if it was shown from start button
        setShowLoginFromStart(false);

        // Start demo session (hook will handle reset if needed)
        const sessionStarted = startDemoSessionFromHook();
        if (sessionStarted) {
            setStatusMessage('Demo connecting...');

            demoDataGenerator.current = setInterval(() => {
                if (!latestSessionData.current.sessionActive || latestSessionData.current.sessionPaused) {
                    return;
                }

                // Update status message when first data is about to be sent
                if (latestSessionData.current.sessionStatus === 'connecting') {
                    setStatusMessage('Demo session running...');
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
            }, 45); // 20x speed: 900ms / 20 = 45ms
        }
    };

    const handleEndSessionConfirm = () => {
        setShowEndSessionConfirmation(false);

        // For real sessions, disconnect Bluetooth first
        if (isConnected) {
            disconnectDevice();
        }
        const finalRRQualityData = getRRQuality(); // Get final RR quality before ending
        setFinalRRQuality(finalRRQualityData); // Store for session summary display
        endSession(elapsedTime, rawHeartData, finalRRQualityData);
        setHr(null); // Clear heart rate display
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
        // Clear all modal states
        setShowBluetoothMessage(false);
        setShowLoginFromStart(false);
    };

    // Reset status message when session ends
    useEffect(() => {
        if (!sessionActive && statusMessage === 'Demo session running...') {
            setStatusMessage('Click "Start Session" to begin.');
        }
    }, [sessionActive, statusMessage, setStatusMessage]);

    // Monitor RR quality during session
    useEffect(() => {
        if (!sessionActive) {
            setRrQuality(null);
            setPoorQualityWarningShown(false); // Reset warning flag
            return;
        }

        const qualityInterval = setInterval(() => {
            const quality = getRRQuality();
            setRrQuality(quality);

            // Show warning toast for poor quality (<60%) - only once per session
            if (quality.percentage < 60 && quality.quality === 'poor' && !poorQualityWarningShown) {
                addToast(
                    `⚠️ Poor sensor contact detected (${quality.percentage}% real RR data). Consider wetting the strap for more accurate readings.`
                );
                setPoorQualityWarningShown(true);
            }
        }, 2000); // Check every 2 seconds

        return () => clearInterval(qualityInterval);
    }, [sessionActive, getRRQuality, addToast, poorQualityWarningShown]);


    const handleViewCalendar = () => {
        window.location.href = '/calendar';
    };

    useEffect(() => {
        document.body.className = darkMode ? 'bg-gray-900' : 'bg-gray-100';
    }, [darkMode]);

    // Calculate current step for progress stepper (5 steps mapped to 1-5 minute milestones)
    const currentStep = useMemo(() => {
        if (!sessionActive) return -1;
        if (elapsedTime < 60) return 0;   // Start - <1min
        if (elapsedTime < 120) return 1;  // Quick Check - 1-2min
        if (elapsedTime < 180) return 2;  // Standard Analysis - 2-3min
        if (elapsedTime < 240) return 3;  // Deep Insight - 3-4min
        return 4; // Full Analysis - 4-5min (Ideal duration)
    }, [sessionActive, elapsedTime]);

    // Get current phase name and description (5 steps mapped to 1-5 minute milestones)
    const currentPhase = useMemo(() => {
        if (!sessionActive) return { name: '', description: '', color: '' };
        if (elapsedTime < 60) return { name: 'Initialization', description: 'Session starting...', color: 'bg-blue-500' };
        if (elapsedTime < 120) return { name: 'Quick Check', description: 'Collecting baseline data', color: 'bg-teal-500' };
        if (elapsedTime < 180) return { name: 'Standard Analysis', description: 'Analyzing heart rate patterns', color: 'bg-emerald-500' };
        if (elapsedTime < 240) return { name: 'Deep Insight', description: 'Evaluating ANS balance', color: 'bg-amber-500' };
        return { name: 'Full Analysis', description: 'Ideal duration achieved', color: 'bg-orange-500' };
    }, [sessionActive, elapsedTime]);

    // Calculate progress percentage (based on 5-minute ideal duration)
    const progress = useMemo(() => {
        const idealTime = 5 * 60; // 5 minutes (ideal duration)
        return Math.min(Math.round((elapsedTime / idealTime) * 100), 100);
    }, [elapsedTime]);

    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
        return <AuthCallback onAuthComplete={handleLoginSuccess} />;
    }

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
            {(showLoginModal || showLoginFromStart) && (
                <LoginModal
                    darkMode={darkMode}
                    onClose={() => {
                        setShowLoginModal(false);
                        setShowLoginFromStart(false);
                    }}
                    onLoginSuccess={showLoginFromStart ? handleStartLoginSuccess : handleLoginSuccess}
                />
            )}
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

            <main className="flex-1 p-4 md:p-8 lg:p-10">
                <div className="max-w-7xl mx-auto">
                    <BluetoothCompatibilityCheck darkMode={darkMode} showMessage={showBluetoothMessage} />
                    {sessionSummary && (
                        <SessionSummaryModal
                            summary={sessionSummary}
                            darkMode={darkMode}
                            onReset={resetApp}
                            isGuest={user?.$id === 'guest'}
                            onGuestLogin={() => setShowLoginModal(true)}
                            userId={user?.$id ?? null}
                            onClose={() => setSessionSummary(null)}
                            rrQuality={finalRRQuality || undefined}
                        />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                        {/* Main Column Wrapper (span-2) */}
                        <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">

                            {/* Main Column: Live Monitor */}
                            <div className={`rounded-xl shadow-lg p-6 md:p-8 flex flex-col relative overflow-hidden transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>

                                {/* Faint Background Icon */}
                                <HeartPulse className={`absolute -right-16 -top-10 w-64 h-64 opacity-50 rotate-[-10deg] ${darkMode ? 'text-gray-700' : 'text-gray-100'}`} strokeWidth={3} />

                                {/* Header */}
                                <div className="flex justify-between items-center mb-6 z-10">
                                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Live Monitor</h2>
                                    <div className="flex items-center gap-2 text-green-500">
                                        <div className={`w-2 h-2 rounded-full ${sessionActive
                                                ? (sessionPaused ? 'bg-yellow-400' : 'bg-green-500 animate-pulse')
                                                : isConnected
                                                    ? 'bg-green-500'
                                                    : 'bg-red-500'
                                            }`}></div>
                                        <span className="text-lg font-medium">{liveMetrics.status}</span>
                                    </div>
                                </div>

                                {/* Current Phase Indicator */}
                                {sessionActive && currentPhase.name && (
                                    <div className={`mb-6 z-10 rounded-lg border-2 ${darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'} shadow-md p-4 flex items-center gap-4`}>
                                        <div className={`${currentPhase.color} rounded-full p-3 shadow-lg flex items-center justify-center`}>
                                            <HeartPulse className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Current Phase</p>
                                            <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currentPhase.name}</p>
                                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>{currentPhase.description}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Hero Stat: Live HR */}
                                <div className="flex-1 flex flex-col items-center justify-center text-center my-6 md:my-8 z-10">
                                    <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Live HR (BPM)</h3>
                                    <p className={`text-7xl lg:text-8xl font-extrabold leading-none mt-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{hr ?? 0}</p>
                                </div>

                                {/* Secondary Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 z-10 mt-6">
                                    <div className={`rounded-lg p-5 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                        <h4 className={`text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Beats</h4>
                                        <p className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{liveMetrics.dataPoints}</p>
                                    </div>
                                    <div className={`rounded-lg p-5 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                        <h4 className={`text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Session Time</h4>
                                        <p className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{Math.floor(liveMetrics.sessionTime / 60)}:{(liveMetrics.sessionTime % 60).toString().padStart(2, '0')}<span className={`text-3xl ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/5:00</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* Live Chart Panel */}
                            <div className={`rounded-xl shadow-lg p-6 md:p-8 transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                <div className={`flex items-center gap-2 mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                    <Activity className="w-6 h-6 text-teal-500" />
                                    <h2 className="text-xl font-semibold">Live Heartbeat</h2>
                                </div>
                                <div className={`relative rounded-md border border-dashed p-2 ${darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-300 bg-white/90'}`}>
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

                        </div>

                        {/* Side Column: Session Progress */}
                        <div className={`lg:col-span-1 rounded-xl shadow-lg p-6 md:p-8 flex flex-col gap-6 transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>

                            {/* Session Controls Section */}
                            <div className={`rounded-lg p-5 -m-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                <h2 className={`text-xl font-semibold mb-5 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Session Control</h2>

                                {sessionStatus === 'idle' || sessionStatus === 'connecting' || sessionStatus === 'completed' ? (
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <button
                                            onClick={handleStartButtonClick}
                                            disabled={sessionSummary !== null || sessionStatus === 'connecting'}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors text-base cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {sessionStatus === 'connecting' && (
                                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            <span>Start</span>
                                        </button>
                                        <button
                                            onClick={startDemoSession}
                                            disabled={sessionSummary !== null || sessionStatus === 'connecting'}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors text-base cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <span>Demo</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        {!sessionPaused ? (
                                            <button
                                                onClick={() => {
                                                    pauseSession();
                                                    setStatusMessage('Session paused. Click resume to continue recording.');
                                                }}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-yellow-900 rounded-lg font-medium hover:bg-yellow-500 transition-colors text-base cursor-pointer"
                                            >
                                                <Pause className="w-5 h-5" />
                                                <span>Pause</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    resumeSession();
                                                    setStatusMessage('Session resumed.');
                                                }}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors text-base cursor-pointer"
                                            >
                                                <span>Resume</span>
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            // Show confirmation modal if session is less than 3 minutes
                                            if (elapsedTime < 180) {
                                                setShowEndSessionConfirmation(true);
                                            } else {
                                                // For sessions >= 3 minutes, end directly
                                                // For real sessions, disconnect Bluetooth first
                                                if (isConnected) {
                                                    disconnectDevice();
                                                }
                                                const finalRRQualityData = getRRQuality(); // Get final RR quality before ending
                                                setFinalRRQuality(finalRRQualityData); // Store for session summary display
                                                endSession(elapsedTime, rawHeartData, finalRRQualityData);
                                                setHr(null); // Clear heart rate display
                                            }
                                        }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-base cursor-pointer">
                                            <LogOut className="w-5 h-5" />
                                            <span>End</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Progress Bar Section */}
                            <div className={`rounded-lg p-5 -m-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-teal-600">Demo Session</span>
                                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{progress}%</span>
                                </div>
                                <div className={`w-full rounded-full h-2.5 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                                    <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>

                            {/* Vertical Stepper Section */}
                            <div className={`rounded-lg p-5 -m-2 flex-1 flex flex-col ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                <h3 className={`font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Session Progress</h3>
                                <ol className={`relative border-l-2 ml-4 flex flex-col flex-1 ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                                    {/* Step 1: Start */}
                                    <li className="flex-1 ml-8 flex flex-col justify-center">
                                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${currentStep >= 0 ? 'bg-teal-500' : 'bg-gray-200'
                                            }`}>
                                            {currentStep >= 0 ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-bold text-gray-500 text-sm">1</span>
                                            )}
                                        </span>
                                        <h4 className={`font-medium ${currentStep >= 0 ? (darkMode ? 'text-gray-200' : 'text-gray-800') : 'text-gray-500'}`}>Start</h4>
                                        {currentStep >= 0 && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Session initialized</p>}
                                    </li>

                                    {/* Step 2: Quick Check */}
                                    <li className="flex-1 ml-8 flex flex-col justify-center">
                                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${currentStep >= 1 ? 'bg-teal-500' : 'bg-gray-200'
                                            }`}>
                                            {currentStep >= 1 ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-bold text-gray-500 text-sm">2</span>
                                            )}
                                        </span>
                                        <h4 className={`font-medium ${currentStep >= 1 ? (darkMode ? 'text-gray-200' : 'text-gray-800') : 'text-gray-500'}`}>Quick Check</h4>
                                        {currentStep >= 0 && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentStep >= 1 ? 'Baseline established' : 'Pending'}</p>}
                                    </li>

                                    {/* Step 3: Standard Analysis */}
                                    <li className="flex-1 ml-8 flex flex-col justify-center">
                                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${currentStep === 2 ? 'bg-teal-100 ring-4 ring-white' : currentStep >= 2 ? 'bg-teal-500' : 'bg-gray-200'
                                            }`}>
                                            {currentStep === 2 ? (
                                                <span className="font-bold text-teal-600 text-sm">3</span>
                                            ) : currentStep >= 2 ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-bold text-gray-500 text-sm">3</span>
                                            )}
                                        </span>
                                        <h4 className={`font-medium ${currentStep === 2 ? 'text-teal-600' : currentStep >= 2 ? (darkMode ? 'text-gray-200' : 'text-gray-800') : 'text-gray-500'}`}>Standard Analysis</h4>
                                        {currentStep >= 0 && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentStep === 2 ? 'Currently analyzing...' : currentStep >= 2 ? 'Analysis complete' : 'Pending'}</p>}
                                    </li>

                                    {/* Step 4: Deep Insight */}
                                    <li className="flex-1 ml-8 flex flex-col justify-center">
                                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${currentStep === 3 ? 'bg-teal-100 ring-4 ring-white' : currentStep >= 3 ? 'bg-teal-500' : 'bg-gray-200'
                                            }`}>
                                            {currentStep === 3 ? (
                                                <span className="font-bold text-teal-600 text-sm">4</span>
                                            ) : currentStep >= 3 ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-bold text-gray-500 text-sm">4</span>
                                            )}
                                        </span>
                                        <h4 className={`font-medium ${currentStep === 3 ? 'text-teal-600' : currentStep >= 3 ? (darkMode ? 'text-gray-200' : 'text-gray-800') : 'text-gray-500'}`}>Deep Insight</h4>
                                        {currentStep >= 0 && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentStep === 3 ? 'Deep analysis in progress...' : currentStep >= 3 ? 'Insights generated' : 'Pending'}</p>}
                                    </li>

                                    {/* Step 5: Full Analysis */}
                                    <li className="flex-1 ml-8 flex flex-col justify-center">
                                        <span className={`absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ${currentStep === 4 ? 'bg-teal-100 ring-4 ring-white' : currentStep >= 4 ? 'bg-teal-500' : 'bg-gray-200'
                                            }`}>
                                            {currentStep === 4 ? (
                                                <span className="font-bold text-teal-600 text-sm">5</span>
                                            ) : currentStep >= 4 ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-bold text-gray-500 text-sm">5</span>
                                            )}
                                        </span>
                                        <h4 className={`font-medium ${currentStep === 4 ? 'text-teal-600' : currentStep >= 4 ? (darkMode ? 'text-gray-200' : 'text-gray-800') : 'text-gray-500'}`}>Full Analysis</h4>
                                        {currentStep >= 0 && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentStep === 4 ? 'Comprehensive analysis...' : currentStep >= 4 ? 'Ideal duration achieved ✓' : 'Pending'}</p>}
                                    </li>

                                </ol>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-4 text-center mt-8">
                <p className="text-xs text-gray-500">
                    This app is for informational purposes only and is not a medical device.
                </p>
            </footer>

            {/* End Session Confirmation Modal */}
            {showEndSessionConfirmation && (
                <EndSessionConfirmationModal
                    elapsedTime={elapsedTime}
                    onConfirm={handleEndSessionConfirm}
                    onCancel={() => setShowEndSessionConfirmation(false)}
                    darkMode={darkMode}
                />
            )}
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