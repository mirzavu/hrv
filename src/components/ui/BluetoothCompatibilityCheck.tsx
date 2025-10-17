'use client';

import React, { useState, useEffect } from 'react';

interface BluetoothCompatibilityCheckProps {
  darkMode: boolean;
}

const BluetoothCompatibilityCheck: React.FC<BluetoothCompatibilityCheckProps> = ({ darkMode }) => {
  const [isWebBluetoothSupported, setIsWebBluetoothSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Only check on client side after hydration
    const supported = typeof navigator !== 'undefined' && 
                     'bluetooth' in navigator && 
                     window.isSecureContext;
    setIsWebBluetoothSupported(supported);
  }, []);

  // Don't render anything until we know the client state
  if (isWebBluetoothSupported === null) {
    return null;
  }

  if (isWebBluetoothSupported) {
    return null; // Don't show anything if Web Bluetooth is supported
  }

  return (
    <div className={`p-4 rounded-lg mb-6 border-2 ${darkMode ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-start gap-3">
        <div className="text-red-500 text-xl">⚠️</div>
        <div className="flex-1">
          <h3 className={`font-semibold mb-2 ${darkMode ? 'text-red-200' : 'text-red-800'}`}>
            Web Bluetooth Not Available
          </h3>
          <div className={`text-sm space-y-2 ${darkMode ? 'text-red-300' : 'text-red-700'}`}>
            <p>Your current setup doesn't support Web Bluetooth API. To use your Polar H10:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Use Chrome, Edge, or Opera browser</li>
              <li>Ensure you're on HTTPS or localhost</li>
              <li>Check if your device supports Bluetooth Low Energy</li>
              <li>Try enabling Web Bluetooth in Chrome flags: <code className="bg-gray-200 px-1 rounded">chrome://flags/#enable-experimental-web-platform-features</code></li>
            </ul>
            <p className="mt-2 font-medium">You can still use the Demo mode to test the app functionality.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BluetoothCompatibilityCheck;
