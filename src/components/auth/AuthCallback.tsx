'use client';

import React, { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { User } from '@/types';

interface AuthCallbackProps {
  onAuthComplete: (user: User) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onAuthComplete }) => {
  const [status, setStatus] = useState('Finalizing authentication...');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const verifier = localStorage.getItem('pb_oauth2_verifier');
        const savedState = localStorage.getItem('pb_oauth2_state');
        const redirectUrl = localStorage.getItem('pb_redirect_url') || `${window.location.origin}/auth/callback`;

        if (!code || !state || !verifier || state !== savedState) {
          throw new Error('Invalid OAuth callback parameters');
        }

        // Complete OAuth2 authentication with PocketBase
        const authData = await pb.collection('users').authWithOAuth2Code(
          'google',
          code,
          verifier,
          redirectUrl
        );

        console.log("Successfully authenticated with PocketBase:", authData.record);
        
        // Map PocketBase user to expected User format
        const user: User = {
          $id: authData.record.id,
          name: authData.record.name || '',
          email: authData.record.email || '',
        };
        
        // Store user data temporarily to avoid re-fetching after redirect
        localStorage.setItem('temp_auth_user', JSON.stringify(user));
        
        // Clean up OAuth storage
        localStorage.removeItem('pb_oauth2_state');
        localStorage.removeItem('pb_oauth2_verifier');
        localStorage.removeItem('pb_redirect_url');
        
        // Pass user data to the auth handler and redirect
        onAuthComplete(user);
        
        // Use a small delay to ensure the auth state is updated before redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 100);

      } catch (err: unknown) {
        console.error('Auth callback error:', err);
        setStatus(`Authentication failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        
        // Clean up OAuth storage on error
        localStorage.removeItem('pb_oauth2_state');
        localStorage.removeItem('pb_oauth2_verifier');
        localStorage.removeItem('pb_redirect_url');
        
        setTimeout(() => {
          window.location.href = '/?error=' + encodeURIComponent(err instanceof Error ? err.message : "Unknown error");
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
