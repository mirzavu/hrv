'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { databases, storage, AppwriteID } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { User, SessionSummary, SessionMilestone, RawHeartData, DATABASE_ID, USERS_COLLECTION_ID, SESSIONS_COLLECTION_ID } from '@/types';

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
  const [rawHeartData, setRawHeartData] = useState<RawHeartData[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  
  const milestonesReached = useRef(new Set<number>());
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const demoDataGenerator = useRef<NodeJS.Timeout | null>(null);

  const endSession = useCallback(async (finalElapsedTime: number, finalRawData: RawHeartData[]) => {
    setSessionActive(false);
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
    }
    
    const endTime = new Date().toISOString();
    
    // Create summary with dummy data for now
    const summary: SessionSummary = {
      duration: { label: 'Duration', value: finalElapsedTime, unit: 's' },
      totalBeats: { label: 'Data Points', value: finalRawData.length, unit: '' },
      heartRate: { label: 'Avg Heart Rate', value: 75, unit: 'bpm' }, // dummy data
      dataPoints: { label: 'Raw Samples', value: finalRawData.length, unit: '' },
    };
    setSessionSummary(summary);

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

        // Create raw data file content
        const rawDataContent = JSON.stringify({
          sessionInfo: {
            startTime: sessionStartTime,
            endTime: endTime,
            duration: finalElapsedTime,
            dataPoints: finalRawData.length
          },
          rawData: finalRawData
        });

        // Upload raw data to Appwrite Storage
        const file = new File([rawDataContent], `session-${Date.now()}.json`, {
          type: 'application/json'
        });

        // Create a bucket ID for heart rate data (you'll need to create this bucket in Appwrite)
        const BUCKET_ID = 'heart-rate-data'; // This needs to be created in Appwrite
        
        let rawFileId = '';
        try {
          const uploadedFile = await storage.createFile(BUCKET_ID, AppwriteID.unique(), file);
          rawFileId = uploadedFile.$id;
        } catch (storageError) {
          console.error('Error uploading raw data file:', storageError);
          addToast('Warning: Could not save raw data file. Session metadata saved.');
        }

        // Create session record in database
        await databases.createDocument(
          DATABASE_ID,
          SESSIONS_COLLECTION_ID,
          AppwriteID.unique(),
          {
            userId: userDoc.$id,
            startTime: sessionStartTime,
            endTime: endTime,
            rawFileId: rawFileId
          }
        );
        
        addToast('Session saved successfully!');
      } catch (error) {
        console.error('Error saving session to Appwrite:', error);
        addToast('Error: Could not save session to database.');
      }
    } else {
      // For guest users, save to localStorage
      const guestSessionData = {
        startTime: sessionStartTime,
        endTime: endTime,
        duration: finalElapsedTime,
        dataPoints: finalRawData.length,
        rawData: finalRawData
      };
      localStorage.setItem('hrv_guest_session', JSON.stringify(guestSessionData));
      addToast('Session saved locally!');
    }
  }, [addToast, user, sessionStartTime]);

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
      addToast(`${milestone.label} data collection complete!`);
      milestonesReached.current.add(elapsedTime);
    }
    if (elapsedTime >= MAX_SESSION_DURATION) {
      endSession(elapsedTime, rawHeartData);
    }
  }, [elapsedTime, sessionActive, addToast, endSession, rawHeartData]);

  const resetSession = useCallback(() => {
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
    }
    setRawHeartData([]);
    setElapsedTime(0);
    setSessionSummary(null);
    setSessionStartTime(null);
    milestonesReached.current.clear();
  }, []);

  const startSession = useCallback(() => {
    setSessionActive(true);
    setSessionStartTime(new Date().toISOString());
    setRawHeartData([]);
    setElapsedTime(0);
    milestonesReached.current.clear();
  }, []);

  const addRawHeartData = useCallback((data: RawHeartData) => {
    setRawHeartData(prev => [...prev, data]);
  }, []);

  return {
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
    demoDataGenerator,
    milestonesReached,
    SESSION_MILESTONES,
    MAX_SESSION_DURATION,
  };
};
