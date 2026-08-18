import { Link } from 'react-router-dom';
import { StatusDot } from './StatusBadge.jsx';
import Sparkline from './Sparkline.jsx';
import { formatInterval, formatMs, formatPercent, formatRelative, statusStyle } from '../lib/format.js';

function UptimeCell({ label, value }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="tnum text-sm text-ink">{formatPercent(value)}</div>
    </div>
  );
}

/** One row on the dashboard. Admin-only controls appear when `isAdmin` is set. */
export function ServiceCard({ service, isAdmin, onEdit, onDelete, onCheckNow, busy }) {
  const style = statusStyle(service.current_status);

  return (
    <div className="card p-4 transition-colors hover:border-line/80 hover:bg-surface-hover/40">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <StatusDot status={service.current_status} size="lg" pulse />
          <div className="min-w-0">
            <Link
              to={`/services/${service.id}`}
              className="block truncate font-medium text-ink hover:text-up"
            >
              {service.name}
            </Link>
            <div className="truncate text-xs text-ink-faint">{service.url}</div>
          </div>
        </div>

        <div className={`hidden w-28 shrink-0 lg:block ${style.text}`}>
          <Sparkline points={service.sparkline} width={112} height={30} />
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <UptimeCell label="24h" value={service.uptime['24h']} />
          <UptimeCell label="7d" value={service.uptime['7d']} />
          <UptimeCell label="30d" value={service.uptime['30d']} />
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-wide text-ink-faint">Avg</div>
            <div className="tnum text-sm text-ink">
              {formatMs(service.avg_response_time_ms['24h'])}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs text-ink-faint">
        <span>
          Checked every {formatInterval(service.interval_seconds)} · last check{' '}
          {formatRelative(service.last_check?.checked_at)}
          {service.last_check?.http_code ? ` · HTTP ${service.last_check.http_code}` : ''}
        </span>

        {isAdmin && (
          <span className="flex items-center gap-3">
            <button
              type="button"
              className="text-ink-muted transition-colors hover:text-up disabled:opacity-50"
              onClick={() => onCheckNow(service)}
              disabled={busy}
            >
              {busy ? 'Checking…' : 'Check now'}
            </button>
            <button
              type="button"
              className="text-ink-muted transition-colors hover:text-ink"
              onClick={() => onEdit(service)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-ink-muted transition-colors hover:text-down"
              onClick={() => onDelete(service)}
            >
              Delete
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export default ServiceCard;
