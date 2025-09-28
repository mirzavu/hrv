'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { databases, storage, AppwriteID } from '@/lib/appwrite';
import { AppwriteException, Query } from 'appwrite';
import { User, SessionSummary, SessionMilestone, RawHeartData, DATABASE_ID, USERS_COLLECTION_ID, SESSIONS_COLLECTION_ID, SESSION_SUMMARY_COLLECTION_ID } from '@/types';
import { computeSessionSummaryPayload } from '@/utils/sessionSummary';
import { buildSessionSummary } from '@/utils/buildSessionSummary';

const MAX_SESSION_DURATION = 900;
const SESSION_MILESTONES: SessionMilestone[] = [
  { label: 'Quick Check', value: 120 },
  { label: 'Standard', value: 300 },
  { label: 'Deep Insight', value: 600 },
  { label: 'Full Analysis', value: 900 },
];

const CSV_HEADERS = ['timestamp', 'heartRate', 'rrInterval', 'rawValue', 'flags', 'rawBytes', 'allRrIntervals'] as const;

type CsvHeaderKey = typeof CSV_HEADERS[number];

const formatCsvValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  let normalized: string;

  if (Array.isArray(value) || typeof value === 'object') {
    normalized = JSON.stringify(value);
  } else {
    normalized = String(value);
  }

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const buildSessionCsv = (
  finalRawData: RawHeartData[],
  metadata: { startTime: string | null; endTime: string; duration: number; dataPoints: number }
) => {
  const lines = [
    `# sessionStartTime=${metadata.startTime ?? ''}`,
    `# sessionEndTime=${metadata.endTime}`,
    `# durationSeconds=${metadata.duration}`,
    `# dataPoints=${metadata.dataPoints}`,
    CSV_HEADERS.join(',')
  ];

  for (const entry of finalRawData) {
    const record = entry as Record<CsvHeaderKey, unknown>;
    const row = CSV_HEADERS.map((header) => formatCsvValue(record[header]));
    lines.push(row.join(','));
  }

  return lines.join('\n');
};

