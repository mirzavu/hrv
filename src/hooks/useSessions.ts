'use client';

import { useState, useEffect, useCallback } from 'react';
import { sessionCache } from '@/lib/sessionCache';

// Types
interface CalendarSession {
  id: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  rmssd: number;
  durationMin: number;
  hrvScore?: number; // HRV Score (0-100)
  notes?: string;
}

interface CalendarSessionsResponse {
  sessions: CalendarSession[];
  total: number;
  cached?: boolean;
}

export function useSessions(userId: string | null) {
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (forceRefresh: boolean = false) => {
    if (!userId) {
      setSessions([]);
      return;
    }

    const cacheKey = `sessions-${userId}`;
    
    // Check cache first unless force refresh
    if (!forceRefresh) {
      const cachedData = sessionCache.get<CalendarSession[]>(cacheKey);
      if (cachedData) {
        console.log(`Using cached sessions (${cachedData.length} sessions)`);
        setSessions(cachedData);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Use the optimized calendar endpoint
      const startTime = performance.now();
      const response = await fetch(`/api/sessions/calendar?userId=${userId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar sessions API error:', errorText);
        throw new Error(`Failed to fetch calendar sessions: ${response.status}`);
      }

      const data: CalendarSessionsResponse = await response.json();
      const endTime = performance.now();
      
      console.log(`Fetched ${data.sessions.length} sessions in ${Math.round(endTime - startTime)}ms`);
      
      // Cache the data for 5 minutes
      sessionCache.set(cacheKey, data.sessions, 300);
      
      setSessions(data.sessions);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { 
    sessions, 
    loading, 
    error,
    refetch: () => fetchSessions(true) // Force refresh method
  };
}
