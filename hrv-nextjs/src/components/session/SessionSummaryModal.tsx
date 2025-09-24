import React from 'react';
import { HrvSummary } from '@/types';

interface SessionSummaryModalProps {
  summary: HrvSummary;
  darkMode: boolean;
  onReset: () => void;
  isGuest: boolean;
  onGuestLogin: () => void;
  onClose: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ 
  summary, 
  darkMode, 
  onReset, 
  isGuest, 
  onGuestLogin, 
  onClose 
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-6 rounded-xl shadow-2xl w-full max-w-md mx-4 relative`}>
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-3 right-3 p-2 rounded-full transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <h2 className="text-2xl font-bold text-center mb-4">Session Summary</h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {Object.entries(summary).map(([key, item]) => (
          <div key={key} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="text-xl font-semibold">{typeof item.value === 'number' ? item.value.toFixed(2) : 'N/A'} <span className="text-xs">{item.unit}</span></p>
          </div>
        ))}
      </div>

      {isGuest && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 mb-2">💡 Log in to save your session data permanently!</p>
          <button
            onClick={onGuestLogin}
            className="w-full px-3 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-transform transform hover:scale-105"
          >
            Login to Save Data
          </button>
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-105"
      >
        Start New Session
      </button>
    </div>
  </div>
);

export default SessionSummaryModal;
