import { formatPercent, statusStyle } from '../lib/format.js';

/**
 * The classic status-page bar strip: one bar per hour for the last 24 hours,
 * coloured by whether every check in that hour passed.
 */
export function UptimeTimeline({ buckets = [], compact = false }) {
  if (buckets.length === 0) {
    return <div className="text-xs text-ink-faint">No history yet.</div>;
  }

  return (
    <div>
      <div className={`flex items-end gap-[3px] ${compact ? 'h-6' : 'h-10'}`}>
        {buckets.map((bucket) => {
          const style = statusStyle(bucket.status);
          const hour = new Date(bucket.bucket).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          });
          const summary =
            bucket.total_checks === 0
              ? 'no checks'
              : `${bucket.up_checks}/${bucket.total_checks} checks up (${formatPercent(bucket.uptime_percent)})`;

          return (
            <div
              key={bucket.bucket}
              title={`${hour} — ${summary}`}
              className={`h-full flex-1 rounded-sm transition-opacity hover:opacity-70 ${style.dot} ${
                bucket.status === 'unknown' ? 'opacity-30' : ''
              }`}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
          <span>24 hours ago</span>
          <span>now</span>
        </div>
      )}
    </div>
  );
}

export default UptimeTimeline;
