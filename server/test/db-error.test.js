import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDbError } from '../src/lib/db-error.js';

test('describeDbError — unwraps an AggregateError whose own message is empty', () => {
  // This is the real shape Node produces when "localhost" resolves to both ::1 and
  // 127.0.0.1 and both refuse: err.message is '' and the causes live in err.errors.
  const err = new AggregateError(
    [
      Object.assign(new Error('connect ECONNREFUSED ::1:5432'), { code: 'ECONNREFUSED' }),
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }),
    ],
    '',
  );
  err.code = 'ECONNREFUSED';

  const output = describeDbError(err);

  assert.notEqual(output.trim(), '', 'must never render an empty description');
  assert.match(output, /::1:5432/);
  assert.match(output, /127\.0\.0\.1:5432/);
  assert.match(output, /PostgreSQL is not running/);
});

test('describeDbError — derives the hint from the first cause when the outer code is missing', () => {
  const err = new AggregateError(
    [Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })],
    '',
  );

  assert.match(describeDbError(err), /PostgreSQL is not running/);
});

test('describeDbError — maps Postgres SQLSTATE codes to actionable hints', () => {
  const cases = [
    ['3D000', /createdb/],
    ['28P01', /PGUSER \/ PGPASSWORD/],
    ['28000', /role does not exist/],
    ['42501', /privileges/],
  ];

  for (const [code, expected] of cases) {
    const err = Object.assign(new Error(`failure ${code}`), { code });
    assert.match(describeDbError(err), expected, `code ${code}`);
  }
});

test('describeDbError — passes a plain error through unchanged', () => {
  const output = describeDbError(new Error('something specific went wrong'));
  assert.match(output, /something specific went wrong/);
});

test('describeDbError — still produces text when there is no message at all', () => {
  const err = Object.assign(new Error(''), { code: 'ETIMEDOUT' });
  const output = describeDbError(err);

  assert.match(output, /ETIMEDOUT/);
  assert.match(output, /timed out/);
});