export const useHrvSession = (user: User | null, addToast: (message: string) => void) => {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawHeartData, setRawHeartData] = useState<RawHeartData[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  
  const milestonesReached = useRef(new Set<number>());
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const demoDataGenerator = useRef<NodeJS.Timeout | null>(null);
  const sessionPausedRef = useRef(false);

  useEffect(() => {
    sessionPausedRef.current = sessionPaused;
  }, [sessionPaused]);

  const endSession = useCallback(async (finalElapsedTime: number, finalRawData: RawHeartData[]) => {
    setSessionActive(false);
    setSessionPaused(false);
    sessionPausedRef.current = false;
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
      demoDataGenerator.current = null;
    }
    
    const endTime = new Date().toISOString();
    
    // Compute session metrics
    const summaryPayload = computeSessionSummaryPayload({
      rawData: finalRawData,
      sessionStartTime,
      durationSeconds: finalElapsedTime,
      userId: user?.$id || 'guest',
      sessionId: 'temp', // Will be updated after session creation
    });
    
    // Build display summary
    const summary = buildSessionSummary(summaryPayload, finalElapsedTime, finalRawData.length, finalRawData);
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

        // Create raw data file content (CSV archived in a ZIP)
        const csvContent = buildSessionCsv(finalRawData, {
          startTime: sessionStartTime,
          endTime,
          duration: finalElapsedTime,
          dataPoints: finalRawData.length
        });

        const timestamp = Date.now();
        const archiveBytes = zipSync({ [`session-${timestamp}.csv`]: strToU8(csvContent) });

        // Upload raw data to Appwrite Storage
        const file = new File([new Uint8Array(archiveBytes)], `session-${timestamp}.zip`, {
          type: 'application/zip'
        });

        // Create a bucket ID for heart rate data (you'll need to create this bucket in Appwrite)
        const BUCKET_ID = 'heart-rate-data'; // This needs to be created in Appwrite
        
        let rawFileId = '';
        try {
          const uploadedFile = await storage.createFile(BUCKET_ID, AppwriteID.unique(), file);
          rawFileId = uploadedFile.$id;
        } catch (storageError) {
          console.error('Error uploading raw data file:', storageError);

          let toastMessage = 'Warning: Could not save raw data file. Session metadata saved.';
          const messageFromError =
            storageError instanceof AppwriteException
              ? storageError.message
              : storageError instanceof Error
                ? storageError.message
                : undefined;

          if (messageFromError && /extension not allowed/i.test(messageFromError)) {
            toastMessage = 'Warning: Storage bucket is missing .zip in its allowed extensions. Re-run setup-appwrite to update it.';
          }

          addToast(toastMessage);
        }

        // Create session record in database
        const sessionRecord = await databases.createDocument(
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

        try {
          const finalSummaryPayload = computeSessionSummaryPayload({
            rawData: finalRawData,
            sessionStartTime,
            durationSeconds: finalElapsedTime,
            userId: userDoc.$id,
            sessionId: sessionRecord.$id,
          });


          await databases.createDocument(
            DATABASE_ID,
            SESSION_SUMMARY_COLLECTION_ID,
            AppwriteID.unique(),
            {
              ...finalSummaryPayload,
              createdAt: new Date().toISOString(),
            }
          );
          
          // Update the displayed summary with the final sessionId
          const finalSummary = buildSessionSummary(finalSummaryPayload, finalElapsedTime, finalRawData.length, finalRawData);
          setSessionSummary(finalSummary);
        } catch (summaryError) {
          console.error('Error saving session summary:', summaryError);
          addToast('Warning: Session saved but summary metrics could not be stored.');
        }
        
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
    if (sessionActive && !sessionPaused) {
      sessionTimer.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
        sessionTimer.current = null;
      }
    }
    return () => {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
        sessionTimer.current = null;
      }
    };
  }, [sessionActive, sessionPaused]);

  useEffect(() => {
    if (!sessionActive || sessionPaused) return;
    const milestone = SESSION_MILESTONES.find(d => d.value === elapsedTime);
    if (milestone && !milestonesReached.current.has(elapsedTime)) {
      addToast(`${milestone.label} data collection complete!`);
      milestonesReached.current.add(elapsedTime);
    }
    if (elapsedTime >= MAX_SESSION_DURATION) {
      endSession(elapsedTime, rawHeartData);
    }
  }, [elapsedTime, sessionActive, sessionPaused, addToast, endSession, rawHeartData]);

  const resetSession = useCallback(() => {
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
      demoDataGenerator.current = null;
    }
    setRawHeartData([]);
    setElapsedTime(0);
    setSessionSummary(null);
    setSessionStartTime(null);
    setSessionPaused(false);
    sessionPausedRef.current = false;
    milestonesReached.current.clear();
  }, []);

  const startSession = useCallback(() => {
    setSessionActive(true);
    setSessionStartTime(new Date().toISOString());
    setRawHeartData([]);
    setElapsedTime(0);
    setSessionPaused(false);
    sessionPausedRef.current = false;
    milestonesReached.current.clear();
  }, []);

  const addRawHeartData = useCallback((data: RawHeartData) => {
    if (sessionPausedRef.current) {
      return;
    }
    setRawHeartData(prev => [...prev, data]);
  }, []);

  const pauseSession = useCallback(() => {
    if (!sessionActive || sessionPausedRef.current) {
      return;
    }
    sessionPausedRef.current = true;
    setSessionPaused(true);
  }, [sessionActive]);

  const resumeSession = useCallback(() => {
    if (!sessionActive || !sessionPausedRef.current) {
      return;
    }
    sessionPausedRef.current = false;
    setSessionPaused(false);
  }, [sessionActive]);

  useEffect(() => {
    if (!sessionActive) {
      setSessionPaused(false);
      sessionPausedRef.current = false;
    }
  }, [sessionActive]);

  return {
    sessionActive,
    setSessionActive,
    sessionPaused,
    pauseSession,
    resumeSession,
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
