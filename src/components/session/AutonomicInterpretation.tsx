import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';
import type { SessionSummary } from '@/types';

interface HistoricalComparison {
  rmssd?: { change: number; direction: 'up' | 'down' };
  sdnn?: { change: number; direction: 'up' | 'down' };
  lf?: { change: number; direction: 'up' | 'down' };
  hf?: { change: number; direction: 'up' | 'down' };
}

interface AutonomicInterpretationProps {
  interpretation: InterpretationResult | null;
  isLoading?: boolean;
  summary: SessionSummary;
  userId?: string | null;
}

const AutonomicInterpretation: React.FC<AutonomicInterpretationProps> = ({
  interpretation,
  isLoading = false,
  summary,
  userId
}) => {
  const [yesterdayComparison, setYesterdayComparison] = useState<HistoricalComparison | null>(null);
  const [monthAgoComparison, setMonthAgoComparison] = useState<HistoricalComparison | null>(null);
  const [loadingComparisons, setLoadingComparisons] = useState(false);

  // Fetch historical sessions for comparison
  useEffect(() => {
    const fetchHistoricalComparisons = async () => {
      if (!userId || !summary || isLoading) {
        return;
      }

      setLoadingComparisons(true);
      try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        // Fetch sessions from yesterday and a month ago
        const [yesterdayResponse, monthAgoResponse] = await Promise.all([
          fetch(`/api/sessions/calendar?userId=${userId}&startDate=${yesterday.toISOString().split('T')[0]}&endDate=${yesterday.toISOString().split('T')[0]}`),
          fetch(`/api/sessions/calendar?userId=${userId}&startDate=${monthAgo.toISOString().split('T')[0]}&endDate=${monthAgo.toISOString().split('T')[0]}`)
        ]);

        const yesterdayData = await yesterdayResponse.json();
        const monthAgoData = await monthAgoResponse.json();

        // Get the most recent session from each period
        const yesterdaySession = yesterdayData.sessions?.[0];
        const monthAgoSession = monthAgoData.sessions?.[0];

        // Fetch session summaries for LF/HF power values
        const fetchSummary = async (sessionId: string) => {
          try {
            const response = await fetch(`/api/sessions/summary?sessionId=${sessionId}`);
            if (response.ok) {
              const data = await response.json();
              return data.summary;
            }
          } catch (error) {
            console.error('Error fetching session summary:', error);
          }
          return null;
        };

        const [yesterdaySummary, monthAgoSummary] = await Promise.all([
          yesterdaySession ? fetchSummary(yesterdaySession.id) : Promise.resolve(null),
          monthAgoSession ? fetchSummary(monthAgoSession.id) : Promise.resolve(null)
        ]);

        // Calculate comparisons for yesterday
        if (yesterdaySession) {
          const comparison: HistoricalComparison = {};
          if (summary.sessionRMSSD.value && yesterdaySession.rmssd) {
            const change = ((summary.sessionRMSSD.value - yesterdaySession.rmssd) / yesterdaySession.rmssd) * 100;
            comparison.rmssd = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.sdnn?.value && yesterdaySummary?.sdnn_session_ms) {
            const change = ((summary.sdnn.value - yesterdaySummary.sdnn_session_ms) / yesterdaySummary.sdnn_session_ms) * 100;
            comparison.sdnn = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.lfPower.value && yesterdaySummary?.lf_power_ms2 && yesterdaySummary.lf_power_ms2 > 0) {
            const change = ((summary.lfPower.value - yesterdaySummary.lf_power_ms2) / yesterdaySummary.lf_power_ms2) * 100;
            comparison.lf = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          setYesterdayComparison(comparison);
        }

        // Calculate comparisons for a month ago
        if (monthAgoSession) {
          const comparison: HistoricalComparison = {};
          if (summary.sessionRMSSD.value && monthAgoSession.rmssd) {
            const change = ((summary.sessionRMSSD.value - monthAgoSession.rmssd) / monthAgoSession.rmssd) * 100;
            comparison.rmssd = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.sdnn?.value && monthAgoSummary?.sdnn_session_ms) {
            const change = ((summary.sdnn.value - monthAgoSummary.sdnn_session_ms) / monthAgoSummary.sdnn_session_ms) * 100;
            comparison.sdnn = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          if (summary.hfPower.value && monthAgoSummary?.hf_power_ms2 && monthAgoSummary.hf_power_ms2 > 0) {
            const change = ((summary.hfPower.value - monthAgoSummary.hf_power_ms2) / monthAgoSummary.hf_power_ms2) * 100;
            comparison.hf = { change: Math.abs(change), direction: change > 0 ? 'up' : 'down' };
          }
          setMonthAgoComparison(comparison);
        }
      } catch (error) {
        console.error('Error fetching historical comparisons:', error);
      } finally {
        setLoadingComparisons(false);
      }
    };

    fetchHistoricalComparisons();
  }, [userId, summary, isLoading]);

  // Determine color based on pattern ID
  const getStateColor = (patternId: number) => {
    // Stressed/Depleted states (red)
    if ([7, 8, 9, 10, 16].includes(patternId)) {
      return {
        headerBg: 'bg-red-50/50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700'
      };
    }
    // Warning/Fatigue states (yellow/orange)
    if ([3, 6, 13, 18].includes(patternId)) {
      return {
        headerBg: 'bg-yellow-50/50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-700'
      };
    }
    // Optimal/Recovered states (green)
    if ([1, 2, 4, 11, 15, 20].includes(patternId)) {
      return {
        headerBg: 'bg-green-50/50',
        borderColor: 'border-green-200',
        textColor: 'text-green-700'
      };
    }
    // Neutral/Baseline states (blue)
    return {
      headerBg: 'bg-blue-50/50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700'
    };
  };

  if (isLoading || loadingComparisons) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4 p-5">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!interpretation) {
    return (
      <div className="bg-white border border-blue-200 rounded-lg shadow-sm">
        <div className="p-5">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Baseline Not Established</h3>
              <p className="text-sm text-blue-700">
                We need at least 7 sessions over 5+ days to establish your personal baseline. 
                Once established, you'll receive personalized interpretations and recommendations 
                based on your unique HRV patterns.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stateColor = getStateColor(interpretation.patternId);
  
  // Check if this is a green (optimal/recovered) state
  const isGreenState = [1, 2, 4, 11, 15, 20].includes(interpretation.patternId);

  // Helper function to check if a comparison has any data
  const hasComparisonData = (comparison: HistoricalComparison | null): boolean => {
    if (!comparison) return false;
    return !!(comparison.rmssd || comparison.sdnn || comparison.lf || comparison.hf);
  };

  // Helper function to render metric comparison
  const renderMetricComparison = (
    label: string,
    comparison?: { change: number; direction: 'up' | 'down' }
  ) => {
    if (!comparison) return null;

    const isUp = comparison.direction === 'up';
    const arrowColor = isUp ? 'text-green-500' : 'text-red-500';
    const textColor = isUp ? 'text-green-600' : 'text-red-600';
    const sign = isUp ? '+' : '-';

    return (
      <li className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center space-x-1.5">
          {isUp ? (
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${arrowColor}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${arrowColor}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.707-6.707l-3-3a1 1 0 011.414-1.414L9 10.586V7a1 1 0 112 0v3.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${textColor}`}>
            {sign}{comparison.change.toFixed(1)}%
          </span>
        </div>
      </li>
    );
  };

  // Check if we have any comparison data to show
  const hasYesterdayData = hasComparisonData(yesterdayComparison);
  const hasMonthAgoData = hasComparisonData(monthAgoComparison);
  const hasAnyComparisonData = hasYesterdayData || hasMonthAgoData;


  return (
    <div className={`bg-white border ${stateColor.borderColor} rounded-lg shadow-sm`}>
      {/* Result Header */}
      {isGreenState && (
        <div className={`flex items-start space-x-3 p-5 ${stateColor.headerBg} rounded-t-lg`}>
          <AlertTriangle className={`h-6 w-6 ${stateColor.textColor} flex-shrink-0`} />
          <div>
            <h2 className={`text-lg font-semibold ${stateColor.textColor}`}>
              {interpretation.physiologicalState}
            </h2>
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className="p-5 space-y-6">
        {/* Relative to Your Baseline Section */}
        {hasAnyComparisonData && (
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Relative to Your Baseline</h3>
            <div className={`grid gap-4 ${hasYesterdayData && hasMonthAgoData ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Yesterday Card */}
              {hasYesterdayData && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">vs. Yesterday</h4>
                  <ul className="space-y-2.5">
                    {renderMetricComparison('RMSSD', yesterdayComparison?.rmssd)}
                    {renderMetricComparison('SDNN', yesterdayComparison?.sdnn)}
                    {renderMetricComparison('LF', yesterdayComparison?.lf)}
                  </ul>
                </div>
              )}

              {/* A Month Ago Card */}
              {hasMonthAgoData && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">vs. A Month Ago</h4>
                  <ul className="space-y-2.5">
                    {renderMetricComparison('RMSSD', monthAgoComparison?.rmssd)}
                    {renderMetricComparison('SDNN', monthAgoComparison?.sdnn)}
                    {renderMetricComparison('HF', monthAgoComparison?.hf)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Population Reference */}
        {interpretation.absoluteInterpretation && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-gray-700">Population Reference</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {interpretation.absoluteInterpretation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Action */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-gray-700">Recommended Action</h3>
              <p className="text-sm text-gray-600 mt-1">
                {interpretation.combinedAdvice}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutonomicInterpretation;

