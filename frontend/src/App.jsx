import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Constants ---
const POLAR_HR_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const POLAR_HR_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';
const RR_INTERVAL_MIN_MS = 200;
const RR_INTERVAL_MAX_MS = 2800;
const SESSION_MILESTONES = [
  { label: 'Quick Check', value: 120 },
  { label: 'Standard', value: 300 },
  { label: 'Deep Insight', value: 600 },
  { label: 'Full Analysis', value: 900 },
];
const MAX_SESSION_DURATION = 900; // 15 minutes

// --- HRV Calculation Functions ---

// Basic real-time metrics
const calculateRMSSD = (rr) => (rr.length < 2) ? null : Math.sqrt(rr.slice(1).reduce((acc, val, i) => acc + Math.pow(val - rr[i], 2), 0) / (rr.length - 1));
const calculateSDNN = (rr) => {
    if (rr.length < 2) return null;
    const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
    return Math.sqrt(rr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / rr.length);
};
const calculatePNN50 = (rr) => (rr.length < 2) ? null : (rr.slice(1).filter((val, i) => Math.abs(val - rr[i]) > 50).length / (rr.length - 1)) * 100;
const calculateMeanHR = (rr) => (rr.length === 0) ? null : 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length);

// Post-session summary metrics
const calculateMode = (rr) => {
    if (rr.length === 0) return null;
    const rounded = rr.map(val => Math.round(val));
    const counts = rounded.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
    const modeVal = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, null);
    return modeVal ? parseInt(modeVal) : null;
};
const calculateAMo50 = (rr, mode) => {
    if (rr.length === 0 || mode === null) return null;
    const count = rr.filter(val => Math.abs(val - mode) <= 25).length;
    return (count / rr.length) * 100;
};
const calculateCV = (sdnn, meanRR) => (sdnn === null || meanRR === null || meanRR === 0) ? null : (sdnn / meanRR) * 100;
const calculateMxDMn = (rr) => (rr.length < 2) ? null : Math.max(...rr) - Math.min(...rr);


// --- UI Components ---

