'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { databases, storage, AppwriteID } from '@/lib/appwrite';
import { AppwriteException, Query } from 'appwrite';
import { User, SessionSummary, SessionMilestone, RawHeartData, DATABASE_ID, USERS_COLLECTION_ID, SESSIONS_COLLECTION_ID, SESSION_SUMMARY_COLLECTION_ID } from '@/types';
// import { computeSessionSummaryPayload } from '@/utils/sessionSummary'; // Now using server-side API
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
  const sessionStartTimestamp = useRef<number | null>(null);
  const pausedTime = useRef<number>(0);

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
    
    // For display purposes, we'll create a temporary summary
    // The real calculations will be done server-side after session is saved
    const summaryPayload = {
      session_id: 'temp',
      user_id: user?.$id || 'guest',
      rmssd_session_ms: null,
      sdnn_session_ms: null,
      pnn50_percent: null,
      session_mean_hr: null,
      amode_50: null,
      AMo50_count: null,
      rr_max_ms: null,
      rr_min_ms: null,
      mxdmn_ms: null,
      rmssd_start_ms: null,
      rmssd_end_ms: null,
      time_to_stabilize_seconds: null,
      resp_coherence_score: null,
      restoration_index: null,
      session_stress_index: null,
      mean_rr_ms: null,
      lf_power_ms2: null,
      hf_power_ms2: null,
      lfhf_ratio: null,
      total_power_ms2: null,
      sd1_ms: null,
      sd2_ms: null,
      baevsky_mo: null,
      baevsky_amo: null,
      baevsky_mxdmn_ms: null,
      baevsky_stress_index: null,
    };
    
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

        // Ensure startTime is never null - fallback to first data timestamp or current time
        const finalStartTime = sessionStartTime || 
          (finalRawData.length > 0 ? new Date(finalRawData[0].timestamp).toISOString() : new Date().toISOString());
          
        // Create raw data file content (CSV archived in a ZIP)
        const csvContent = buildSessionCsv(finalRawData, {
          startTime: finalStartTime,
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
            startTime: finalStartTime,
            endTime: endTime,
            rawFileId: rawFileId
          }
        );

        try {
          // Call server-side API for calculations
          const response = await fetch('/api/sessions/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rawData: finalRawData,
              sessionStartTime: finalStartTime,
              durationSeconds: finalElapsedTime,
              userId: userDoc.$id,
              sessionId: sessionRecord.$id,
            }),
          });

          if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
          }

          const finalSummaryPayload = await response.json();


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
      // Use timestamp-based calculation instead of setInterval
      const updateTimer = () => {
        if (sessionStartTimestamp.current && !sessionPausedRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - sessionStartTimestamp.current - pausedTime.current) / 1000);
          setElapsedTime(elapsed);
        }
      };
      
      // Update immediately
      updateTimer();
      
      // Then update every second for UI responsiveness
      sessionTimer.current = setInterval(updateTimer, 1000);
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
    sessionStartTimestamp.current = null;
    pausedTime.current = 0;
    milestonesReached.current.clear();
  }, []);

  const startSession = useCallback(() => {
    setSessionActive(true);
    const startTime = new Date().toISOString();
    setSessionStartTime(startTime);
    sessionStartTimestamp.current = Date.now();
    pausedTime.current = 0;
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
    // Record when we paused to calculate total paused time
    pausedTime.current += Date.now() - (sessionStartTimestamp.current || 0) - (elapsedTime * 1000);
  }, [sessionActive, elapsedTime]);

  const resumeSession = useCallback(() => {
    if (!sessionActive || !sessionPausedRef.current) {
      return;
    }
    sessionPausedRef.current = false;
    setSessionPaused(false);
    // Update the start timestamp to account for paused time
    sessionStartTimestamp.current = Date.now() - elapsedTime * 1000 - pausedTime.current;
  }, [sessionActive, elapsedTime]);

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
