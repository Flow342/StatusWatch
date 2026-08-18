import { ApiError } from './errors.js';

export const MIN_INTERVAL_SECONDS = 30;
export const MAX_INTERVAL_SECONDS = 86400;
export const DEFAULT_INTERVAL_SECONDS = 300;

function validateName(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.name = 'Name is required';
    return undefined;
  }
  if (value.trim().length > 100) {
    errors.name = 'Name must be 100 characters or fewer';
    return undefined;
  }
  return value.trim();
}

function validateUrl(value, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.url = 'URL is required';
    return undefined;
  }
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    errors.url = 'URL must be a valid absolute URL';
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    errors.url = 'URL must use http:// or https://';
    return undefined;
  }
  return parsed.toString();
}

function validateInterval(value, errors) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    errors.interval_seconds = 'Interval must be an integer number of seconds';
    return undefined;
  }
  if (parsed < MIN_INTERVAL_SECONDS || parsed > MAX_INTERVAL_SECONDS) {
    errors.interval_seconds = `Interval must be between ${MIN_INTERVAL_SECONDS} and ${MAX_INTERVAL_SECONDS} seconds`;
    return undefined;
  }
  return parsed;
}

/**
 * Validates a service payload.
 * @param {object} body raw request body
 * @param {{ partial?: boolean }} options `partial: true` for PATCH — only validate present keys
 */
export function validateServicePayload(body, { partial = false } = {}) {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const errors = {};
  const result = {};

  if (!partial || body.name !== undefined) {
    const name = validateName(body.name, errors);
    if (name !== undefined) result.name = name;
  }

  if (!partial || body.url !== undefined) {
    const url = validateUrl(body.url, errors);
    if (url !== undefined) result.url = url;
  }

  if (body.interval_seconds !== undefined) {
    const interval = validateInterval(body.interval_seconds, errors);
    if (interval !== undefined) result.interval_seconds = interval;
  } else if (!partial) {
    result.interval_seconds = DEFAULT_INTERVAL_SECONDS;
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }
  if (partial && Object.keys(result).length === 0) {
    throw new ApiError(400, 'No updatable fields provided');
  }

  return result;
}

/** Parses a positive-integer route/query parameter. */
export function parseId(value, label = 'id') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return parsed;
}
