import { useCallback, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import useApiResource from '../lib/useApiResource.js';
import ServiceCard from '../components/ServiceCard.jsx';
import ServiceFormModal from '../components/ServiceFormModal.jsx';
import { formatPercent } from '../lib/format.js';

const REFRESH_MS = 30000;

/** Headline banner summarising every monitored service. */
function OverallStatus({ services }) {
  const down = services.filter((service) => service.current_status === 'down');
  const unknown = services.filter((service) => service.current_status === 'unknown');

  let tone = 'border-up/30 bg-up/10 text-up';
  let message = 'All systems operational';

  if (down.length > 0) {
    tone = 'border-down/30 bg-down/10 text-down';
    message = `${down.length} of ${services.length} services down`;
  } else if (services.length === 0) {
    tone = 'border-line bg-surface text-ink-muted';
    message = 'No services monitored yet';
  } else if (unknown.length === services.length) {
    tone = 'border-line bg-surface text-ink-muted';
    message = 'Waiting for the first checks to run';
  }

  const averageUptime = useMemo(() => {
    const values = services
      .map((service) => service.uptime['24h'])
      .filter((value) => typeof value === 'number');
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [services]);

  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 border p-5 ${tone}`}>
      <div>
        <h1 className="text-xl font-semibold">{message}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {services.length} {services.length === 1 ? 'service' : 'services'} monitored
          {averageUptime !== null && ` · ${formatPercent(averageUptime)} average uptime (24h)`}
        </p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(null); // { service } | { service: null } for "new"
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loader = useCallback((signal) => api.listServices(signal), []);
  const { data, error, loading, refresh } = useApiResource(loader, { intervalMs: REFRESH_MS });

  const services = data?.services ?? [];

  async function handleDelete(service) {
    if (!window.confirm(`Delete "${service.name}" and all of its check history?`)) return;
    setActionError(null);
    try {
      await api.deleteService(service.id);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleCheckNow(service) {
    setBusyId(service.id);
    setActionError(null);
    try {
      await api.checkNow(service.id);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-ink-muted">Loading services…</div>;
  }

  if (error && services.length === 0) {
    return (
      <div className="card border-down/40 p-6 text-sm text-down">
        {error.message}
        <button type="button" className="btn-secondary ml-4" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OverallStatus services={services} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink-muted">Services</h2>
        {isAdmin && (
          <button type="button" className="btn-primary" onClick={() => setEditing({ service: null })}>
            Add service
          </button>
        )}
      </div>

      {actionError && (
        <p className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          {actionError}
        </p>
      )}

      {services.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-muted">Nothing is being monitored yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            {isAdmin
              ? 'Add a service above, or run `npm run seed` in the server directory.'
              : 'Sign in as admin to add the first service.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              isAdmin={isAdmin}
              busy={busyId === service.id}
              onEdit={(target) => setEditing({ service: target })}
              onDelete={handleDelete}
              onCheckNow={handleCheckNow}
            />
          ))}
        </div>
      )}

      {editing && (
        <ServiceFormModal
          service={editing.service}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
