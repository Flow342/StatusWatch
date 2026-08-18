/** Shared display helpers, so numbers and dates look the same everywhere. */

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  // 100% and 0% read better without decimals; everything else keeps two.
  if (value === 100 || value === 0) return `${value}%`;
  return `${value.toFixed(2)}%`;
}

export function formatMs(value) {
  if (value === null || value === undefined) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value) {
  if (!value) return 'never';
  const deltaSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (deltaSeconds < 10) return 'just now';
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

export function formatInterval(seconds) {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** Tailwind classes per status, kept in one place so the palette stays consistent. */
export const STATUS_STYLES = {
  up: { dot: 'bg-up', text: 'text-up', ring: 'ring-up/30', label: 'Operational' },
  down: { dot: 'bg-down', text: 'text-down', ring: 'ring-down/30', label: 'Down' },
  degraded: { dot: 'bg-degraded', text: 'text-degraded', ring: 'ring-degraded/30', label: 'Degraded' },
  unknown: { dot: 'bg-unknown', text: 'text-ink-faint', ring: 'ring-line', label: 'No data' },
};

export function statusStyle(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.unknown;
}
