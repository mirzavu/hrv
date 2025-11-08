import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface EndSessionConfirmationModalProps {
  elapsedTime: number;
  onConfirm: () => void;
  onCancel: () => void;
  darkMode?: boolean;
}

const EndSessionConfirmationModal: React.FC<EndSessionConfirmationModalProps> = ({
  elapsedTime,
  onConfirm,
  onCancel,
  darkMode = false,
}) => {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  let message = '';
  let title = 'End Session?';
  let showWarning = false;

  if (elapsedTime < 120) {
    // Less than 2 minutes
    title = 'Session Too Short';
    message = 'This session is too short to be valid. Sessions must be at least 2 minutes for reliable HRV assessment.';
    showWarning = true;
  } else if (elapsedTime < 180) {
    // Less than 3 minutes
    title = 'Short Session';
    message = '5 minutes is recommended for better accuracy. Are you sure you want to end now?';
    showWarning = true;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-6 rounded-xl shadow-2xl w-full max-w-md mx-4`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {showWarning && (
              <AlertTriangle className={`w-6 h-6 ${elapsedTime < 120 ? 'text-red-500' : 'text-yellow-500'}`} />
            )}
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
            Session duration: <span className="font-semibold">{timeString}</span>
          </p>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {message}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
              darkMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
              elapsedTime < 120
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndSessionConfirmationModal;



