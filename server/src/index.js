import config from './config.js';
import { createApp } from './app.js';
import pool from './db/pool.js';
import { startScheduler, stopScheduler } from './lib/scheduler.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`[server] StatusWatch API listening on http://${config.host}:${config.port}`);
  console.log(`[server] environment: ${config.env}`);
  startScheduler();
});

/** Drain in-flight requests, stop the cron job, then close the pool. */
async function shutdown(signal) {
  console.log(`[server] ${signal} received — shutting down`);

  const forceExit = setTimeout(() => {
    console.error('[server] forced exit after 10s');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async () => {
    try {
      await stopScheduler();
      await pool.end();
      console.log('[server] shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[server] shutdown error:', err.message);
      process.exit(1);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
