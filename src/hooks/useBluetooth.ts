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
  }, [setHr, addRawHeartData]);
  
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

  const startRealSession = async () => {
    if (!navigator.bluetooth) {
      setStatusMessage('Web Bluetooth API is not available.');
      addToast('Web Bluetooth is not supported in this browser.');
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
      
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError') {
        errorMessage = 'No compatible heart rate device found';
      } else if (error && typeof error === 'object' && 'name' in error && error.name === 'SecurityError') {
        errorMessage = 'Bluetooth access denied';
      } else if (error && typeof error === 'object' && 'name' in error && error.name === 'NetworkError') {
        errorMessage = 'Connection lost during pairing';
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      }
      
      setStatusMessage(`Error: ${errorMessage}`);
      addToast(`Bluetooth Error: ${errorMessage}`);
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

  return {
    device,
    isConnected,
    statusMessage,
    setStatusMessage,
    startRealSession,
    disconnectDevice,
  };
};

