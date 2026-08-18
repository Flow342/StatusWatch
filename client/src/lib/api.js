/**
 * Thin fetch wrapper around the StatusWatch API.
 *
 * In development VITE_API_BASE_URL is unset and requests go to the same origin ("/api"),
 * which Vite proxies to the API server. In a deployed build it points at the API's URL.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const TOKEN_KEY = 'statuswatch.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, auth = false, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the StatusWatch API. Is the server running?');
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or revoked token should drop us back to the login screen.
    if (response.status === 401 && auth) setToken(null);
    throw new ApiError(
      response.status,
      payload?.error?.message || `Request failed with status ${response.status}`,
      payload?.error?.details,
    );
  }

  return payload;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),

  me: () => request('/auth/me', { auth: true }),

  listServices: (signal) => request('/services', { signal }),

  getService: (id, signal) => request(`/services/${id}`, { signal }),

  getStats: (id, signal) => request(`/services/${id}/stats`, { signal }),

  getIncidents: (id, days = 30, signal) =>
    request(`/services/${id}/incidents?days=${days}`, { signal }),

  getChecks: (id, limit = 100, signal) => request(`/services/${id}/checks?limit=${limit}`, { signal }),

  createService: (payload) => request('/services', { method: 'POST', body: payload, auth: true }),

  updateService: (id, payload) =>
    request(`/services/${id}`, { method: 'PATCH', body: payload, auth: true }),

  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE', auth: true }),

  checkNow: (id) => request(`/services/${id}/check`, { method: 'POST', auth: true }),
};

export default api;
