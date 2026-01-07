'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionCache } from '@/lib/sessionCache';
import { User, SessionSummary, SessionMilestone, RawHeartData, UserBaseline, PhaseData } from '@/types';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';

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

export const useHrvSession = (user: User | null, addToast: (message: string) => void) => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rawHeartData, setRawHeartData] = useState<RawHeartData[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);

  const [sessionBaseline, setSessionBaseline] = useState<UserBaseline | null>(null);
  const [sessionPhase, setSessionPhase] = useState<PhaseData | null>(null);
  const [sessionInterpretation, setSessionInterpretation] = useState<InterpretationResult | null>(null);

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
    setSessionBaseline(null);
    setSessionPhase(null);
    setSessionInterpretation(null);
    setSessionStatus('idle');
    sessionStartTimestamp.current = null;
    pausedTime.current = 0;
    milestonesReached.current.clear();
    isDemoSession.current = false;
  }, []);

  const endSession = useCallback(async (finalElapsedTime: number, finalRawData: RawHeartData[], rrQualityData?: unknown) => {
    console.log('🔴 [DEBUG] endSession called:', {
      status: sessionStatusRef.current,
      dataLength: finalRawData.length,
      hasRRQuality: !!rrQualityData,
    });

    if (sessionStatusRef.current === 'completed') return;

    sessionStatusRef.current = 'completed';
    setSessionStatus('completed');
    if (demoDataGenerator.current) {
      clearInterval(demoDataGenerator.current);
      demoDataGenerator.current = null;
    }

    const userId = user?.$id || 'guest';
    const isGuest = userId === 'guest';

    // Fallback start time if not set
    const finalStartTime = sessionStartTime ||
      (finalRawData.length > 0 ? new Date(finalRawData[0].timestamp).toISOString() : new Date().toISOString());

    // For Guest Users: Save to LocalStorage (as backup/history)
    if (isGuest) {
      const guestSessionData = {
        startTime: finalStartTime,
        endTime: new Date().toISOString(),
        duration: finalElapsedTime,
        dataPoints: finalRawData.length,
        rawData: finalRawData
      };
      localStorage.setItem('hrv_guest_session', JSON.stringify(guestSessionData));
      addToast('Session saved locally!');
    }

    // Call API (Process & Analyze)
    try {
      console.log('🚀 [DEBUG] Calling analysis API for user:', userId);
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
          rrQualityData: rrQualityData,
          // No sessionId passed - Server will create it
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const finalSummaryPayload = await response.json();
      console.log('🔍 [API_RESPONSE_DEBUG] API Response Payload:', finalSummaryPayload);

      // Get the real ID created by the server
      const finalSessionId = finalSummaryPayload.session_id || `guest-${Date.now()}`;

      // Build Summary for UI
      const finalSummary = buildSessionSummary(
        finalSummaryPayload,
        finalElapsedTime,
        finalRawData.length,
        finalRawData,
        finalSessionId
      );

      setSessionSummary(finalSummary);

      if (finalSummaryPayload.baseline) {
        setSessionBaseline(finalSummaryPayload.baseline);
      }
      if (finalSummaryPayload.phase) {
        setSessionPhase(finalSummaryPayload.phase);
      }
      if (finalSummaryPayload.interpretation) {
        setSessionInterpretation(finalSummaryPayload.interpretation);
      }

      // Clear calendar cache so new session appears immediately
      if (!isGuest) {
        sessionCache.clearByPrefix('calendar-');
        addToast('Session saved successfully!');
      }

    } catch (analysisError) {
      console.error('Error in session analysis:', analysisError);
      addToast('Warning: Session analysis failed. Please try again.');
    }
  }, [addToast, user, sessionStartTime]);

  useEffect(() => {
    if ((sessionStatus === 'running' || sessionStatus === 'connecting') && sessionStartTimestamp.current) {
      const updateTimer = () => {
        if (sessionStartTimestamp.current && sessionStatusRef.current !== 'paused') {
          const now = Date.now();
          const elapsed = Math.floor((now - sessionStartTimestamp.current - pausedTime.current) / 1000);
          const finalElapsed = isDemoSession.current ? elapsed * 20 : elapsed;
          setElapsedTime(finalElapsed);
        }
      };
      updateTimer();
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
      endSession(elapsedTime, rawHeartData, null);
    }
  }, [elapsedTime, sessionStatus, addToast, rawHeartData, endSession]);


  const startRealSession = useCallback(() => {
    if (sessionStatus !== 'idle') return false;
    isDemoSession.current = false;
    setSessionStatus('connecting');
    return true;
  }, [sessionStatus]);

  const startDemoSession = useCallback(() => {
    if (sessionStatusRef.current !== 'idle') {
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
    isDemoSession.current = true;
    sessionStatusRef.current = 'connecting';
    setSessionStatus('connecting');
    return true;
  }, [sessionStatus]);

  const startSession = useCallback(() => {
    setSessionStatus('running');
  }, []);

  const addRawHeartData = useCallback((data: RawHeartData | RawHeartData[]) => {
    if (sessionStatusRef.current === 'paused' || sessionStatusRef.current === 'idle') return;

    if (sessionStatusRef.current === 'connecting' && !sessionStartTimestamp.current) {
      const startTime = new Date().toISOString();
      setSessionStartTime(startTime);
      sessionStartTimestamp.current = Date.now();
      pausedTime.current = 0;
      setElapsedTime(0);
      milestonesReached.current.clear();
      setSessionStatus('running');
    }

    if (Array.isArray(data)) {
      setRawHeartData(prev => [...prev, ...data]);
    } else {
      setRawHeartData(prev => [...prev, data]);
    }
  }, []);

  const pauseSession = useCallback(() => {
    if (sessionStatus !== 'running') return;
    setSessionStatus('paused');
    const actualElapsedTime = isDemoSession.current ? elapsedTime / 20 : elapsedTime;
    pausedTime.current += Date.now() - (sessionStartTimestamp.current || 0) - (actualElapsedTime * 1000);
  }, [sessionStatus, elapsedTime]);

  const resumeSession = useCallback(() => {
    if (sessionStatus !== 'paused') return;
    setSessionStatus('running');
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
    sessionBaseline,
    sessionPhase,
    sessionInterpretation,
    endSession,
    resetSession,
    demoDataGenerator,
    milestonesReached,
    SESSION_MILESTONES,
    MAX_SESSION_DURATION,
    MIN_SESSION_DURATION,
  };
};
