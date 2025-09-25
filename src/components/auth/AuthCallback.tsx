'use client';

import React, { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import { User } from '@/types';

interface AuthCallbackProps {
  onAuthComplete: (user: User) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onAuthComplete }) => {
  const [status, setStatus] = useState('Finalizing authentication...');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        // Appwrite's SDK handles the token exchange from the URL automatically
        const user = await account.get();
        
        console.log("Successfully authenticated with Appwrite:", user);
        
        // Store user data temporarily to avoid re-fetching after redirect
        localStorage.setItem('temp_auth_user', JSON.stringify(user));
        
        // Pass user data to the auth handler and redirect
        onAuthComplete(user);
        
        // Use a small delay to ensure the auth state is updated before redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 100);

      } catch (err: any) {
        console.error('Auth callback error:', err);
        setStatus(`Authentication failed: ${err.message}`);
        setTimeout(() => {
          window.location.href = '/?error=' + encodeURIComponent(err.message);
        }, 3000);
      }
    };
    completeAuth();
  }, [onAuthComplete]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