const MetricCard = ({ title, value, unit, darkMode }) => (
  <div className={`p-4 rounded-lg shadow-md flex flex-col items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}>
    <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{title}</h3>
    <p className="text-2xl md:text-3xl font-bold">
      {typeof value === 'number' ? value.toFixed(2) : 'N/A'}
    </p>
    {unit && <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>}
  </div>
);

const Toast = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">
            {message}
        </div>
    );
};

const MilestoneProgressBar = ({ elapsedTime, totalDuration, milestones, darkMode }) => {
    return (
        <div className="mt-4">
            <div className="relative h-2.5 w-full bg-gray-200 rounded-full dark:bg-gray-700">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(elapsedTime / totalDuration) * 100}%`, transition: 'width 1s linear' }}></div>
                {milestones.map(milestone => {
                    const isReached = elapsedTime >= milestone.value;
                    const position = (milestone.value / totalDuration) * 100;
                    return (
                        <div key={milestone.label} className="absolute top-1/2" style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${isReached ? 'bg-green-500' : (darkMode ? 'bg-gray-500' : 'bg-gray-300')}`}>
                                {isReached && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className={`absolute -bottom-5 text-xs whitespace-nowrap ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ transform: 'translateX(-50%)' }}>
                                {milestone.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <p className="text-center text-sm mt-6 font-mono">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / {totalDuration / 60}:00</p>
        </div>
    );
};

const SessionSummaryModal = ({ summary, darkMode, onReset }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-6 rounded-xl shadow-2xl w-full max-w-md mx-4`}>
            <h2 className="text-2xl font-bold text-center mb-4">Session Summary</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
                {Object.entries(summary).map(([key, item]) => (
                    <div key={key} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <p className="text-sm text-gray-400">{item.label}</p>
                        <p className="text-xl font-semibold">{typeof item.value === 'number' ? item.value.toFixed(2) : 'N/A'} <span className="text-xs">{item.unit}</span></p>
                    </div>
                ))}
            </div>
            <button
                onClick={onReset}
                className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-105"
            >
                Start New Session
            </button>
        </div>
    </div>
);


const App = () => {
    // --- State Management ---
    const [device, setDevice] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Click "Start Session" to begin.');
    const [hr, setHr] = useState(null);
    const [rrIntervals, setRrIntervals] = useState([]);
    const [darkMode, setDarkMode] = useState(false);
    const [toasts, setToasts] = useState([]);
    
    // Session state
    const [sessionActive, setSessionActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [sessionSummary, setSessionSummary] = useState(null);
    const milestonesReached = useRef(new Set());
    const sessionTimer = useRef(null);

    // --- Derived State & Memos ---
    const liveHrvMetrics = useMemo(() => {
        const latestRR = rrIntervals.slice(-128); // Calculate on last ~2 mins of data
        return {
            rmssd: calculateRMSSD(latestRR),
            sdnn: calculateSDNN(latestRR),
            pnn50: calculatePNN50(latestRR),
            meanHR: calculateMeanHR(latestRR),
        };
    }, [rrIntervals]);

    const chartData = useMemo(() =>
        rrIntervals.map((rr, index) => ({ name: index + 1, rr })),
        [rrIntervals]
    );

    // --- Toast Notification Handler ---
    const addToast = useCallback((message) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);
    
    // --- endSession needs to be defined before being used in useEffect ---
    const endSession = useCallback(() => {
        setStatusMessage('Session ended. Calculating summary...');
        setSessionActive(false);
        setIsConnected(false);

        if (device && device.gatt.connected) {
            device.gatt.disconnect();
        }
        
        // Calculate final summary
        const meanRR = rrIntervals.length > 0 ? rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length : null;
        const sdnn = calculateSDNN(rrIntervals);
        const mode = calculateMode(rrIntervals);

        setSessionSummary({
            duration: { label: 'Duration', value: elapsedTime, unit: 's' },
            totalBeats: { label: 'Total Beats', value: rrIntervals.length, unit: '' },
            meanHR: { label: 'Mean HR', value: calculateMeanHR(rrIntervals), unit: 'bpm' },
            meanRR: { label: 'Mean RR', value: meanRR, unit: 'ms' },
            rmssd: { label: 'RMSSD', value: calculateRMSSD(rrIntervals), unit: 'ms' },
            sdnn: { label: 'SDNN', value: sdnn, unit: 'ms' },
            pnn50: { label: 'pNN50', value: calculatePNN50(rrIntervals), unit: '%' },
            mxdmn: { label: 'MxDMn', value: calculateMxDMn(rrIntervals), unit: 'ms' },
            cv: { label: 'CV', value: calculateCV(sdnn, meanRR), unit: '%' },
            mo: { label: 'Mode (Mo)', value: mode, unit: 'ms' },
            amo50: { label: 'AMo50', value: calculateAMo50(rrIntervals, mode), unit: '%' },
        });
    }, [device, rrIntervals, elapsedTime]);

    // --- Session Timer Logic ---
    useEffect(() => {
        if (sessionActive) {
            sessionTimer.current = setInterval(() => {
                setElapsedTime(prevTime => {
                    const newTime = prevTime + 1;
                    
                    const milestone = SESSION_MILESTONES.find(d => d.value === newTime);
                    if (milestone && !milestonesReached.current.has(newTime)) {
                        addToast(`${milestone.label} analysis complete!`);
                        milestonesReached.current.add(newTime);
                    }

                    if (newTime >= MAX_SESSION_DURATION) {
                        endSession();
                    }
                    return newTime;
                });
            }, 1000);
        } else {
            clearInterval(sessionTimer.current);
        }
        return () => clearInterval(sessionTimer.current);
    }, [sessionActive, addToast, endSession]);

    // --- Bluetooth & Session Logic ---
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
    }, []);

    const onDisconnected = useCallback(() => {
        if (sessionActive) {
            addToast("Device disconnected unexpectedly!");
            endSession();
        }
    }, [sessionActive, addToast, endSession]);

    const startSession = async () => {
        if (!navigator.bluetooth) {
            setStatusMessage('Web Bluetooth API is not available.');
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
            milestonesReached.current.clear();
        } catch (error) {
            console.error('Connection failed:', error);
            setStatusMessage(`Error: ${error.message}.`);
            setDevice(null);
        }
    };

    const resetApp = () => {
        setDevice(null);
        setHr(null);
        setRrIntervals([]);
        setElapsedTime(0);
        setSessionSummary(null);
        setStatusMessage('Click "Start Session" to begin.');
    };

    // --- Dark Mode ---
    const toggleDarkMode = () => setDarkMode(!darkMode);
    useEffect(() => {
        document.body.className = darkMode ? 'bg-gray-900' : 'bg-gray-100';
    }, [darkMode]);

    // --- Render ---
    return (
        <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'text-white bg-gray-900' : 'text-gray-800 bg-gray-100'}`}>
            <div className="container mx-auto p-4 md:p-8">
                {toasts.map(toast => <Toast key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />)}
                {sessionSummary && <SessionSummaryModal summary={sessionSummary} darkMode={darkMode} onReset={resetApp} />}

                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl md:text-4xl font-bold">Polar H10 HRV Monitor</h1>
                    <button onClick={toggleDarkMode} className={`p-2 rounded-full transition-colors duration-300 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-200'}`}>
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                </header>

                <div className={`p-4 rounded-lg shadow-md mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <p className="text-sm text-center sm:text-left">{statusMessage}</p>
                        </div>
                        {!sessionActive ? (
                            <button onClick={startSession} disabled={sessionSummary !== null} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                Start Session
                            </button>
                        ) : (
                            <button onClick={endSession} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-transform transform hover:scale-105">
                                End Session
                            </button>
                        )}
                    </div>
                    {sessionActive && (
                        <MilestoneProgressBar 
                            elapsedTime={elapsedTime} 
                            totalDuration={MAX_SESSION_DURATION} 
                            milestones={SESSION_MILESTONES}
                            darkMode={darkMode}
                        />
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard title="Live HR" value={hr} unit="BPM" darkMode={darkMode} />
                    <MetricCard title="Live RMSSD" value={liveHrvMetrics.rmssd} unit="ms" darkMode={darkMode} />
                    <MetricCard title="Live SDNN" value={liveHrvMetrics.sdnn} unit="ms" darkMode={darkMode} />
                    <MetricCard title="Live pNN50" value={liveHrvMetrics.pnn50} unit="%" darkMode={darkMode} />
                </div>

                <div className={`p-4 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <h2 className="text-xl font-semibold mb-4">Live RR Intervals (Total: {rrIntervals.length})</h2>
                    {sessionActive && rrIntervals.length > 1 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData.slice(-256)}>
                                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#4A5568' : '#ccc'} />
                                <XAxis dataKey="name" stroke={darkMode ? '#A0AEC0' : '#666'} />
                                <YAxis domain={['dataMin - 50', 'dataMax + 50']} stroke={darkMode ? '#A0AEC0' : '#666'} label={{ value: 'RR Interval (ms)', angle: -90, position: 'insideLeft', fill: darkMode ? '#A0AEC0' : '#666' }} />
                                <Tooltip contentStyle={{ backgroundColor: darkMode ? 'rgba(45, 55, 72, 0.8)' : 'rgba(255, 255, 255, 0.8)', borderColor: darkMode ? '#4A5568' : '#ccc', color: darkMode ? '#E2E8F0' : '#333' }} />
                                <Line type="monotone" dataKey="rr" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px]">
                            <p className="text-gray-500">{sessionActive ? "Waiting for RR interval data..." : "Start a session to see the chart."}</p>
                        </div>
                    )}
                </div>

                <footer className="text-center mt-8 text-xs text-gray-500">
                    <p>Ensure you are on a secure context (HTTPS or localhost) for Web Bluetooth to work.</p>
                    <p>This app is for informational purposes only and is not a medical device.</p>
                </footer>
            </div>
        </div>
    );
};

export default App; 