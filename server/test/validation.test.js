import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERVAL_SECONDS,
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  parseId,
  validateServicePayload,
} from '../src/lib/validation.js';

/**
 * Runs `fn`, asserts it threw, and returns the error.
 * node:assert's throws() returns undefined, so it cannot check the error's own
 * fields — and `status` / `details` are exactly what the validation contract is.
 */
function captureError(fn, message = 'expected the call to throw') {
  try {
    fn();
  } catch (err) {
    return err;
  }
  assert.fail(message);
}


test('validateServicePayload — accepts a complete payload and trims the name', () => {
  const result = validateServicePayload({
    name: '  Marketing site  ',
    url: 'https://example.com/health',
    interval_seconds: 60,
  });

  assert.equal(result.name, 'Marketing site');
  assert.equal(result.interval_seconds, 60);
  assert.equal(result.url, 'https://example.com/health');
});

test('validateServicePayload — applies the default interval when omitted', () => {
  const result = validateServicePayload({ name: 'Site', url: 'https://example.com' });
  assert.equal(result.interval_seconds, DEFAULT_INTERVAL_SECONDS);
});

test('validateServicePayload — normalises the URL through the URL parser', () => {
  // No path given, so the parser appends the root — worth pinning, because callers
  // compare stored URLs and a silent change here would break de-duplication.
  const result = validateServicePayload({ name: 'Site', url: 'https://example.com' });
  assert.equal(result.url, 'https://example.com/');
});

test('validateServicePayload — reports every invalid field at once', () => {
  const error = captureError(() =>
    validateServicePayload({ name: '   ', url: 'ftp://files.example.com', interval_seconds: 5 }),
  );

  assert.equal(error.status, 400);
  assert.equal(error.message, 'Validation failed');
  assert.deepEqual(Object.keys(error.details).sort(), ['interval_seconds', 'name', 'url']);
  assert.match(error.details.url, /http/);
});

test('validateServicePayload — rejects a non-absolute URL', () => {
  const error = captureError(() => validateServicePayload({ name: 'Site', url: '/health' }));
  assert.equal(error.details.url, 'URL must be a valid absolute URL');
});

test('validateServicePayload — rejects a name longer than 100 characters', () => {
  const error = captureError(() =>
    validateServicePayload({ name: 'a'.repeat(101), url: 'https://example.com' }),
  );
  assert.match(error.details.name, /100/);
});

test('validateServicePayload — enforces the interval bounds', () => {
  for (const interval of [MIN_INTERVAL_SECONDS - 1, MAX_INTERVAL_SECONDS + 1, 1.5, 'soon']) {
    const error = captureError(
      () => validateServicePayload({ name: 'Site', url: 'https://example.com', interval_seconds: interval }),
      `interval ${interval} should be rejected`,
    );
    assert.ok(error.details.interval_seconds);
  }

  for (const interval of [MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS]) {
    const result = validateServicePayload({
      name: 'Site',
      url: 'https://example.com',
      interval_seconds: interval,
    });
    assert.equal(result.interval_seconds, interval, `interval ${interval} should be accepted`);
  }
});

test('validateServicePayload — accepts an interval sent as a numeric string', () => {
  const result = validateServicePayload({ name: 'Site', url: 'https://example.com', interval_seconds: '120' });
  assert.equal(result.interval_seconds, 120);
});

test('validateServicePayload — partial mode validates only the keys present', () => {
  const result = validateServicePayload({ name: 'Renamed' }, { partial: true });
  assert.deepEqual(result, { name: 'Renamed' });
});

test('validateServicePayload — partial mode rejects an empty patch', () => {
  const error = captureError(() => validateServicePayload({}, { partial: true }));
  assert.equal(error.status, 400);
  assert.equal(error.message, 'No updatable fields provided');
});

test('validateServicePayload — partial mode still validates a present field', () => {
  const error = captureError(() => validateServicePayload({ url: 'nope' }, { partial: true }));
  assert.ok(error.details.url);
});

test('validateServicePayload — rejects a non-object body', () => {
  for (const body of [null, 'string', 42]) {
    const error = captureError(() => validateServicePayload(body));
    assert.equal(error.status, 400);
  }
});

test('parseId — accepts positive integers and rejects everything else', () => {
  assert.equal(parseId('7'), 7);
  assert.equal(parseId(7), 7);

  for (const value of ['0', '-1', 'abc', '', undefined, null]) {
    const error = captureError(() => parseId(value), `${value} should be rejected`);
    assert.equal(error.status, 400);
  }
});

test('parseId — uses the supplied label in its message', () => {
  const error = captureError(() => parseId('abc', 'limit'));
  assert.equal(error.message, 'Invalid limit');
});
