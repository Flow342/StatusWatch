import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import useApiResource from '../lib/useApiResource.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import ResponseTimeChart from '../components/ResponseTimeChart.jsx';
import UptimeTimeline from '../components/UptimeTimeline.jsx';
import {
  formatDateTime,
  formatDuration,
  formatInterval,
  formatMs,
  formatPercent,
  formatRelative,
} from '../lib/format.js';

const REFRESH_MS = 30000;

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}

function IncidentTable({ incidents }) {
  if (incidents.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink-muted">
        No incidents recorded in the last 30 days.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-canvas/40 text-left text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Failed checks</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Resolved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {incidents.map((incident) => (
            <tr key={incident.started_at} className={incident.ongoing ? 'bg-down/5' : undefined}>
              <td className="tnum px-4 py-3 text-ink">{formatDateTime(incident.started_at)}</td>
              <td className="tnum px-4 py-3 text-ink-muted">
                {formatDuration(incident.duration_seconds)}
              </td>
              <td className="tnum px-4 py-3 text-ink-muted">{incident.failed_checks}</td>
              <td className="px-4 py-3 text-ink-muted">
                {incident.http_codes
                  .map((code) => (code === 'connection_error' ? 'connection error' : `HTTP ${code}`))
                  .join(', ')}
              </td>
              <td className="px-4 py-3">
                {incident.ongoing ? (
                  <span className="text-down">Ongoing</span>
                ) : (
                  <span className="tnum text-ink-muted">{formatDateTime(incident.resolved_at)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServiceDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  // One loader keeps the three requests in sync with a single refresh cycle.
  const loader = useCallback(
    async (signal) => {
      const [service, stats, incidents] = await Promise.all([
        api.getService(id, signal),
        api.getStats(id, signal),
        api.getIncidents(id, 30, signal),
      ]);
      // Pick fields explicitly: /stats also returns a bare `service` row, which would
      // otherwise clobber the richer summary (current_status, last_check) from /services/:id.
      return {
        service: service.service,
        uptime: stats.uptime,
        timeline: stats.timeline_24h,
        incidents: incidents.incidents,
      };
    },
    [id],
  );

  const { data, error, loading, refresh } = useApiResource(loader, { intervalMs: REFRESH_MS });

  async function handleCheckNow() {
    setBusy(true);
    try {
      await api.checkNow(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-ink-muted">Loading service…</div>;
  }

  if (error && !data) {
    return (
      <div className="card border-down/40 p-6 text-sm text-down">
        {error.message}
        <Link to="/" className="btn-secondary ml-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { service, uptime, timeline, incidents } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-ink-muted transition-colors hover:text-ink">
          ← All services
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
              <StatusBadge status={service.current_status} />
            </div>
            <a
              href={service.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 block break-all text-sm text-ink-muted transition-colors hover:text-up"
            >
              {service.url}
            </a>
            <p className="mt-1 text-xs text-ink-faint">
              Checked every {formatInterval(service.interval_seconds)} · last check{' '}
              {formatRelative(service.last_check?.checked_at)}
              {service.last_check?.http_code ? ` · HTTP ${service.last_check.http_code}` : ''}
            </p>
          </div>

          {isAdmin && (
            <button type="button" className="btn-secondary" onClick={handleCheckNow} disabled={busy}>
              {busy ? 'Checking…' : 'Check now'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Uptime 24h"
          value={formatPercent(uptime['24h'].uptime_percent)}
          sub={`${uptime['24h'].total_checks} checks`}
        />
        <StatCard
          label="Uptime 7d"
          value={formatPercent(uptime['7d'].uptime_percent)}
          sub={`${uptime['7d'].down_checks} failed`}
        />
        <StatCard
          label="Uptime 30d"
          value={formatPercent(uptime['30d'].uptime_percent)}
          sub={`${uptime['30d'].down_checks} failed`}
        />
        <StatCard
          label="Avg response 24h"
          value={formatMs(uptime['24h'].avg_response_time_ms)}
          sub={`30d avg ${formatMs(uptime['30d'].avg_response_time_ms)}`}
        />
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-muted">
          Last 24 hours
        </h2>
        <div className="mt-4">
          <UptimeTimeline buckets={timeline} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-muted">
          Response time (hourly average, ms)
        </h2>
        <div className="mt-4">
          <ResponseTimeChart buckets={timeline} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">
          Incident history (30 days)
        </h2>
        <IncidentTable incidents={incidents} />
      </section>
    </div>
  );
}

export default ServiceDetail;
