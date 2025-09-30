'use client';

import { CalendarView } from '@/components/calendar/CalendarView';
import { useAuth } from '@/hooks/useAuth';
import { useSessions } from '@/hooks/useSessions';
import Header from '@/components/ui/Header';
import { useState } from 'react';

export default function CalendarPage() {
  const { user, loading: authLoading, handleLogout } = useAuth(() => {});
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const [darkMode, setDarkMode] = useState(false);
  
  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const { sessions, loading: sessionsLoading, error } = useSessions(user?.$id || null);


  const handleViewCalendar = () => {
    window.location.href = '/calendar';
  };

  if (authLoading || sessionsLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-center">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <p className="text-red-600 text-center">Error loading sessions: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'text-white bg-gray-900' : 'text-gray-800 bg-gray-100'}`}>
      <Header 
        user={user} 
        handleLogout={handleLogout} 
        handleViewCalendar={handleViewCalendar}
        toggleDarkMode={() => setDarkMode(!darkMode)} 
        darkMode={darkMode}
      />
      
      <div className="w-full flex items-center justify-center p-2 sm:p-4 md:p-6">
        <CalendarView sessions={sessions} />
      </div>
      
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
