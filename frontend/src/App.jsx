import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { useHrvSession } from './hooks/useHrvSession';
import { useBluetooth } from './hooks/useBluetooth';
import { calculateRMSSD, calculateSDNN, calculatePNN50, calculateMeanHR } from './utils/hrv';

import Header from './components/ui/Header';
import HomePage from './pages/HomePage';
import LoginModal from './components/LoginModal';
import AuthCallback from './components/AuthCallback';
import Toast from './components/ui/Toast';

const App = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [toasts, setToasts] = useState([]);
    
    const addToast = useCallback((message) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const { user, authToken, showLoginModal, handleLoginSuccess, handleLogout, setShowLoginModal } = useAuth(addToast);
    
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
        demoDataGenerator
    } = useHrvSession(user, authToken, addToast);

    // Create a ref to hold the latest session data for callbacks
    const latestSessionData = useRef({});
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
        (hr) => setHr(hr), 
        endSession, 
        addToast,
        latestSessionData // Pass the ref to the hook
    );

    const [hr, setHr] = useState(null);

    const liveHrvMetrics = useMemo(() => {
        const latestRR = rrIntervals.slice(-128);
        return {
            rmssd: calculateRMSSD(latestRR),
            sdnn: calculateSDNN(latestRR),
            pnn50: calculatePNN50(latestRR),
            meanHR: calculateMeanHR(latestRR),
        };
    }, [rrIntervals]);

    const startDemoSession = () => {
        setSessionActive(true);
        setStatusMessage('Demo session running...');

        demoDataGenerator.current = setInterval(() => {
            const baseHr = 65 + Math.sin(Date.now() / 10000) * 15;
            const baseRr = 60000 / baseHr;
            const newRr = baseRr + (Math.random() - 0.5) * 80;
            
            setHr(Math.round(60000 / newRr));
            setRrIntervals(prev => [...prev, newRr]);
        }, 900);
    };

    const resetApp = () => {
        disconnectDevice();
        resetSession();
        setHr(null);
        setStatusMessage('Click "Start Session" to begin.');
    };
    
    const handleViewReport = () => {
        alert('Navigating to the report page (to be implemented).');
    };

    useEffect(() => {
        document.body.className = darkMode ? 'bg-gray-900' : 'bg-gray-100';
    }, [darkMode]);

    if (window.location.pathname === '/auth/callback') {
        return <AuthCallback onAuthComplete={handleLoginSuccess} />;
    }

    return (
        <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'text-white bg-gray-900' : 'text-gray-800 bg-gray-100'}`}>
            {toasts.map(toast => <Toast key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />)}
            {showLoginModal && <LoginModal darkMode={darkMode} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} />}
            
            <Header 
                user={user} 
                handleLogout={handleLogout} 
                handleViewReport={handleViewReport}
                toggleDarkMode={() => setDarkMode(!darkMode)} 
                darkMode={darkMode} 
            />
            
            <HomePage
                darkMode={darkMode}
                hr={hr}
                rrIntervals={rrIntervals}
                liveHrvMetrics={liveHrvMetrics}
                isConnected={isConnected}
                statusMessage={statusMessage}
                sessionActive={sessionActive}
                sessionSummary={sessionSummary}
                setSessionSummary={setSessionSummary}
                elapsedTime={elapsedTime}
                startRealSession={startRealSession}
                startDemoSession={startDemoSession}
                endSession={endSession}
                resetApp={resetApp}
                isGuest={user && user.id === 'guest'}
                setShowLoginModal={setShowLoginModal}
            />
        </div>
    );
};

export default App;