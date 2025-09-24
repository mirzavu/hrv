'use client';

import MetricCard from '@/components/ui/MetricCard';
import Toast from '@/components/ui/Toast';
import LoginModal from '@/components/auth/LoginModal';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

function HomeContent() {
  const { user, showLoginModal, loading, setShowLoginModal, handleLoginSuccess } = useAuthContext();
  const [darkMode] = [false]; // We'll add dark mode toggle later

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-300 text-gray-800 bg-gray-100">
      {showLoginModal && (
        <LoginModal 
          darkMode={darkMode} 
          onClose={() => setShowLoginModal(false)} 
          onLoginSuccess={handleLoginSuccess} 
        />
      )}
      
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            HRV Analysis App
          </h1>
          <p className="text-lg text-gray-600">
            Next.js 15 Migration - Phase 3 in Progress
          </p>
          {user && (
            <p className="text-sm text-green-600 mt-2">
              Welcome back, {user.name || 'User'}! 👋
            </p>
          )}
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Migration Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Dependencies"
                value={100}
                unit="%"
                darkMode={false}
              />
              <MetricCard
                title="Components"
                value={50}
                unit="%"
                darkMode={false}
              />
              <MetricCard
                title="Authentication"
                value={75}
                unit="%"
                darkMode={false}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Next Steps</h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                Appwrite SDK installed and configured
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                Basic components migrated (Toast, MetricCard)
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                HRV calculation utilities converted to TypeScript
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✅</span>
                Authentication system migrated
              </li>
              <li className="flex items-center">
                <span className="text-yellow-500 mr-2">🔄</span>
                Testing authentication flow
              </li>
              <li className="flex items-center">
                <span className="text-gray-400 mr-2">⏳</span>
                Migrating HRV session management
              </li>
              <li className="flex items-center">
                <span className="text-gray-400 mr-2">⏳</span>
                Migrating Bluetooth functionality
              </li>
            </ul>
          </div>

          {user && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Authentication Test Successful! 🎉</h3>
              <p className="text-green-700">
                You are successfully logged in as: <strong>{user.name}</strong>
              </p>
              <p className="text-sm text-green-600 mt-1">
                User ID: {user.$id}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <AuthProvider addToast={addToast}>
      {toasts.map(toast => (
        <Toast key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />
      ))}
      <HomeContent />
    </AuthProvider>
  );
}
