import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pool from './pool.js';
import { reportFatalDbError } from '../lib/db-error.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

async function migrate() {
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('[migrate] schema applied');
}

migrate()
  .then(() => pool.end())
  .catch(async (err) => {
    reportFatalDbError('migrate', err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
