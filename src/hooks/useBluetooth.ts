'use client';

import { Dispatch, MutableRefObject, SetStateAction, useCallback, useState, useRef, useEffect } from 'react';
import { RawHeartData } from '@/types';

const POLAR_HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const POLAR_HR_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const RR_INTERVAL_MIN_MS = 200;
const RR_INTERVAL_MAX_MS = 2800;

interface SessionData {
  elapsedTime: number;
  rawHeartData: RawHeartData[];
  sessionActive: boolean;
  sessionPaused: boolean;
  sessionStatus: string;
}

export const useBluetooth = (
  setSessionActive: (active: boolean) => void,
  addRawHeartData: (data: RawHeartData | RawHeartData[]) => void,
  setHr: Dispatch<SetStateAction<number | null>>,
  endSession: (elapsedTime: number, rawHeartData: RawHeartData[], rrQualityData?: any) => void,
  addToast: (message: string) => void,
  latestSessionData: MutableRefObject<SessionData> // Accept the ref as an argument
) => {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click "Start Session" to begin.');
  
  // Use refs to avoid recreating the callback when these functions change
  const addRawHeartDataRef = useRef(addRawHeartData);
  const setHrRef = useRef(setHr);
  
  // DEBUG: Counter to verify Bluetooth notifications are arriving
  const notificationCounterRef = useRef(0);
  
  // RR Quality tracking
  const rrQualityRef = useRef({
    totalNotifications: 0,
    withRR: 0,
    withoutRR: 0,
    poorQualityWarningShown: false
  });
  
  useEffect(() => {
    addRawHeartDataRef.current = addRawHeartData;
    setHrRef.current = setHr;
  }, [addRawHeartData, setHr]);

  const handleHRNotification = useCallback((event: Event) => {
    // IMMEDIATELY increment counter - this proves Bluetooth is working
    notificationCounterRef.current++;
    const notificationCount = notificationCounterRef.current;
    const notificationTime = new Date().toISOString().split('T')[1]; // Just time part
    
    // Track RR quality
    rrQualityRef.current.totalNotifications++;
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const flags = value.getUint8(0);
    const heartRate = flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔔 [${notificationTime}] #${notificationCount} - HR:${heartRate}, Flags:${flags.toString(2).padStart(8, '0')}, Bytes:${value.byteLength}`);
    }
    
    // Only process data if session is active and not paused
    if (!latestSessionData.current.sessionActive || latestSessionData.current.sessionPaused) {
      return;
    }

    setHrRef.current(heartRate);

    const baseTimestamp = Date.now();
    const rawBytes = Array.from(new Uint8Array(value.buffer));
    const rrFlagSet = (flags >> 4) & 0x01;

    // If RR intervals are present, create a separate data point for each one
    if (rrFlagSet) {
      const rrIntervals: number[] = [];
      for (let i = 2; i < value.byteLength; i += 2) {
        const rrRaw = value.getUint16(i, true);
        const rrMs = (rrRaw / 1024) * 1000;
        if (rrMs >= RR_INTERVAL_MIN_MS && rrMs <= RR_INTERVAL_MAX_MS) {
          rrIntervals.push(rrMs);
        } else if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ [${notificationTime}] Rejected RR: ${rrMs.toFixed(0)}ms (out of range)`);
        }
      }

      // Create ONE data point per notification (use last RR interval for timing accuracy)
      if (rrIntervals.length > 0) {
        // Use the LAST RR interval for more accurate timing
        const rrMs = rrIntervals[rrIntervals.length - 1];
        const hrFromRR = Math.round(60000 / rrMs);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📦 [${notificationTime}] RR:${rrMs.toFixed(0)}ms → HR:${hrFromRR} (using last of ${rrIntervals.length} intervals)`);
        }
        
        // Add single data point
        addRawHeartDataRef.current({
          timestamp: baseTimestamp,
          heartRate: hrFromRR,
          rrInterval: rrMs,
          flags,
          rawBytes,
          allRrIntervals: rrIntervals, // Keep all RR intervals for reference
        });
        
        // Track quality
        rrQualityRef.current.withRR++;
        return; // Exit here - don't fall through
      } else {
        // No valid RR intervals - calculate RR from HR
        const calculatedRR = Math.round(60000 / heartRate);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📦 [${notificationTime}] Calculated RR:${calculatedRR}ms → HR:${heartRate} (no RR data)`);
        }
        
        // Add calculated data point
        addRawHeartDataRef.current({
          timestamp: baseTimestamp,
          heartRate,
          rrInterval: calculatedRR,
          flags,
          rawBytes,
          calculatedFromHR: true, // Mark as calculated
        });
        
        // Track quality
        rrQualityRef.current.withoutRR++;
        return;
      }
    } else {
      // No RR intervals present - calculate RR from HR
      const calculatedRR = Math.round(60000 / heartRate);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 [${notificationTime}] Calculated RR:${calculatedRR}ms → HR:${heartRate} (no RR flag)`);
      }
      
      // Add calculated data point
      addRawHeartDataRef.current({
        timestamp: baseTimestamp,
        heartRate,
        rrInterval: calculatedRR,
        flags,
        rawBytes,
        calculatedFromHR: true, // Mark as calculated
      });
      
      // Track quality
      rrQualityRef.current.withoutRR++;
      return;
    }
  }, [latestSessionData]); // Stable callback - only depends on latestSessionData ref
  
  const getRRQuality = useCallback(() => {
    const { totalNotifications, withRR, withoutRR } = rrQualityRef.current;
    if (totalNotifications === 0) return { percentage: 100, quality: 'excellent', totalNotifications: 0, withRR: 0, withoutRR: 0 };
    
    const percentage = Math.round((withRR / totalNotifications) * 100);
    let quality = 'excellent';
    if (percentage < 60) quality = 'poor';
    else if (percentage < 70) quality = 'fair';
    else if (percentage < 85) quality = 'good';
    
    return { percentage, quality, totalNotifications, withRR, withoutRR };
  }, []);
  
  const onDisconnected = useCallback(() => {
    console.log('🔌 [DEBUG] Bluetooth onDisconnected called:', {
      sessionActive: latestSessionData.current.sessionActive,
      timestamp: new Date().toISOString()
    });
    
    if (latestSessionData.current.sessionActive) {
      addToast("Device disconnected unexpectedly!");
      // Use the ref to get the most up-to-date data
      const { elapsedTime, rawHeartData } = latestSessionData.current;
      const rrQuality = getRRQuality(); // Get RR quality data
      console.log('⚠️ [DEBUG] Calling endSession from Bluetooth disconnect with RR quality:', rrQuality);
      endSession(elapsedTime, rawHeartData, rrQuality);
    }
    setIsConnected(false);
    setDevice(null);
  }, [addToast, endSession, latestSessionData, getRRQuality]);

  const checkWebBluetoothSupport = () => {
    if (!navigator.bluetooth) {
      return {
        supported: false,
        reason: 'Web Bluetooth API is not available in this browser.',
        solution: 'Please use Chrome, Edge, or Opera on a compatible device (Android, Chrome OS, or desktop).'
      };
    }

    // Check if we're in a secure context
    if (!window.isSecureContext) {
      return {
        supported: false,
        reason: 'Web Bluetooth requires a secure context (HTTPS or localhost).',
        solution: 'Please access this app via HTTPS or localhost.'
      };
    }

    return { supported: true };
  };

  const connectBluetooth = async (): Promise<boolean> => {
    const connectionStart = performance.now();
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [DEBUG] User clicked Start Session at', new Date().toISOString());
    }
    
    const supportCheck = checkWebBluetoothSupport();
    
    if (!supportCheck.supported) {
      setStatusMessage(supportCheck.reason || 'Bluetooth not supported');
      addToast(`${supportCheck.reason} ${supportCheck.solution}`);
      return false;
    }
    
    try {
      setStatusMessage('Requesting device...');
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [DEBUG] Starting requestDevice at', new Date().toISOString());
      }
      
      const btDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [POLAR_HR_SERVICE_UUID] }],
        acceptAllDevices: false,
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [DEBUG] Device selected, connecting to GATT at', new Date().toISOString());
      }

      setStatusMessage('Connecting...');
      setDevice(btDevice);
      btDevice.addEventListener('gattserverdisconnected', onDisconnected);
      
      const server = await btDevice.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [DEBUG] GATT connected, discovering services at', new Date().toISOString());
      }
      
      const service = await server.getPrimaryService(POLAR_HR_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(POLAR_HR_CHARACTERISTIC_UUID);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [DEBUG] Starting notifications at', new Date().toISOString());
      }
      
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleHRNotification);

      setIsConnected(true);
      setStatusMessage(`Connected to ${btDevice.name}. Session running...`);
      addToast(`Successfully connected to ${btDevice.name}`);
      
      if (process.env.NODE_ENV === 'development') {
        const elapsed = performance.now() - connectionStart;
        console.log('🟢 [DEBUG] Connection complete at', new Date().toISOString(), `(took ${elapsed.toFixed(0)}ms)`);
      }
      
      return true;
    } catch (error: unknown) {
      console.error('Connection failed:', error);
      let errorMessage = 'Connection failed';
      let solution = '';
      
      if (error && typeof error === 'object' && 'name' in error) {
        switch (error.name) {
          case 'NotFoundError':
            // Check if user cancelled the dialog
            if ((error as any).message?.includes('User cancelled') || (error as any).message?.includes('chooser')) {
              // User cancelled - don't show this as an error
              setStatusMessage('Device selection cancelled.');
              return false;
            }
            errorMessage = 'No compatible heart rate device found';
            solution = 'Make sure your Polar H10 is powered on and not paired to another device. Try refreshing the page and scanning again.';
            break;
          case 'SecurityError':
            errorMessage = 'Bluetooth access denied';
            solution = 'Please allow Bluetooth access when prompted by your browser.';
            break;
          case 'NetworkError':
            errorMessage = 'Connection lost during pairing';
            solution = 'Make sure your Polar H10 is close to your device and try again.';
            break;
          case 'NotSupportedError':
            errorMessage = 'Bluetooth Low Energy not supported';
            solution = 'Your device does not support Bluetooth Low Energy. Please use a compatible device.';
            break;
          case 'NotAllowedError':
            errorMessage = 'Bluetooth permission denied';
            solution = 'Please allow Bluetooth access in your browser settings and try again.';
            break;
          default:
            errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
            solution = 'Please check your device compatibility and try again.';
        }
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
        solution = 'Please check your device compatibility and try again.';
      }
      
      setStatusMessage(`Error: ${errorMessage}`);
      addToast(`Bluetooth Error: ${errorMessage}. ${solution}`);
      setDevice(null);
      setIsConnected(false);
      return false;
    }
  };
  
  const disconnectDevice = useCallback(() => {
    if (device) {
      try {
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
        // Remove event listeners
        device.removeEventListener('gattserverdisconnected', onDisconnected);
      } catch (error) {
        console.warn('Error during device disconnection:', error);
      }
    }
    setIsConnected(false);
    setDevice(null);
    setStatusMessage('Device disconnected');
  }, [device, onDisconnected]);

  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
    const isEdge = /Edge/.test(userAgent);
    const isOpera = /Opera/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    
    return {
      userAgent,
      isChrome,
      isEdge,
      isOpera,
      isSafari,
      isFirefox,
      isSecureContext: window.isSecureContext,
      hasBluetooth: 'bluetooth' in navigator,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    };
  };

  return {
    device,
    isConnected,
    statusMessage,
    setStatusMessage,
    connectBluetooth,
    disconnectDevice,
    getBrowserInfo,
    getRRQuality,
  };
};

