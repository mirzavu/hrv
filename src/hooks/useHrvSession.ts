'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { databases, AppwriteID } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { User, SessionSummary, SessionMilestone, DATABASE_ID, USERS_COLLECTION_ID, SESSIONS_COLLECTION_ID } from '@/types';
import {
  calculateRMSSD,
  calculateSDNN,
  calculatePNN50,
  calculateMeanHR,
  calculateMode,
  calculateAMo50,
  calculateCV,
  calculateMxDMn
} from '@/utils/hrv';

const MAX_SESSION_DURATION = 900;
const SESSION_MILESTONES: SessionMilestone[] = [
  { label: 'Quick Check', value: 120 },
  { label: 'Standard', value: 300 },
  { label: 'Deep Insight', value: 600 },
  { label: 'Full Analysis', value: 900 },
];

export const useHrvSession = (user: User | null, addToast: (message: string) => void) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rrIntervals, setRrIntervals] = useState<number[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  
  const milestonesReached = useRef(new Set<number>());
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const demoDataGenerator = useRef<NodeJS.Timeout | null>(null);

  const endSession = useCallback(async (finalElapsedTime: number, finalRrIntervals: number[]) => {
    setSessionActive(false);
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
    }
    
    const meanRR = finalRrIntervals.length > 0 ? finalRrIntervals.reduce((a, b) => a + b, 0) / finalRrIntervals.length : null;
    const sdnn = calculateSDNN(finalRrIntervals);
    const mode = calculateMode(finalRrIntervals);

    const summary: SessionSummary = {
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
          SESSIONS_COLLECTION_ID,
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
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
      }
    }
    return () => {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
      }
    };
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

  const resetSession = useCallback(() => {
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
    }
    setRrIntervals([]);
    setElapsedTime(0);
    setSessionSummary(null);
    milestonesReached.current.clear();
  }, []);

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
    SESSION_MILESTONES,
    MAX_SESSION_DURATION,
  };
};
