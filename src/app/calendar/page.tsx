'use client';

import { CalendarView } from '@/components/calendar/CalendarView';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/ui/Header';
import LoginModal from '@/components/auth/LoginModal';
import UserOnboardingModal from '@/components/UserOnboardingModal';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function CalendarPage() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const { darkMode, toggleDarkMode } = useTheme();

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const {
    user,
    loading: authLoading,
    handleLogout,
    showLoginModal,
    showOnboardingModal,
    handleLoginSuccess,
    handleOnboardingComplete,
    handleOnboardingSkip,
    setShowLoginModal
  } = useAuth(addToast);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-center">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {showLoginModal && (
        <LoginModal
          darkMode={darkMode}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {showOnboardingModal && user && (
        <UserOnboardingModal
          darkMode={darkMode}
          user={user}
          onComplete={handleOnboardingComplete}
          onClose={handleOnboardingSkip}
        />
      )}
      <Header
        user={user}
        handleLogout={handleLogout}
        toggleDarkMode={toggleDarkMode}
        darkMode={darkMode}
        onLoginClick={() => setShowLoginModal(true)}
      />

      <main className="flex-1 p-4 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <CalendarView userId={user?.$id || null} darkMode={darkMode} />
        </div>
      </main>

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
