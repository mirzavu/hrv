'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { pb } from '@/lib/pocketbase';
import { User, SessionSummary, SessionMilestone, RawHeartData } from '@/types';
// import { computeSessionSummaryPayload } from '@/utils/sessionSummary'; // Now using server-side API
import { buildSessionSummary } from '@/utils/buildSessionSummary';

type SessionStatus = 'idle' | 'connecting' | 'running' | 'paused' | 'completed' | 'error';

const MAX_SESSION_DURATION = 300;
const MIN_SESSION_DURATION = 120; // 2 minutes - minimum required
const SESSION_MILESTONES: SessionMilestone[] = [
  { label: '1 Minute', value: 60 },
  { label: '2 Minutes', value: 120 },
  { label: '3 Minutes', value: 180 },
  { label: '4 Minutes', value: 240 },
  { label: '5 Minutes', value: 300 },
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
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawHeartData, setRawHeartData] = useState<RawHeartData[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);
  
  // Derived state
  const sessionActive = sessionStatus === 'running' || sessionStatus === 'paused' || sessionStatus === 'connecting';
  const sessionPaused = sessionStatus === 'paused';
  const isConnecting = sessionStatus === 'connecting';
  
  const milestonesReached = useRef(new Set<number>());
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const demoDataGenerator = useRef<NodeJS.Timeout | null>(null);
  const sessionStatusRef = useRef<SessionStatus>('idle');
  const sessionStartTimestamp = useRef<number | null>(null);
  const pausedTime = useRef<number>(0);
  const isDemoSession = useRef(false);

  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  const resetSession = useCallback(() => {
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
      demoDataGenerator.current = null;
    }
    setRawHeartData([]);
    setElapsedTime(0);
    setSessionSummary(null);
    setSessionStartTime(null);
    setSessionStatus('idle');
    sessionStartTimestamp.current = null;
    pausedTime.current = 0;
    milestonesReached.current.clear();
    isDemoSession.current = false;
  }, []);

  const endSession = useCallback(async (finalElapsedTime: number, finalRawData: RawHeartData[], rrQualityData?: any) => {
    console.log('🔴 [DEBUG] endSession called:', {
      status: sessionStatusRef.current,
      dataLength: finalRawData.length,
      hasRRQuality: !!rrQualityData,
      timestamp: new Date().toISOString()
    });
    
    // Prevent duplicate calls - MUST check and set synchronously before any async operations
    if (sessionStatusRef.current === 'completed') {
      console.log('🛑 [DEBUG] Already completed, returning early');
      return;
    }
    
    // IMMEDIATELY set status to prevent race conditions
    sessionStatusRef.current = 'completed';
    setSessionStatus('completed');
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
        // For PocketBase, user.$id IS the users collection record id
        const userId = user.$id;

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

        // Create raw data file for direct attachment to session
        const file = new File([new Uint8Array(archiveBytes)], `session-${timestamp}.zip`, {
          type: 'application/zip'
        });

        // Create session record with direct file attachment
        console.log('💾 [DEBUG] Creating sessions record:', {
          userId,
          startTime: finalStartTime,
          endTime,
          timestamp: new Date().toISOString()
        });
        const sessionRecord = await pb.collection('sessions').create({
          userId: userId,
          startTime: finalStartTime,
          endTime: endTime,
          rawFile: file
        });
        console.log('✅ [DEBUG] sessions record created:', sessionRecord.id);

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
              userId: userId,
              sessionId: sessionRecord.id,
            }),
          });

          if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
          }

          const finalSummaryPayload = await response.json();

          console.log('🔍 [API_RESPONSE_DEBUG] API Response Payload:', finalSummaryPayload);
          console.log('🔍 [API_RESPONSE_DEBUG] rmssd_cv_percent from API:', finalSummaryPayload.rmssd_cv_percent);

          console.log('💾 [DEBUG] Creating session_summary record:', {
            sessionId: finalSummaryPayload.session_id,
            userId: finalSummaryPayload.user_id,
            hasRRQuality: !!rrQualityData,
            timestamp: new Date().toISOString()
          });
          await pb.collection('session_summary').create({
            ...finalSummaryPayload,
            rr_quality_data: rrQualityData,
            createdAt: new Date().toISOString(),
          });
          console.log('✅ [DEBUG] session_summary record created');
          
          // Update the displayed summary with the final sessionId
          const finalSummary = buildSessionSummary(finalSummaryPayload, finalElapsedTime, finalRawData.length, finalRawData);
          console.log('🔍 [FINAL_SUMMARY_DEBUG] Final Summary Object:', finalSummary);
          console.log('🔍 [FINAL_SUMMARY_DEBUG] HRV Stability in final summary:', finalSummary.hrvStability);
          setSessionSummary(finalSummary);
        } catch (summaryError) {
          console.error('Error saving session summary:', summaryError);
          addToast('Warning: Session saved but summary metrics could not be stored.');
        }
        
        addToast('Session saved successfully!');
      } catch (error) {
        console.error('Error saving session to database:', error);
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
    
    // Don't reset session here - let the user view the summary modal
    // Reset will happen when user clicks "Start New Session" in the modal
  }, [addToast, user, sessionStartTime]);

  useEffect(() => {
    if ((sessionStatus === 'running' || sessionStatus === 'connecting') && sessionStartTimestamp.current) {
      // Use timestamp-based calculation instead of setInterval
      const updateTimer = () => {
        if (sessionStartTimestamp.current && sessionStatusRef.current !== 'paused') {
          const now = Date.now();
          const elapsed = Math.floor((now - sessionStartTimestamp.current - pausedTime.current) / 1000);
          // Apply 20x speed multiplier for demo sessions
          const finalElapsed = isDemoSession.current ? elapsed * 20 : elapsed;
          setElapsedTime(finalElapsed);
        }
      };
      
      // Update immediately
      updateTimer();
      
      // Then update every second for UI responsiveness (or faster for demo)
      const updateInterval = isDemoSession.current ? 100 : 1000;
      sessionTimer.current = setInterval(updateTimer, updateInterval);
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
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const milestone = SESSION_MILESTONES.find(d => d.value === elapsedTime);
    if (milestone && !milestonesReached.current.has(elapsedTime)) {
      addToast(`${milestone.label} data collection complete!`);
      milestonesReached.current.add(elapsedTime);
    }
    if (elapsedTime >= MAX_SESSION_DURATION) {
      endSession(elapsedTime, rawHeartData, null); // RR quality not available in auto-end
    }
  }, [elapsedTime, sessionStatus, addToast, rawHeartData, endSession]);

  
  const startRealSession = useCallback(() => {
    if (sessionStatus !== 'idle') return false; // Prevent duplicate starts
    isDemoSession.current = false;
    setSessionStatus('connecting');
    // Don't start timer yet - will start when first data received
    return true;
  }, [sessionStatus]);
  
  const startDemoSession = useCallback(() => {
    // If session is not idle, reset it first (synchronously using refs)
    if (sessionStatusRef.current !== 'idle') {
      // Reset synchronously
      if (demoDataGenerator.current) {
        clearInterval(demoDataGenerator.current);
        demoDataGenerator.current = null;
      }
      setRawHeartData([]);
      setElapsedTime(0);
      setSessionSummary(null);
      setSessionStartTime(null);
      setSessionStatus('idle');
      sessionStatusRef.current = 'idle';
      sessionStartTimestamp.current = null;
      pausedTime.current = 0;
      milestonesReached.current.clear();
      isDemoSession.current = false;
    }
    
    // Now start the demo session
    isDemoSession.current = true;
    sessionStatusRef.current = 'connecting';
    setSessionStatus('connecting'); // Demo also starts as connecting, timer starts on first data
    return true;
  }, [sessionStatus]);
  
  // Legacy compatibility - now just starts running status
  const startSession = useCallback(() => {
    setSessionStatus('running');
  }, []);

  const addRawHeartData = useCallback((data: RawHeartData | RawHeartData[]) => {
    const addTime = new Date().toISOString().split('T')[1]; // Just time part
    
    if (sessionStatusRef.current === 'paused' || sessionStatusRef.current === 'idle') {
      return;
    }
    
    // If this is the first data and we're connecting, start the timer and switch to running
    if (sessionStatusRef.current === 'connecting' && !sessionStartTimestamp.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`💚 [${addTime}] First data received, starting timer`);
      }
      const startTime = new Date().toISOString();
      setSessionStartTime(startTime);
      sessionStartTimestamp.current = Date.now();
      pausedTime.current = 0;
      setElapsedTime(0);
      milestonesReached.current.clear();
      setSessionStatus('running');
    }
    
    // Support both single data point and array of data points
    if (Array.isArray(data)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [${addTime}] SESSION: Adding batch of ${data.length} beats`);
      }
      setRawHeartData(prev => [...prev, ...data]);
    } else {
      if (process.env.NODE_ENV === 'development') {
      }
      setRawHeartData(prev => [...prev, data]);
    }
  }, []);

  const pauseSession = useCallback(() => {
    if (sessionStatus !== 'running') {
      return;
    }
    setSessionStatus('paused');
    // Record when we paused to calculate total paused time
    // For demo sessions, elapsedTime is 20x, so we need to divide by 20
    const actualElapsedTime = isDemoSession.current ? elapsedTime / 20 : elapsedTime;
    pausedTime.current += Date.now() - (sessionStartTimestamp.current || 0) - (actualElapsedTime * 1000);
  }, [sessionStatus, elapsedTime]);

  const resumeSession = useCallback(() => {
    if (sessionStatus !== 'paused') {
      return;
    }
    setSessionStatus('running');
    // Update the start timestamp to account for paused time
    // For demo sessions, elapsedTime is 20x, so we need to divide by 20
    const actualElapsedTime = isDemoSession.current ? elapsedTime / 20 : elapsedTime;
    sessionStartTimestamp.current = Date.now() - actualElapsedTime * 1000 - pausedTime.current;
  }, [sessionStatus, elapsedTime]);

  return {
    sessionActive,
    sessionPaused,
    sessionStatus,
    isConnecting,
    pauseSession,
    resumeSession,
    startSession,
    startRealSession,
    startDemoSession,
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
    MIN_SESSION_DURATION,
  };
};
