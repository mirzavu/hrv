'use client';

import React, { useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { User } from '@/types';

interface LoginModalProps {
  darkMode: boolean;
  onClose: () => void;
  onLoginSuccess: (user?: User) => void;
}

// Helper function to detect and save user's timezone
const updateUserTimezone = async (userId: string) => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[LoginModal] Detected timezone:', timezone);

    await fetch('/api/user/timezone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, timezone }),
    });

    console.log('[LoginModal] Timezone saved successfully');
  } catch (error) {
    console.error('[LoginModal] Failed to save timezone:', error);
    // Non-critical error, don't block login
  }
};

const LoginModal: React.FC<LoginModalProps> = ({ darkMode, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Use PocketBase's built-in OAuth2 flow
      const redirectUrl = `${window.location.origin}/auth/callback`;

      console.log('Initiating OAuth with redirect URL:', redirectUrl);

      // PocketBase will handle the OAuth flow and redirect back to our callback
      const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });

      // If we get here, auth was successful
      const user = {
        $id: authData.record.id,
        name: authData.record.name || '',
        email: authData.record.email || '',
      };

      console.log('OAuth successful:', user);

      // Detect and save user's timezone
      await updateUserTimezone(authData.record.id);

      setLoading(false);
      onLoginSuccess(user);
      onClose();

    } catch (err: unknown) {
      console.error('[FRONTEND ERROR] Google login initiation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to start Google login');
      setLoading(false);
    }
  };

  const handleSkipLogin = () => {
    // Guest access logic will be managed by useAuth hook now
    onLoginSuccess({ $id: 'guest', name: 'Guest User', email: 'guest@example.com' });
    onClose();
  };

  const handleDevLogin = async () => {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'development') {
      setError('This feature is only available in development mode');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // For development, perform a real login with known dev credentials
      // This ensures we have a valid auth token for database operations
      const email = 'mirza.ekm@gmail.com';
      const password = 'changeme123'; // Matches PB_ADMIN_PASSWORD in .env.local

      console.log(`[Dev Login] Authenticating as ${email}...`);
      const authData = await pb.collection('users').authWithPassword(email, password);

      console.log('Development login successful (real):', authData.record);

      // Detect and save user's timezone
      await updateUserTimezone(authData.record.id);

      setLoading(false);

      const user = {
        $id: authData.record.id,
        name: authData.record.name || authData.record.email || 'Dev User',
        email: authData.record.email,
      };

      onLoginSuccess(user);
      onClose();

    } catch (err: unknown) {
      console.error('[FRONTEND ERROR] Development login failed:', err);
      // Fallback to mock if real login fails (e.g. if user doesn't exist yet)
      setError('Dev login failed - ensure user exists in PocketBase');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-8 rounded-xl shadow-2xl w-full max-w-md mx-4`}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Welcome to HRV Monitor</h2>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Sign in to save your HRV sessions and track your progress
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Development-only one-click login */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={handleDevLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V12C2 16.5 4.23 20.68 7.62 23.15L12 21L16.38 23.15C19.77 20.68 22 16.5 22 12V7L12 2Z" fill="currentColor" />
              </svg>
              {loading ? 'Logging in...' : 'Dev Login (mirza.ekm@gmail.com)'}
            </button>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className={`relative ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>or</span>
            </div>
          </div>

          <button
            onClick={handleSkipLogin}
            className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 transition-all transform hover:scale-105`}
          >
            Continue as Guest
          </button>
        </div>

        <p className={`text-xs text-center mt-6 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
