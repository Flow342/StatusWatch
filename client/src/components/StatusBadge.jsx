import { statusStyle } from '../lib/format.js';

/** Coloured dot; `pulse` adds a halo so a live "down" state draws the eye. */
export function StatusDot({ status, size = 'md', pulse = false }) {
  const style = statusStyle(status);
  const sizes = { sm: 'h-2 w-2', md: 'h-2.5 w-2.5', lg: 'h-3.5 w-3.5' };

  return (
    <span className="relative inline-flex shrink-0" title={style.label}>
      {pulse && status === 'down' && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-60`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${sizes[size]} ${style.dot}`} />
    </span>
  );
}

export function StatusBadge({ status }) {
  const style = statusStyle(status);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium
                  ring-1 ring-inset ${style.ring} ${style.text}`}
    >
      <StatusDot status={status} size="sm" pulse />
      {style.label}
    </span>
  );
}

export default StatusBadge;
