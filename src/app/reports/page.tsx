'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import MetricCard from '@/components/ui/MetricCard';

interface Session {
  $id: string;
  date: string;
  sessionType: string;
  duration: number;
  totalBeats: number;
  meanHR: number;
  rmssd: number;
  sdnn: number;
  pnn50: number;
}

function ReportsContent() {
  const { user } = useAuthContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user || user.$id === 'guest') {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/sessions?userId=${user.$id}&limit=20`);
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        
        const data = await response.json();
        setSessions(data.sessions || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to view reports</h1>
          <a href="/" className="text-blue-500 hover:underline">Go back to home</a>
        </div>
      </div>
    );
  }

  if (user.$id === 'guest') {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Reports</h1>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Guest Mode</h2>
              <p className="text-yellow-700 mb-4">
                Reports are only available for registered users. Guest sessions are stored locally.
              </p>
              <Link href="/" className="text-blue-500 hover:underline">Go back to home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const calculateAverages = () => {
    if (sessions.length === 0) return null;
    
    const totals = sessions.reduce((acc, session) => ({
      duration: acc.duration + (session.duration || 0),
      meanHR: acc.meanHR + (session.meanHR || 0),
      rmssd: acc.rmssd + (session.rmssd || 0),
      sdnn: acc.sdnn + (session.sdnn || 0),
      pnn50: acc.pnn50 + (session.pnn50 || 0),
    }), { duration: 0, meanHR: 0, rmssd: 0, sdnn: 0, pnn50: 0 });

    const count = sessions.length;
    return {
      avgDuration: totals.duration / count,
      avgMeanHR: totals.meanHR / count,
      avgRMSSD: totals.rmssd / count,
      avgSDNN: totals.sdnn / count,
      avgPNN50: totals.pnn50 / count,
    };
  };

  const averages = calculateAverages();

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">HRV Reports</h1>
          <p className="text-lg text-gray-600">
            Your HRV session history and analytics
          </p>
          <Link href="/" className="text-blue-500 hover:underline mt-2 inline-block">
            ← Back to HRV Monitor
          </Link>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
            <p className="text-red-700">Error: {error}</p>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-center">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold mb-4">No Sessions Yet</h2>
              <p className="text-gray-600 mb-4">
                You haven&apos;t recorded any HRV sessions yet. Start your first session to see reports here.
              </p>
              <Link 
                href="/" 
                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Start First Session
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Statistics */}
            {averages && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold mb-6">Average Metrics ({sessions.length} sessions)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <MetricCard
                    title="Avg Duration"
                    value={averages.avgDuration}
                    unit="s"
                    darkMode={false}
                  />
                  <MetricCard
                    title="Avg Heart Rate"
                    value={averages.avgMeanHR}
                    unit="bpm"
                    darkMode={false}
                  />
                  <MetricCard
                    title="Avg RMSSD"
                    value={averages.avgRMSSD}
                    unit="ms"
                    darkMode={false}
                  />
                  <MetricCard
                    title="Avg SDNN"
                    value={averages.avgSDNN}
                    unit="ms"
                    darkMode={false}
                  />
                  <MetricCard
                    title="Avg pNN50"
                    value={averages.avgPNN50}
                    unit="%"
                    darkMode={false}
                  />
                </div>
              </div>
            )}

            {/* Session History */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6">Session History</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3">Heart Rate</th>
                      <th className="px-6 py-3">RMSSD</th>
                      <th className="px-6 py-3">SDNN</th>
                      <th className="px-6 py-3">pNN50</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.$id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {new Date(session.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">{session.sessionType}</td>
                        <td className="px-6 py-4">{Math.round(session.duration || 0)}s</td>
                        <td className="px-6 py-4">{Math.round(session.meanHR || 0)} bpm</td>
                        <td className="px-6 py-4">{(session.rmssd || 0).toFixed(1)} ms</td>
                        <td className="px-6 py-4">{(session.sdnn || 0).toFixed(1)} ms</td>
                        <td className="px-6 py-4">{(session.pnn50 || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { addToast } = useToast();

  return (
    <AuthProvider addToast={addToast}>
      <ReportsContent />
    </AuthProvider>
  );
}
