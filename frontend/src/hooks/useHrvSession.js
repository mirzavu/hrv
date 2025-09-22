import { useState, useEffect, useCallback, useRef } from 'react';
import {
    calculateRMSSD,
    calculateSDNN,
    calculatePNN50,
    calculateMeanHR,
    calculateMode,
    calculateAMo50,
    calculateCV,
    calculateMxDMn
} from '../utils/hrv'; // We will create this file next

const MAX_SESSION_DURATION = 900; // 15 minutes
const SESSION_MILESTONES = [
    { label: 'Quick Check', value: 120 },
    { label: 'Standard', value: 300 },
    { label: 'Deep Insight', value: 600 },
    { label: 'Full Analysis', value: 900 },
];

// Update the hook signature to accept authToken
export const useHrvSession = (user, authToken, addToast) => {
    const [sessionActive, setSessionActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [rrIntervals, setRrIntervals] = useState([]);
    const [sessionSummary, setSessionSummary] = useState(null);
    const milestonesReached = useRef(new Set());
    const sessionTimer = useRef(null);
    const demoDataGenerator = useRef(null);

    const endSession = useCallback(async (finalElapsedTime, finalRrIntervals) => {
        setSessionActive(false);
        clearInterval(demoDataGenerator.current);
        
        const meanRR = finalRrIntervals.length > 0 ? finalRrIntervals.reduce((a, b) => a + b, 0) / finalRrIntervals.length : null;
        const sdnn = calculateSDNN(finalRrIntervals);
        const mode = calculateMode(finalRrIntervals);

        const summary = {
            duration: { label: 'Duration', value: finalElapsedTime, unit: 's' },
            totalBeats: { label: 'Total Beats', value: finalRrIntervals.length, unit: '' },
            meanHR: { label: 'Mean HR', value: calculateMeanHR(finalRrIntervals), unit: 'bpm' },
            meanRR: { label: 'Mean RR', value: meanRR, unit: 'ms' },
            rmssd: { label: 'RMSSD', value: calculateRMSSD(finalRrIntervals), unit: 'ms' },
            sdnn: { label: 'SDNN', value: sdnn, unit: 'ms' },
            pnn50: { label: 'pNN50', value: calculatePNN50(finalRrIntervals), unit: '%' },
            mxdmn: { label: 'MxDMn', value: calculateMxDMn(finalRrIntervals), unit: 'ms' },
            cv: { label: 'CV', value: calculateCV(sdnn, meanRR), unit: '%' },
            mo: { label: 'Mode (Mo)', value: mode, unit: 'ms' },
            amo50: { label: 'AMo50', value: calculateAMo50(finalRrIntervals, mode), unit: '%' },
        };
        setSessionSummary(summary);

        let sessionType = 'custom';
        for (let i = SESSION_MILESTONES.length - 1; i >= 0; i--) {
            if (finalElapsedTime >= SESSION_MILESTONES[i].value) {
                sessionType = SESSION_MILESTONES[i].label;
                break;
            }
        }

        const sessionDataToSave = {
            sessionType,
            date: new Date().toISOString(),
            ...Object.fromEntries(Object.entries(summary).map(([key, { value }]) => [key, value]))
        };

        if (user && user.id !== 'guest') {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/hrv/session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Add the Authorization header
                        'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify(sessionDataToSave),
                });
                if (response.ok) addToast('Session saved successfully!');
                else throw new Error('Failed to save session');
            } catch (error) {
                console.error('Error saving session:', error);
                addToast('Error: Could not save session to database.');
            }
        } else {
            localStorage.setItem('hrv_guest_session', JSON.stringify(sessionDataToSave));
            addToast('Session saved locally!');
        }
    }, [addToast, user, authToken]); // Add authToken to dependency array

    useEffect(() => {
        if (sessionActive) {
            sessionTimer.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        } else {
            clearInterval(sessionTimer.current);
        }
        return () => clearInterval(sessionTimer.current);
    }, [sessionActive]);

    useEffect(() => {
        if (!sessionActive) return;
        const milestone = SESSION_MILESTONES.find(d => d.value === elapsedTime);
        if (milestone && !milestonesReached.current.has(elapsedTime)) {
            addToast(`${milestone.label} analysis complete!`);
            milestonesReached.current.add(elapsedTime);
        }
        if (elapsedTime >= MAX_SESSION_DURATION) {
            endSession(elapsedTime, rrIntervals);
        }
    }, [elapsedTime, sessionActive, addToast, endSession, rrIntervals]);

    const resetSession = () => {
        clearInterval(demoDataGenerator.current);
        setRrIntervals([]);
        setElapsedTime(0);
        setSessionSummary(null);
    };

    return {
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
        milestonesReached,
    };
};
