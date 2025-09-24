'use client';

import Toast from '@/components/ui/Toast';
import LoginModal from '@/components/auth/LoginModal';
import HrvApp from '@/components/HrvApp';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

function HomeContent() {
  const { user, showLoginModal, loading, setShowLoginModal, handleLoginSuccess } = useAuthContext();
  const { addToast } = useToast();
  const [darkMode] = [false]; // We'll add dark mode toggle later

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show login modal if user is not authenticated
  if (showLoginModal) {
    return (
      <div className="min-h-screen bg-gray-100">
        <LoginModal 
          darkMode={darkMode} 
          onClose={() => setShowLoginModal(false)} 
          onLoginSuccess={handleLoginSuccess} 
        />
      </div>
    );
  }

  // Show the full HRV app once authenticated
  return <HrvApp addToast={addToast} />;
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
