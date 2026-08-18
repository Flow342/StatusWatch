import { useEffect, useState } from 'react';
import api from '../lib/api.js';

const INTERVAL_OPTIONS = [
  { value: 30, label: 'Every 30 seconds' },
  { value: 60, label: 'Every minute' },
  { value: 120, label: 'Every 2 minutes' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 600, label: 'Every 10 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
];

/** Create/edit dialog for a monitored service. `service` present means edit. */
export function ServiceFormModal({ service, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: service?.name ?? '',
    url: service?.url ?? '',
    interval_seconds: service?.interval_seconds ?? 300,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const update = (field) => (event) => {
    const value = field === 'interval_seconds' ? Number(event.target.value) : event.target.value;
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const saved = service
        ? await api.updateService(service.id, form)
        : await api.createService(form);
      onSaved(saved.service);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-md p-6" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold">{service ? 'Edit service' : 'Add service'}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          StatusWatch sends a GET request and records the result on every check.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="service-name">
              Name
            </label>
            <input
              id="service-name"
              className="input"
              value={form.name}
              onChange={update('name')}
              placeholder="Marketing site"
              autoFocus
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-down">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className="label" htmlFor="service-url">
              URL
            </label>
            <input
              id="service-url"
              className="input"
              value={form.url}
              onChange={update('url')}
              placeholder="https://example.com/health"
            />
            {fieldErrors.url && <p className="mt-1 text-xs text-down">{fieldErrors.url}</p>}
          </div>

          <div>
            <label className="label" htmlFor="service-interval">
              Check interval
            </label>
            <select
              id="service-interval"
              className="input"
              value={form.interval_seconds}
              onChange={update('interval_seconds')}
            >
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.interval_seconds && (
              <p className="mt-1 text-xs text-down">{fieldErrors.interval_seconds}</p>
            )}
          </div>

          {error && !Object.keys(fieldErrors).length && (
            <p className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : service ? 'Save changes' : 'Add service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ServiceFormModal;
