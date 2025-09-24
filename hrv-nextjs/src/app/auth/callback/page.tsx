'use client';

import AuthCallback from '@/components/auth/AuthCallback';
import { User } from '@/types';

export default function AuthCallbackPage() {
  const handleAuthComplete = (user: User) => {
    // Store user data temporarily and redirect to home
    // The home page AuthProvider will pick this up
    localStorage.setItem('temp_auth_user', JSON.stringify(user));
    window.location.href = '/';
  };

  return <AuthCallback onAuthComplete={handleAuthComplete} />;
}
