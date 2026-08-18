import pg from 'pg';
import config from '../config.js';

const { Pool, types } = pg;

// Return NUMERIC (used by AVG/percentage aggregates) as JS numbers instead of strings.
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
// Same for BIGINT results produced by COUNT(*).
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)));

const pool = new Pool(
  config.db.connectionString
    ? {
        connectionString: config.db.connectionString,
        ssl: config.db.ssl,
        max: config.db.maxPoolSize,
      }
    : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        ssl: config.db.ssl,
        max: config.db.maxPoolSize,
      },
);

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export default pool;
