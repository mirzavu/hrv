import React, { useEffect, useState } from 'react';
import { account } from '../appwrite';

const AuthCallback = ({ onAuthComplete }) => {
  const [status, setStatus] = useState('Finalizing authentication...');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        // Appwrite's SDK handles the token exchange from the URL automatically
        const user = await account.get();
        
        console.log("Successfully authenticated with Appwrite:", user);
        onAuthComplete(user);
        window.location.href = '/'; // Redirect to home

      } catch (err) {
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