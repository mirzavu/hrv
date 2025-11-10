'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { sessionCache } from '@/lib/sessionCache';

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
}

export function CalendarView({ userId }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<Record<string, MonthDateData>>({});
  const [daySessions, setDaySessions] = useState<CalendarSession[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger

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
      const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
      const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      
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
    const key = dt.toISOString().slice(0, 10);
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
    setSelectedDay(todayDate.toISOString().slice(0, 10));
  };
  
  const selectDay = (key: string) => {
    setSelectedDay(key);
  };
  
  const startDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const paddingEndCount = Math.max(0, 42 - (startDayOfWeek + days.length));

  return (
    <div className="w-full max-w-7xl mx-auto font-sans">
      {/* Top Bar */}
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl shadow-lg mb-4">
        <div className="flex justify-between items-center">
          <button
            onClick={clearCache}
            className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
            title="Clear cache"
          >
            <TrashIcon />
            Clear Cache
          </button>
          <button
            onClick={() => alert('Past Week Report - Last 7 days analysis')}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
            Past Week Report
          </button>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-2xl shadow-lg">
        {/* Calendar Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button onClick={prevMonth} aria-label="Previous month" className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={goToday} className="px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors">
              Today
            </button>
            <button onClick={nextMonth} aria-label="Next month" className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 xl:gap-8 xl:items-start">
          {/* Calendar Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 w-full max-w-none sm:max-w-[520px] mx-auto xl:mx-0 xl:max-w-none">
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
                      className={`aspect-square p-1 sm:p-2 text-left flex flex-col justify-start gap-1 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                        selectedDay === d.key ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => selectDay(d.key)}
                      aria-label={`Day ${d.dateObj.getDate()}, ${sessionCount} sessions`}
                    >
                      <div className={`text-xs sm:text-sm font-medium ${selectedDay === d.key ? 'text-blue-700' : 'text-gray-700'}`}>{d.dateObj.getDate()}</div>
                      <div className="flex flex-wrap gap-1 items-center">
                        {sessions.slice(0, 3).map(s => {
                            const colorClass = s.rmssd >= 60 ? 'bg-green-500' : s.rmssd >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                            return <span key={s.id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colorClass}`} />;
                        })}
                        {sessionCount > 3 && <span className="text-[8px] sm:text-[10px] text-gray-500 font-semibold">+{sessionCount - 3}</span>}
                      </div>
                    </button>
                  );
                })
              )}
              {Array.from({ length: paddingEndCount }).map((_, i) => <div key={`pad-end-${i}`} />)}
            </div>
          </div>

          {/* Sessions View */}
          <div className="w-full xl:w-80 xl:border-l xl:border-gray-200 xl:pl-8 flex flex-col">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
              Sessions {selectedDay ? `— ${new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </h3>

            {/* Month Analysis Button */}
            <button
              onClick={() => alert('Month Analysis for ' + (selectedDay || 'today'))}
              className="w-full mb-4 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-4 sm:h-4">
                <path d="M3 3v18h18"/>
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
              </svg>
              Month Analysis
            </button>
            <div className="space-y-2 sm:space-y-3 max-h-[420px] sm:max-h-[480px] overflow-y-auto">
              {dayLoading ? (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : selectedDay && daySessions.length > 0 ? (
                daySessions
                  .sort((a,b) => a.time.localeCompare(b.time))
                  .map(s => {
                    // Determine HRV status based on rmssd value
                    const getHRVStatus = (rmssd: number) => {
                      if (rmssd >= 60) return { status: 'Good', color: 'text-green-600', bgColor: 'bg-green-100' };
                      if (rmssd >= 40) return { status: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
                      return { status: 'Low', color: 'text-red-600', bgColor: 'bg-red-100' };
                    };
                    
                    const hrvStatus = getHRVStatus(s.rmssd);
                    
                    // Determine border color based on HRV status
                    const getBorderColor = (rmssd: number) => {
                      if (rmssd >= 60) return 'border-green-200';
                      if (rmssd >= 40) return 'border-yellow-200';
                      return 'border-red-200';
                    };
                    
                    return (
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${getBorderColor(s.rmssd)} bg-white hover:bg-gray-50 transition-colors`} key={s.id}>
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-gray-800 text-sm sm:text-base">{s.time}</p>
                          <p className="text-xs sm:text-sm text-gray-900"><span className="font-semibold">{s.durationMin}</span> <span className="text-xs text-gray-500 font-normal">min</span></p>
                        </div>
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm font-medium text-gray-600">HRV Score</span>
                          <span className="text-sm text-gray-900">
                            <span className="font-semibold">{s.hrvScore ?? 'N/A'}</span> 
                            <span className="text-xs text-gray-500 font-normal">/100</span>
                          </span>
                        </div>
                        
                        {/* Additional RMSSD info */}
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">RMSSD</span>
                          <span className="text-xs text-gray-500">
                            <span className="font-medium">{s.rmssd}</span> 
                            <span className="text-xs text-gray-400">ms</span>
                          </span>
                        </div>
                        
                        {/* Session ID for debugging */}
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400 font-mono">ID: {s.id}</p>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-xs sm:text-sm text-gray-500 p-4 sm:p-6 text-center bg-white rounded-lg border border-dashed flex items-center justify-center">Select a day to see sessions</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
