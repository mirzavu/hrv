import React, { useEffect, useState } from 'react';

const AuthCallback = ({ onAuthComplete }) => {
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Verify state
        const storedState = sessionStorage.getItem('oauth_state');
        if (state !== storedState) {
          throw new Error('Invalid state parameter');
        }

        const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

        setStatus('Exchanging code for tokens...');

        // Exchange code for tokens via our backend
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, codeVerifier }),
        });

        if (!response.ok) {
          throw new Error(`Authentication failed: ${response.status}`);
        }

        const authData = await response.json();
        console.log('[OAUTH_DEBUG] ✅ Authentication successful:', authData);

        // Clean up
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_code_verifier');


        // Notify parent component
        onAuthComplete(authData.user, authData.token);

        // Redirect to main app
        window.location.href = '/';

      } catch (err) {
        console.error('[OAUTH_DEBUG] ❌ Auth callback error:', err);
        setStatus(`Authentication failed: ${err.message}`);

        // Redirect back to main app after error
        setTimeout(() => {
          window.location.href = '/?auth_error=' + encodeURIComponent(err.message);
        }, 3000);
      }
    };

    handleAuthCallback();
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