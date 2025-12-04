export function formatDurationCompact(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  // Optional: include seconds if needed, but request asked for "2h 5m"
  if (hours === 0 && minutes === 0) return `${seconds}s`;
  
  return parts.join(' ');
}

export function getCurrentTimeStr(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}