export const formatDuration = (totalSeconds: number | null | undefined): string => {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }

  const roundedSeconds = Math.round(totalSeconds);

  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }

  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;

  const paddedMinutes = hours > 0 ? minutes.toString().padStart(2, '0') : minutes.toString();
  const paddedSeconds = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
};
