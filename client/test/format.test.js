import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  formatInterval,
  formatMs,
  formatPercent,
  formatRelative,
  statusStyle,
} from '../src/lib/format.js';

test('formatPercent — renders 100 and 0 without decimals', () => {
  assert.equal(formatPercent(100), '100%');
  assert.equal(formatPercent(0), '0%');
});

test('formatPercent — keeps two decimals for partial values', () => {
  assert.equal(formatPercent(99.5), '99.50%');
  assert.equal(formatPercent(66.666), '66.67%');
});

test('formatPercent — shows a dash when there is no data', () => {
  // null means "no checks recorded", which must never render as 0%.
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(undefined), '—');
});

test('formatMs — renders milliseconds below one second', () => {
  assert.equal(formatMs(0), '0ms');
  assert.equal(formatMs(150), '150ms');
  assert.equal(formatMs(999), '999ms');
});

test('formatMs — switches to seconds at one second', () => {
  assert.equal(formatMs(1000), '1.00s');
  assert.equal(formatMs(2500), '2.50s');
});

test('formatMs — shows a dash when there is no data', () => {
  assert.equal(formatMs(null), '—');
});

test('formatDuration — scales from seconds up to days', () => {
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(60), '1m');
  assert.equal(formatDuration(90), '1m');
  assert.equal(formatDuration(3600), '1h 0m');
  assert.equal(formatDuration(3660), '1h 1m');
  assert.equal(formatDuration(86400), '1d 0h');
  assert.equal(formatDuration(90000), '1d 1h');
});

test('formatDuration — shows a dash when there is no value', () => {
  assert.equal(formatDuration(null), '—');
});

test('formatInterval — renders check intervals compactly', () => {
  assert.equal(formatInterval(30), '30s');
  assert.equal(formatInterval(60), '1m');
  assert.equal(formatInterval(300), '5m');
  assert.equal(formatInterval(3600), '1h');
  assert.equal(formatInterval(7200), '2h');
});

test('formatRelative — describes how long ago a check ran', () => {
  const secondsAgo = (n) => new Date(Date.now() - n * 1000).toISOString();

  assert.equal(formatRelative(secondsAgo(2)), 'just now');
  assert.equal(formatRelative(secondsAgo(30)), '30s ago');
  assert.equal(formatRelative(secondsAgo(120)), '2m ago');
  assert.equal(formatRelative(secondsAgo(7200)), '2h ago');
  assert.equal(formatRelative(secondsAgo(86400 * 3)), '3d ago');
});

test('formatRelative — says "never" when a service has no check yet', () => {
  assert.equal(formatRelative(null), 'never');
  assert.equal(formatRelative(undefined), 'never');
});

test('statusStyle — gives every status a colour and a label', () => {
  assert.equal(statusStyle('up').label, 'Operational');
  assert.equal(statusStyle('down').label, 'Down');
  assert.equal(statusStyle('degraded').label, 'Degraded');
  assert.equal(statusStyle('unknown').label, 'No data');
});

test('statusStyle — falls back to "unknown" for an unrecognised status', () => {
  // The API could grow a new status; the dashboard must not crash on it.
  assert.equal(statusStyle('something-new').label, 'No data');
  assert.equal(statusStyle(undefined).label, 'No data');
});
