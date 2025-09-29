'use client';

import { useState, useMemo } from 'react';

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

interface CalendarViewProps {
  sessions: CalendarSession[];
}

export function CalendarView({ sessions = [] }: CalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Index sessions by date 'YYYY-MM-DD' for quick lookup
  const byDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {};
    sessions.forEach(s => {
      map[s.date] = map[s.date] || [];
      map[s.date].push(s);
    });
    return map;
  }, [sessions]);

  // State for the currently viewed month
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Generate the days for the current viewMonth
  const endDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const days: Array<{ dateObj: Date; key: string; sessions: CalendarSession[] }> = [];
  for (let d = 1; d <= endDay.getDate(); d++) {
    const dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    const key = dt.toISOString().slice(0, 10);
    days.push({ dateObj: dt, key, sessions: byDate[key] || [] });
  }

  // Handlers for month navigation and day selection
  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    setSelectedDay(null);
  };
  
  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    setSelectedDay(null);
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
        <div className="flex justify-end">
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

        <div className="flex flex-col xl:flex-row gap-4 xl:gap-8">
          {/* Calendar Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 w-full max-w-none sm:max-w-[520px] mx-auto xl:mx-0 xl:max-w-none">
              {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`pad-start-${i}`} />)}
              {days.map(d => (
                <button
                  key={d.key}
                  className={`aspect-square p-1 sm:p-2 text-left flex flex-col justify-start gap-1 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    selectedDay === d.key ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => selectDay(d.key)}
                  aria-label={`Day ${d.dateObj.getDate()}, ${d.sessions.length} sessions`}
                >
                  <div className={`text-xs sm:text-sm font-medium ${selectedDay === d.key ? 'text-blue-700' : 'text-gray-700'}`}>{d.dateObj.getDate()}</div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {d.sessions.slice(0, 3).map(s => {
                        const colorClass = s.rmssd >= 60 ? 'bg-green-500' : s.rmssd >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                        return <span key={s.id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${colorClass}`} />;
                    })}
                    {d.sessions.length > 3 && <span className="text-[8px] sm:text-[10px] text-gray-500 font-semibold">+{d.sessions.length - 3}</span>}
                  </div>
                </button>
              ))}
              {Array.from({ length: paddingEndCount }).map((_, i) => <div key={`pad-end-${i}`} />)}
            </div>
          </div>

          {/* Sessions View */}
          <div className="w-full xl:w-80 xl:border-l xl:border-gray-200 xl:pl-8">
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
            <div className="space-y-2 sm:space-y-3 h-64 sm:h-80 xl:h-96 overflow-y-auto">
              {selectedDay && byDate[selectedDay] && byDate[selectedDay].length > 0 ? (
                byDate[selectedDay]
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
                <div className="text-xs sm:text-sm text-gray-500 p-4 sm:p-6 text-center bg-white rounded-lg border border-dashed h-full flex items-center justify-center">Select a day to see sessions</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
