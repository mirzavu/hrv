/**
 * Utility functions for session metric indicators with color bands, labels, and micro-advice
 */

export interface MetricIndicator {
  color: 'green' | 'amber' | 'red';
  label: string;
  icon: string;
  message: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

/**
 * Get stress index indicator based on value
 * Formula: (AMo50 / MxDMn) * 100 - lower is better
 */
export const getStressIndexIndicator = (value: number | null, darkMode: boolean): MetricIndicator | null => {
  if (value === null) return null;

  if (value <= 25) {
    return {
      color: 'green',
      label: 'Calm ✅',
      icon: '✅',
      message: 'Nicely relaxed — recovery-friendly.',
      bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-50',
      textColor: darkMode ? 'text-green-300' : 'text-green-800',
      borderColor: darkMode ? 'border-green-700' : 'border-green-200'
    };
  } else if (value <= 50) {
    return {
      color: 'amber',
      label: 'Moderate Load ⚠️',
      icon: '⚠️',
      message: 'Some load — consider a breath session.',
      bgColor: darkMode ? 'bg-yellow-900/30' : 'bg-yellow-50',
      textColor: darkMode ? 'text-yellow-300' : 'text-yellow-800',
      borderColor: darkMode ? 'border-yellow-700' : 'border-yellow-200'
    };
  } else {
    return {
      color: 'red',
      label: 'High Stress Load 🔥',
      icon: '🔥',
      message: 'High autonomic load — slow breathing or rest recommended.',
      bgColor: darkMode ? 'bg-red-900/30' : 'bg-red-50',
      textColor: darkMode ? 'text-red-300' : 'text-red-800',
      borderColor: darkMode ? 'border-red-700' : 'border-red-200'
    };
  }
};

/**
 * Get restoration index indicator based on value
 * Scale: 0-100 - higher is better
 */
export const getRestorationIndexIndicator = (value: number | null, darkMode: boolean): MetricIndicator | null => {
  if (value === null) return null;

  if (value >= 70) {
    return {
      color: 'green',
      label: 'Restored 🌿',
      icon: '🌿',
      message: 'Great session — your body recovered well.',
      bgColor: darkMode ? 'bg-green-900/30' : 'bg-green-50',
      textColor: darkMode ? 'text-green-300' : 'text-green-800',
      borderColor: darkMode ? 'border-green-700' : 'border-green-200'
    };
  } else if (value >= 40) {
    return {
      color: 'amber',
      label: 'Working On It ⚡',
      icon: '⚡',
      message: 'Decent progress — repeat sessions or longer breathing.',
      bgColor: darkMode ? 'bg-yellow-900/30' : 'bg-yellow-50',
      textColor: darkMode ? 'text-yellow-300' : 'text-yellow-800',
      borderColor: darkMode ? 'border-yellow-700' : 'border-yellow-200'
    };
  } else {
    return {
      color: 'red',
      label: 'Needs Attention 🛑',
      icon: '🛑',
      message: 'Low restoration — try a guided 10-min breathing + gentle walk.',
      bgColor: darkMode ? 'bg-red-900/30' : 'bg-red-50',
      textColor: darkMode ? 'text-red-300' : 'text-red-800',
      borderColor: darkMode ? 'border-red-700' : 'border-red-200'
    };
  }
};

/**
 * Get trend arrow based on change from previous session
 * TODO: Implement when we have historical data comparison
 */
export const getTrendArrow = (currentValue: number | null, previousValue: number | null): string => {
  if (currentValue === null || previousValue === null) return '';
  
  const change = currentValue - previousValue;
  if (Math.abs(change) < 0.1) return '→'; // Stable
  return change > 0 ? '▲' : '▼';
};