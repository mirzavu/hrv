import { useState, useEffect, useCallback, useRef } from 'react';
import { databases, AppwriteID, account } from '../appwrite';
import { Query } from 'appwrite';
import {
    calculateRMSSD,
    calculateSDNN,
    calculatePNN50,
    calculateMeanHR,
    calculateMode,
    calculateAMo50,
    calculateCV,
    calculateMxDMn
} from '../utils/hrv';

// Appwrite Database and Collection IDs - YOU MUST CREATE THESE IN THE APPWRITE CONSOLE
const DATABASE_ID = '68d3feeb0010a759c201';
const COLLECTION_ID = '68d3feeb0014bf0c49a4';

const MAX_SESSION_DURATION = 900;
const SESSION_MILESTONES = [
    { label: 'Quick Check', value: 120 },
    { label: 'Standard', value: 300 },
    { label: 'Deep Insight', value: 600 },
    { label: 'Full Analysis', value: 900 },
];

export const useHrvSession = (user, addToast) => {
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

        if (user && user.$id !== 'guest') {
            try {
                // First, find the user in the users collection
                const USERS_COLLECTION_ID = '68d3feeb001653eb83a6';
                const existingUsers = await databases.listDocuments(
                    DATABASE_ID,
                    USERS_COLLECTION_ID,
                    [Query.equal('authUserId', user.$id)]
                );

                if (existingUsers.documents.length === 0) {
                    addToast('Error: User not found in database. Please try logging out and back in.');
                    return;
                }

                const userDoc = existingUsers.documents[0];

                // Use Appwrite SDK to create the document
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTION_ID,
                    AppwriteID.unique(), // Let Appwrite generate a unique ID
                    {
                        ...sessionDataToSave,
                        user: userDoc.$id // Link to the user document via relation
                    }
                );
                addToast('Session saved successfully!');
            } catch (error) {
                console.error('Error saving session to Appwrite:', error);
                addToast('Error: Could not save session to database.');
            }
        } else {
            localStorage.setItem('hrv_guest_session', JSON.stringify(sessionDataToSave));
            addToast('Session saved locally!');
        }
    }, [addToast, user]);

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
