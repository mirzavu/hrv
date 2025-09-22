import { useState, useCallback } from 'react';

const POLAR_HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const POLAR_HR_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const RR_INTERVAL_MIN_MS = 200;
const RR_INTERVAL_MAX_MS = 2800;

export const useBluetooth = (
    setSessionActive,
    setRrIntervals,
    setHr,
    endSession,
    addToast,
    latestSessionData // Accept the ref as an argument
) => {
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Click "Start Session" to begin.');

    const handleHRNotification = useCallback((event) => {
        const value = event.target.value;
        const flags = value.getUint8(0);
        setHr(flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1));

        if ((flags >> 4) & 0x01) {
            const newRrIntervals = [];
            for (let i = 2; i < value.byteLength; i += 2) {
                const rrRaw = value.getUint16(i, true);
                const rrMs = (rrRaw / 1024) * 1000;
                if (rrMs >= RR_INTERVAL_MIN_MS && rrMs <= RR_INTERVAL_MAX_MS) {
                    newRrIntervals.push(rrMs);
                }
            }
            if (newRrIntervals.length > 0) {
              setRrIntervals(prev => [...prev, ...newRrIntervals]);
            }
        }
    }, [setHr, setRrIntervals]);
    
    const onDisconnected = useCallback(() => {
        if (latestSessionData.current.sessionActive) {
            addToast("Device disconnected unexpectedly!");
            // Use the ref to get the most up-to-date data
            const { elapsedTime, rrIntervals } = latestSessionData.current;
            endSession(elapsedTime, rrIntervals);
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
            
            const server = await btDevice.gatt.connect();
            const service = await server.getPrimaryService(POLAR_HR_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(POLAR_HR_CHARACTERISTIC_UUID);
            
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', handleHRNotification);

            setIsConnected(true);
            setSessionActive(true);
            setStatusMessage(`Connected to ${btDevice.name}. Session running...`);
            addToast(`Successfully connected to ${btDevice.name}`);
        } catch (error) {
            console.error('Connection failed:', error);
            let errorMessage = 'Connection failed';
            
            if (error.name === 'NotFoundError') {
                errorMessage = 'No compatible heart rate device found';
            } else if (error.name === 'SecurityError') {
                errorMessage = 'Bluetooth access denied';
            } else if (error.name === 'NetworkError') {
                errorMessage = 'Connection lost during pairing';
            } else {
                errorMessage = error.message || 'Unknown connection error';
            }
            
            setStatusMessage(`Error: ${errorMessage}`);
            addToast(`Bluetooth Error: ${errorMessage}`);
            setDevice(null);
            setIsConnected(false);
        }
    };
    
    const disconnectDevice = () => {
        if (device) {
            try {
                if (device.gatt.connected) {
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
    };

    return {
        device,
        isConnected,
        statusMessage,
        setStatusMessage,
        startRealSession,
        disconnectDevice,
    };
};
