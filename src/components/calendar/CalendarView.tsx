'use client';

import { useState, useEffect, useCallback } from 'react';
import { sessionCache } from '@/lib/sessionCache';
import { SessionSummary } from '@/types';
import SessionSummaryModal from '@/components/session/SessionSummaryModal';
import WeeklyRecoveryReport from '@/components/reports/WeeklyRecoveryReport';
import MonthlyAnalysisReport from '@/components/reports/MonthlyAnalysisReport';

// SVG Icons
const ChevronLeft = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

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

interface MonthDateData {
  date: string;
  count: number;
  sessions: Array<{ id: string; rmssd: number }>;
}

interface CalendarViewProps {
  userId: string | null;
  darkMode?: boolean;
}

export function CalendarView({ userId, darkMode = false }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<Record<string, MonthDateData>>({});
  const [daySessions, setDaySessions] = useState<CalendarSession[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger
  const [selectedSessionSummary, setSelectedSessionSummary] = useState<SessionSummary | null>(null);
  const [_sessionSummaryLoading, setSessionSummaryLoading] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [usagePhase, setUsagePhase] = useState<'calibration' | 'early_baseline' | 'full_baseline' | null>(null);
  const [baselineEstablished, setBaselineEstablished] = useState<boolean>(false);

  // Fetch user's usage_phase for badge display
  useEffect(() => {
    if (!userId) return;
    const fetchUserPhase = async () => {
      try {
        const res = await fetch(`/api/user/profile?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setUsagePhase(data.profile?.usage_phase || null);
        }
      } catch (e) {
        console.error('Error fetching user phase:', e);
      }
    };
    fetchUserPhase();
  }, [userId]);

  // Check baseline status (still needed for monthly report)
  useEffect(() => {
    if (!userId) return;
    const checkBaseline = async () => {
      try {
        const res = await fetch(`/api/user/baseline?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setBaselineEstablished(data.baseline?.established === true);
        }
      } catch (e) {
        console.error('Error checking baseline:', e);
      }
    };
    checkBaseline();
  }, [userId]);

  // State for the currently viewed month
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Fetch month data when viewMonth or userId changes
  useEffect(() => {
    if (!userId) {
      setMonthData({});
      return;
    }

    const fetchMonthData = async () => {
      const year = viewMonth.getFullYear();
      const month = viewMonth.getMonth();
      // Use local date format instead of toISOString (which converts to UTC)
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const cacheKey = `calendar-month-${userId}-${year}-${month}`;

      // Check cache first
      const cached = sessionCache.get<MonthDateData[]>(cacheKey);
      if (cached) {
        const dataMap: Record<string, MonthDateData> = {};
        cached.forEach(item => {
          dataMap[item.date] = item;
        });
        setMonthData(dataMap);
        return;
      }

      setMonthLoading(true);
      try {
        const startTime = performance.now();
        const response = await fetch(`/api/sessions/calendar/month?userId=${userId}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Month API error:', errorText);
          throw new Error(`Failed to fetch month data: ${response.status}`);
        }
        const data = await response.json();
        const endTime = performance.now();
        console.log(`[CalendarView] Month data fetched in ${Math.round(endTime - startTime)}ms, ${data.dates?.length || 0} dates`);

        // Cache the data
        sessionCache.set(cacheKey, data.dates, 300); // 5 minutes

        // Convert to map
        const dataMap: Record<string, MonthDateData> = {};
        if (data.dates && Array.isArray(data.dates)) {
          data.dates.forEach((item: MonthDateData) => {
            dataMap[item.date] = item;
          });
        }
        setMonthData(dataMap);
      } catch (error) {
        console.error('Error fetching month data:', error);
        setMonthData({});
      } finally {
        setMonthLoading(false);
      }
    };

    fetchMonthData();
  }, [viewMonth, userId, refreshKey]);

  // Fetch day sessions when selectedDay changes
  useEffect(() => {
    if (!userId || !selectedDay) {
      setDaySessions([]);
      return;
    }

    const fetchDaySessions = async () => {
      const cacheKey = `calendar-day-${userId}-${selectedDay}`;

      // Check cache first
      const cached = sessionCache.get<CalendarSession[]>(cacheKey);
      if (cached) {
        setDaySessions(cached);
        return;
      }

      setDayLoading(true);
      try {
        const startTime = performance.now();
        const response = await fetch(`/api/sessions/calendar/day?userId=${userId}&date=${selectedDay}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Day API error:', errorText);
          throw new Error(`Failed to fetch day sessions: ${response.status}`);
        }
        const data = await response.json();
        const endTime = performance.now();
        console.log(`[CalendarView] Day sessions fetched in ${Math.round(endTime - startTime)}ms, ${data.sessions?.length || 0} sessions`);

        // Cache the data
        sessionCache.set(cacheKey, data.sessions, 300); // 5 minutes

        setDaySessions(data.sessions || []);
      } catch (error) {
        console.error('Error fetching day sessions:', error);
        setDaySessions([]);
      } finally {
        setDayLoading(false);
      }
    };

    fetchDaySessions();
  }, [selectedDay, userId, refreshKey]);

  // Clear cache function
  const clearCache = useCallback(() => {
    if (!userId) return;

    // Clear all calendar-related cache entries
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const cacheKeys = [
      `calendar-month-${userId}-${year}-${month}`,
      `calendar-day-${userId}-${selectedDay}`
    ].filter(Boolean);

    cacheKeys.forEach(key => sessionCache.delete(key));

    // Reset state and trigger refetch
    setMonthData({});
    if (selectedDay) {
      setDaySessions([]);
    }
    // Force refetch by incrementing refresh key
    setRefreshKey(prev => prev + 1);
  }, [userId, viewMonth, selectedDay]);

  // Generate the days for the current viewMonth
  const endDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const days: Array<{ dateObj: Date; key: string; dateData: MonthDateData | null }> = [];
  for (let d = 1; d <= endDay.getDate(); d++) {
    const dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    // Use local date format (YYYY-MM-DD) instead of toISOString which converts to UTC
    // This fixes off-by-one day issue in positive-offset timezones like IST
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    days.push({ dateObj: dt, key, dateData: monthData[key] || null });
  }

  // Handlers for month navigation and day selection
  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    setSelectedDay(null);
    setDaySessions([]);
  };

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    setSelectedDay(null);
    setDaySessions([]);
  };

  const goToday = () => {
    const todayDate = new Date();
    setViewMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    // Use local date format instead of toISOString (which converts to UTC)
    const year = todayDate.getFullYear();
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    setSelectedDay(`${year}-${month}-${day}`);
  };

  const selectDay = (key: string) => {
    setSelectedDay(key);
  };

  // Handle session click - fetch and show session summary
  const handleSessionClick = async (sessionId: string) => {
    if (!sessionId) return;

    setSessionSummaryLoading(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      const data = await response.json();
      setSelectedSessionSummary(data.summary);
    } catch (error) {
      console.error('Error fetching session summary:', error);
      alert('Failed to load session summary. Please try again.');
    } finally {
      setSessionSummaryLoading(false);
    }
  };

  const startDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const paddingEndCount = Math.max(0, 42 - (startDayOfWeek + days.length));

  useEffect(() => {
    const grid = document.getElementById('calendar-grid');
    const wrapper = document.getElementById('session-column');
    if (!grid || !wrapper) return;

    const updateHeight = () => {
      const height = grid.offsetHeight;
      document.documentElement.style.setProperty('--calendar-height', `${height}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [viewMonth, monthData]);

  return (
    <div className="w-full max-w-7xl mx-auto font-sans">
      {/* Top Bar */}
      <div className={`p-3 sm:p-4 md:p-6 rounded-2xl shadow-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex justify-between items-center">
          <button
            onClick={clearCache}
            className={`px-3 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2 ${darkMode ? 'text-gray-200 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}`}
            title="Clear cache"
          >
            <TrashIcon />
            Clear Cache
          </button>
          {/* Weekly Report Button with Calibration Badge */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowWeeklyReport(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
              Past Week Report
            </button>
            {usagePhase === 'calibration' && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white rounded-full">
                Calibration
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Container */}
      <div className={`p-3 sm:p-4 md:p-6 rounded-2xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Calendar Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button onClick={prevMonth} aria-label="Previous month" className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}>
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={goToday} className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md shadow-sm transition-colors ${darkMode ? 'text-gray-200 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'}`}>
              Today
            </button>
            <button onClick={nextMonth} aria-label="Next month" className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`}>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 xl:gap-8 xl:items-start">
          {/* Calendar and Session Columns Wrapper */}
          <div className="flex flex-col xl:flex-row gap-4 xl:gap-8 w-full">
            {/* Calendar Grid */}
            <div className="flex-1 min-w-0" id="calendar-wrapper">
              <div className={`grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 w-full mx-auto xl:mx-0" id="calendar-grid">
                {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`pad-start-${i}`} />)}
                {monthLoading ? (
                  <div className="col-span-7 flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  days.map(d => {
                    const dateData = d.dateData;
                    const sessionCount = dateData?.count || 0;
                    const sessions = dateData?.sessions || [];

                    return (
                      <button
                        key={d.key}
                        className={`aspect-square p-1 sm:p-2 text-left flex flex-col justify-start gap-1 rounded-lg border transition-colors ${selectedDay === d.key
                          ? (darkMode ? 'bg-blue-900/50 border-blue-500' : 'bg-blue-100 border-blue-400')
                          : (darkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white border-gray-200 hover:bg-gray-50')
                          }`}
                        onClick={() => selectDay(d.key)}
                      >
                        <div className={`text-xs sm:text-sm font-medium ${selectedDay === d.key ? (darkMode ? 'text-blue-300' : 'text-blue-700') : (darkMode ? 'text-gray-200' : 'text-gray-700')}`}>{d.dateObj.getDate()}</div>
                        <div className="flex flex-wrap gap-1 items-center">
                          {sessions.slice(0, 3).map(s => {
                            const colorClass = s.rmssd >= 60 ? 'bg-green-500' : s.rmssd >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                            return <span key={s.id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colorClass}`} />;
                          })}
                          {sessionCount > 3 && <span className={`text-[8px] sm:text-[10px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>+{sessionCount - 3}</span>}
                        </div>
                      </button>
                    );
                  })
                )}
                {Array.from({ length: paddingEndCount }).map((_, i) => <div key={`pad-end-${i}`} />)}
              </div>
            </div>

            {/* Sessions View */}
            <div className={`w-full xl:w-80 xl:border-l xl:pl-8 flex flex-col ${darkMode ? 'xl:border-gray-700' : 'xl:border-gray-200'}`} id="session-column">
              <h3 className={`text-base sm:text-lg font-semibold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Sessions {selectedDay ? `— ${new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
              </h3>

              <div className="w-full mb-4">
                <button
                  onClick={() => baselineEstablished && setShowMonthlyReport(true)}
                  disabled={!baselineEstablished}
                  className={`w-full px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg shadow-sm border transition-colors duration-200 flex items-center justify-center gap-2 ${baselineEstablished
                    ? (darkMode ? 'text-gray-200 bg-gray-700 border-gray-600 hover:bg-gray-600' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400')
                    : (darkMode ? 'text-gray-500 bg-gray-800 border-gray-700 cursor-not-allowed' : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed')
                    }`}
                  title={!baselineEstablished ? "Establish a baseline first" : "View Monthly Trends"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-4 sm:h-4">
                    <path d="M3 3v18h18" />
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                  </svg>
                  Month Analysis
                </button>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(var(--calendar-height) - 100px)' }}>
                {dayLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : selectedDay && daySessions.length > 0 ? (
                  <div key={selectedDay} className="animate-fade-in space-y-3">
                    {daySessions.sort((a, b) => b.time.localeCompare(a.time)).map(s => {
                      return (
                        <div
                          className={`rounded-[10px] px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${darkMode ? 'bg-gray-700 border border-gray-600 hover:bg-gray-600' : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                          key={s.id}
                          onClick={() => handleSessionClick(s.id)}
                        >
                          <div className="flex flex-col gap-1">
                            <span className={`text-base font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{s.time}</span>
                            <span className={`text-xs font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{s.durationMin} min • ID: {s.id.slice(-8)}</span>
                          </div>
                          <div className="flex items-center gap-5 text-right">
                            <div className="flex flex-col">
                              <span className={`text-2xl font-bold leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                {s.hrvScore ?? 'N/A'}<span className={`text-sm font-medium ml-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/100</span>
                              </span>
                              <span className={`text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>HRV Score</span>
                            </div>
                            <div className="flex flex-col">
                              <span className={`text-2xl font-bold leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                {s.rmssd}<span className={`text-sm font-medium ml-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>ms</span>
                              </span>
                              <span className={`text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>RMSSD</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-xs sm:text-sm p-4 text-center rounded-lg border border-dashed flex items-center justify-center h-full ${darkMode ? 'text-gray-400 bg-gray-700 border-gray-600' : 'text-gray-500 bg-white'}`}>Select a day to see sessions</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Summary Modal */}
      {selectedSessionSummary && (
        <SessionSummaryModal
          summary={selectedSessionSummary}
          darkMode={darkMode}
          onReset={() => { }}
          isGuest={userId === 'guest' || !userId}
          onGuestLogin={() => { }}
          onClose={() => setSelectedSessionSummary(null)}
          userId={userId}
        />
      )}
      {/* Weekly Recovery Report Modal */}
      <WeeklyRecoveryReport
        isOpen={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
        userId={userId}
      />
      <MonthlyAnalysisReport
        isOpen={showMonthlyReport}
        onClose={() => setShowMonthlyReport(false)}
        userId={userId}
        currentMonth={viewMonth}
      />
    </div>
  );
}
