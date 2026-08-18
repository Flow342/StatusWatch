/**
 * Turns a node-postgres failure into something actionable.
 *
 * Node throws an AggregateError with an EMPTY message when a host like "localhost"
 * resolves to both ::1 and 127.0.0.1 and every address refuses the connection — so
 * printing only `err.message` shows nothing at all. Unwrap those, and map the common
 * Postgres SQLSTATE codes to the fix they actually need.
 */

const HINTS = {
  ECONNREFUSED:
    'Nothing is listening on that host/port — PostgreSQL is not running.\n' +
    '  Check with:  pg_isready -h $PGHOST -p $PGPORT\n' +
    '  Homebrew:    brew services start postgresql@17',
  ENOTFOUND: 'The database host could not be resolved — check PGHOST in server/.env.',
  ETIMEDOUT:
    'The connection timed out — check PGHOST/PGPORT and any firewall or security group.',
  // Postgres SQLSTATE codes
  '3D000': 'That database does not exist. Create it with:  createdb "$PGDATABASE"',
  '28P01': 'Password authentication failed — check PGUSER / PGPASSWORD in server/.env.',
  '28000': 'That role does not exist, or is not allowed to connect. Check PGUSER in server/.env.',
  '42501': 'The role lacks privileges on the database. Grant them, or use a superuser role.',
};

export function describeDbError(err) {
  const lines = [];

  // AggregateError: the real causes live in .errors, and .message is empty.
  const causes = Array.isArray(err.errors) ? err.errors : [];
  const primary = err.message || causes[0]?.message || err.code || String(err);

  lines.push(primary);
  for (const cause of causes) {
    lines.push(`  · ${cause.message}`);
  }

  const hint = HINTS[err.code] ?? HINTS[causes[0]?.code];
  if (hint) lines.push(`\n${hint}`);

  return lines.join('\n');
}

/** Reports a fatal startup/script DB failure and exits non-zero. */
export function reportFatalDbError(scope, err) {
  console.error(`[${scope}] failed: ${describeDbError(err)}`);
  if (process.env.DEBUG) console.error(err);
}

export default describeDbError;
