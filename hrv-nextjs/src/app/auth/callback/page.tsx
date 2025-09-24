'use client';

import AuthCallback from '@/components/auth/AuthCallback';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const { handleLoginSuccess } = useAuthContext();

  return <AuthCallback onAuthComplete={handleLoginSuccess} />;
}
