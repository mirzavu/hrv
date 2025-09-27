import React from 'react';
import { SessionSummary } from '@/types';
import { formatDuration, formatRmssdDelta, formatPercentage, formatScore } from '@/utils/sessionSummaryFormat';
import { getStressIndexIndicator, getRestorationIndexIndicator } from '@/utils/metricIndicators';
import RRVisualization from './RRVisualization';

interface SessionSummaryModalProps {
  summary: SessionSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
}

const MetricCard: React.FC<{
  label: string;
  value: number | null;
  unit: string;
  darkMode: boolean;
  isRmssdDelta?: boolean;
  className?: string;
}> = ({ label, value, unit, darkMode, isRmssdDelta = false, className = '' }) => {
  let displayValue = 'N/A';
  let valueColor = '';
  
  if (value !== null) {
    if (isRmssdDelta) {
      const delta = formatRmssdDelta(value);
      displayValue = delta.value;
      valueColor = delta.isPositive ? 'text-green-600' : 'text-red-600';
    } else {
      displayValue = typeof value === 'number' ? value.toFixed(1) : String(value);
    }
  }

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${className}`}>
      <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-semibold ${valueColor}`}>
          {displayValue}
        </span>
        {unit && (
          <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

const EnhancedMetricCard: React.FC<{
  label: string;
  value: number | null;
  unit: string;
  darkMode: boolean;
  indicator: import('@/utils/metricIndicators').MetricIndicator | null;
  className?: string;
}> = ({ label, value, unit, darkMode, indicator, className = '' }) => {
  const displayValue = value !== null ? value.toFixed(1) : 'N/A';

  return (
    <div className={`p-5 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} ${className}`}>
      {/* Header */}
      <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>{label}</p>
      
      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {displayValue}
        </span>
        {unit && (
          <span className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {unit}
          </span>
        )}
      </div>

      {/* Indicator Band */}
      {indicator && (
        <div className={`p-3 rounded-lg border ${indicator.bgColor} ${indicator.borderColor}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{indicator.icon}</span>
            <span className={`font-semibold ${indicator.textColor}`}>
              {indicator.label}
            </span>
          </div>
          <p className={`text-sm ${indicator.textColor} leading-relaxed`}>
            {indicator.message}
          </p>
        </div>
      )}
    </div>
  );
};

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ 
  summary, 
  darkMode, 
  onReset, 
  isGuest, 
  onGuestLogin, 
  onClose 
}) => (
  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative`}>
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 p-2 rounded-full transition-colors z-10 ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <div className="p-6">
        <h2 className="text-3xl font-bold text-center mb-6">Session Summary</h2>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard
            label="Session Duration"
            value={summary.duration.value}
            unit={summary.duration.unit}
            darkMode={darkMode}
            className="md:col-span-1"
          />
          <MetricCard
            label="Mean Heart Rate"
            value={summary.meanHR.value}
            unit={summary.meanHR.unit}
            darkMode={darkMode}
            className="md:col-span-1"
          />
          <MetricCard
            label="Data Points"
            value={summary.dataPoints.value}
            unit=""
            darkMode={darkMode}
            className="md:col-span-1"
          />
        </div>

        {/* HRV Analysis Section */}
        <div className="mb-6">
          <h3 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            HRV Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard
              label="Session RMSSD"
              value={summary.sessionRMSSD.value}
              unit={summary.sessionRMSSD.unit}
              darkMode={darkMode}
            />
            <MetricCard
              label="Start RMSSD"
              value={summary.startRMSSD.value}
              unit={summary.startRMSSD.unit}
              darkMode={darkMode}
            />
            <MetricCard
              label="End RMSSD"
              value={summary.endRMSSD.value}
              unit={summary.endRMSSD.unit}
              darkMode={darkMode}
            />
            <MetricCard
              label="RMSSD Change"
              value={summary.rmssdDelta.value}
              unit={summary.rmssdDelta.unit}
              darkMode={darkMode}
              isRmssdDelta={true}
            />
          </div>
          
          {/* HRV Stability - Enhanced Display */}
          {summary.hrvStability.value !== null && (
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-gray-100 border border-gray-300'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    HRV Stability
                  </h4>
                  <p className={`text-2xl font-bold mb-1 ${
                    summary.hrvStability.value !== null && summary.hrvStability.value < 15 
                      ? 'text-green-600' 
                      : summary.hrvStability.value !== null && summary.hrvStability.value < 25 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                  }`}>
                    {summary.hrvStability.value?.toFixed(1)}% CV
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    (lower = steadier)
                  </p>
                </div>
                <div className={`text-xs px-3 py-1 rounded-full ${
                  summary.hrvStability.value !== null && summary.hrvStability.value < 15
                    ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'
                    : summary.hrvStability.value !== null && summary.hrvStability.value < 25
                      ? darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                      : darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'
                }`}>
                  {summary.hrvStability.value !== null && summary.hrvStability.value < 15 
                    ? 'Excellent' 
                    : summary.hrvStability.value !== null && summary.hrvStability.value < 25 
                      ? 'Good' 
                      : 'Variable'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Performance Metrics Section */}
        <div className="mb-6">
          <h3 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
            Performance Metrics
          </h3>
          
          {/* Enhanced Key Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <EnhancedMetricCard
              label="Session Stress Index"
              value={summary.sessionStressIndex.value}
              unit=""
              darkMode={darkMode}
              indicator={getStressIndexIndicator(summary.sessionStressIndex.value, darkMode)}
            />
            <EnhancedMetricCard
              label="Restoration Index"
              value={summary.restorationIndex.value}
              unit="/100"
              darkMode={darkMode}
              indicator={getRestorationIndexIndicator(summary.restorationIndex.value, darkMode)}
            />
          </div>

          {/* Supporting Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              label="Time to Stabilize"
              value={summary.timeToStabilize.value}
              unit="sec"
              darkMode={darkMode}
            />
            <MetricCard
              label="Respiratory Coherence"
              value={summary.respCoherence.value}
              unit="/100"
              darkMode={darkMode}
            />
          </div>
        </div>

        {/* RR Interval Visualization */}
        {summary.rrIntervals && summary.rrIntervals.length > 0 && (
          <div className="mb-6">
            <h3 className={`text-xl font-semibold mb-4 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Heart Rhythm Analysis
            </h3>
            <RRVisualization 
              rrIntervals={summary.rrIntervals} 
              darkMode={darkMode}
            />
          </div>
        )}

        {/* Data Storage Status */}
        <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div>
              <p className={`font-semibold ${darkMode ? 'text-green-300' : 'text-green-800'}`}>Session Saved Successfully</p>
              <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'}`}>Raw data and metrics stored securely</p>
            </div>
          </div>
        </div>

        {/* Guest Login Prompt */}
        {isGuest && (
          <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <p className={`font-semibold mb-2 ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  Create an Account for Full Features
                </p>
                <p className={`text-sm mb-3 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  Log in to save your session history, track progress over time, and access advanced analytics.
                </p>
                <button
                  onClick={onGuestLogin}
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all transform hover:scale-105"
                >
                  Create Account / Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onReset}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all transform hover:scale-105"
          >
            Start New Session
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default SessionSummaryModal;
