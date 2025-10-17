'use client';

import { Dispatch, MutableRefObject, SetStateAction, useCallback, useState } from 'react';
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
}

export const useBluetooth = (
  setSessionActive: (active: boolean) => void,
  addRawHeartData: (data: RawHeartData) => void,
  setHr: Dispatch<SetStateAction<number | null>>,
  endSession: (elapsedTime: number, rawHeartData: RawHeartData[]) => void,
  addToast: (message: string) => void,
  latestSessionData: MutableRefObject<SessionData> // Accept the ref as an argument
) => {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Click "Start Session" to begin.');

  const handleHRNotification = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const flags = value.getUint8(0);
    const heartRate = flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
    if (latestSessionData.current.sessionPaused) {
      return;
    }

    setHr(heartRate);

    // Store raw heart data with all available information
    const rawData: RawHeartData = {
      timestamp: Date.now(),
      heartRate,
      flags,
      rawBytes: Array.from(new Uint8Array(value.buffer)),
    };

    // If RR intervals are present, add them to the raw data
    if ((flags >> 4) & 0x01) {
      const rrIntervals: number[] = [];
      for (let i = 2; i < value.byteLength; i += 2) {
        const rrRaw = value.getUint16(i, true);
        const rrMs = (rrRaw / 1024) * 1000;
        if (rrMs >= RR_INTERVAL_MIN_MS && rrMs <= RR_INTERVAL_MAX_MS) {
          rrIntervals.push(rrMs);
        }
      }
      rawData.rrInterval = rrIntervals.length > 0 ? rrIntervals[0] : undefined; // Take first RR interval
      rawData.allRrIntervals = rrIntervals; // Store all RR intervals
    }

    addRawHeartData(rawData);
  }, [setHr, addRawHeartData, latestSessionData]);
  
  const onDisconnected = useCallback(() => {
    if (latestSessionData.current.sessionActive) {
      addToast("Device disconnected unexpectedly!");
      // Use the ref to get the most up-to-date data
      const { elapsedTime, rawHeartData } = latestSessionData.current;
      endSession(elapsedTime, rawHeartData);
    }
    setIsConnected(false);
    setDevice(null);
  }, [addToast, endSession, latestSessionData]);

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

  const startRealSession = async () => {
    const supportCheck = checkWebBluetoothSupport();
    
    if (!supportCheck.supported) {
      setStatusMessage(supportCheck.reason);
      addToast(`${supportCheck.reason} ${supportCheck.solution}`);
      return;
    }
    
    try {
      setStatusMessage('Requesting device...');
      const btDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [POLAR_HR_SERVICE_UUID] }],
        acceptAllDevices: false,
      });

      setStatusMessage('Connecting...');
      setDevice(btDevice);
      btDevice.addEventListener('gattserverdisconnected', onDisconnected);
      
      const server = await btDevice.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');
      
      const service = await server.getPrimaryService(POLAR_HR_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(POLAR_HR_CHARACTERISTIC_UUID);
      
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleHRNotification);

      setIsConnected(true);
      setSessionActive(true);
      setStatusMessage(`Connected to ${btDevice.name}. Session running...`);
      addToast(`Successfully connected to ${btDevice.name}`);
    } catch (error: unknown) {
      console.error('Connection failed:', error);
      let errorMessage = 'Connection failed';
      let solution = '';
      
      if (error && typeof error === 'object' && 'name' in error) {
        switch (error.name) {
          case 'NotFoundError':
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
    startRealSession,
    disconnectDevice,
    getBrowserInfo,
  };
};

