/**
 * Format duration in seconds to mm:ss format
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Format RMSSD delta with appropriate sign and color indication
 */
export const formatRmssdDelta = (delta: number | null): { value: string; isPositive: boolean } => {
  if (delta === null) return { value: 'N/A', isPositive: false };
  
  const formatted = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
  return { value: formatted, isPositive: delta >= 0 };
};

/**
 * Format percentage with one decimal place
 */
export const formatPercentage = (value: number | null): string => {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
};

/**
 * Format score (0-100 scale) with one decimal place
 */
export const formatScore = (value: number | null): string => {
  if (value === null) return 'N/A';
  return value.toFixed(1);
};
