'use client';

import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

interface BluetoothCompatibilityCheckProps {
  darkMode: boolean;
  showMessage: boolean;
}

const BluetoothCompatibilityCheck: React.FC<BluetoothCompatibilityCheckProps> = ({ darkMode, showMessage }) => {
  const [isWebBluetoothSupported, setIsWebBluetoothSupported] = useState<boolean | null>(null);
  const [browserInfo, setBrowserInfo] = useState<{ name: string; isChrome: boolean; isFirefox: boolean } | null>(null);

  useEffect(() => {
    // Only check on client side after hydration
    const supported = typeof navigator !== 'undefined' && 
                     'bluetooth' in navigator && 
                     window.isSecureContext;
    setIsWebBluetoothSupported(supported);

    // Detect browser
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);
    const isOpera = /OPR/.test(userAgent);
    
    let browserName = 'Unknown';
    if (isChrome) browserName = 'Chrome';
    else if (isFirefox) browserName = 'Firefox';
    else if (isEdge) browserName = 'Edge';
    else if (isOpera) browserName = 'Opera';

    setBrowserInfo({
      name: browserName,
      isChrome: isChrome || isEdge,
      isFirefox: isFirefox
    });
  }, []);

  // Don't render anything until we know the client state
  if (isWebBluetoothSupported === null || browserInfo === null) {
    return null;
  }

  // Only show message if showMessage is true and Web Bluetooth is not supported
  if (!showMessage || isWebBluetoothSupported) {
    return null;
  }

  // Show small warning message at the top
  return (
    <div className={`rounded-lg mb-4 border-l-4 border-teal-500 shadow-sm p-4 transition-colors duration-300 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 p-1">
          <Info className="w-5 h-5 text-teal-500" />
        </div>
        <div className={`text-sm font-medium ${darkMode ? 'text-teal-300' : 'text-teal-800'}`}>
          {browserInfo.isFirefox ? (
            <>
              <strong>Bluetooth is not supported in Firefox.</strong> Use Chrome or Edge browser for Bluetooth functionality.
            </>
          ) : browserInfo.isChrome ? (
            <>
              <strong>Web Bluetooth may be disabled in your browser.</strong> Copy paste <strong><code className={`px-1 rounded text-xs ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>chrome://flags/#enable-web-bluetooth</code></strong> in a new tab and change Web Bluetooth setting to Enabled and relaunch your browser to start using the app.
            </>
          ) : (
            <>
              <strong>Web Bluetooth not available.</strong> Use Chrome, Edge, or Opera browser for Bluetooth functionality.
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BluetoothCompatibilityCheck;
