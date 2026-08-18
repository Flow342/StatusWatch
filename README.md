# StatusWatch

A self-hosted status page and uptime monitor. A background scheduler pings each
monitored URL on its own interval, records the result in PostgreSQL, and a React
dashboard renders current status, uptime percentages, response-time charts and
incident history.

```
┌─────────────────┐         ┌──────────────────────────────┐         ┌──────────────┐
│  React (Vite)   │  HTTP   │   Express API (Node.js)      │   SQL   │  PostgreSQL  │
│  Tailwind CSS   │ ──────► │                              │ ──────► │              │
│                 │  JSON   │  ┌────────────────────────┐  │         │   services   │
│  · Dashboard    │ ◄────── │  │ node-cron scheduler    │  │         │   checks     │
│  · Service page │         │  │ probes due services    │──┼────────►│              │
│  · Login        │         │  └────────────────────────┘  │         └──────────────┘
└─────────────────┘         └──────────────┬───────────────┘
                                           │ GET requests
                                           ▼
                                  monitored websites / APIs
```

---

## Architecture

### Backend — `server/`

An Express 5 REST API plus an in-process scheduler. Both run in the same Node
process; `SCHEDULER_ENABLED=false` turns the scheduler off so you can later run the
API and the scheduler as separate workloads without changing code.

**How the scheduler works.** Rather than registering one cron task per service —
which would need rewiring every time a service is added, deleted or has its interval
changed — a single cron job fires every 30 seconds and asks the database which
services are *due*:

```sql
WHERE last.checked_at IS NULL
   OR last.checked_at <= NOW() - make_interval(secs => s.interval_seconds)
```

Each due service is probed with a plain `GET` (redirects followed, configurable
timeout), and the outcome is written to `checks`. A 2xx/3xx response is `up`;
anything else — including DNS failures, refused connections, TLS errors and timeouts,
where no HTTP status exists at all — is `down`. Probes run with bounded concurrency,
and an overrunning batch never overlaps the next tick.

**Uptime and incidents are derived, not stored.** `checks` is the single source of
truth. Uptime percentages are `COUNT(*) FILTER (WHERE status = 'up') / COUNT(*)` over a
time window; the 24-hour timeline is bucketed hourly and gap-filled with
`generate_series` so the chart keeps a continuous axis; incidents are unbroken runs of
`down` checks folded out of the check stream, so an incident stays "ongoing" until an
`up` check closes it. This keeps writes trivial and means fixing a stats bug never
requires a data migration.

**Auth.** One admin account, configured entirely through the environment — no users
table and no signup endpoint, by design. `POST /api/auth/login` returns a JWT that the
frontend stores and sends as a bearer token.

**Read/write split.** Reads are public (it is a status page); every mutation requires
the admin token.

| Layer | Location |
| --- | --- |
| Config from env | `server/src/config.js` |
| DB pool | `server/src/db/pool.js` |
| Schema / migration | `server/src/db/schema.sql`, `migrate.js` |
| Probe + scheduler | `server/src/lib/checker.js`, `scheduler.js` |
| Stats & incident queries | `server/src/lib/stats.js` |
| Routes | `server/src/routes/` |

### Frontend — `client/`

React 19 + Vite + Tailwind v4. Three routes: dashboard (`/`), service detail
(`/services/:id`), login (`/login`). Pages poll the API every 30 seconds; a refresh
never blanks the screen, and a failed background poll leaves the last good data
visible. Charts are hand-rolled inline SVG — no chart library.

In development the app calls a same-origin `/api`, which the Vite dev server proxies
to the API, so there is no CORS setup locally. In a deployed build,
`VITE_API_BASE_URL` points at the API's public URL.

### Database

```sql
services (id, name, url, interval_seconds, created_at)
checks   (id, service_id, status, http_code, response_time_ms, checked_at)
```

`checks.service_id` cascades on delete, and `(service_id, checked_at DESC)` is indexed —
every read path filters by service and orders by time.

---

## Running locally

Prerequisites: **Node.js ≥ 20** and a local **PostgreSQL** instance. No Docker.

### 1. Install PostgreSQL and create the database

If `psql` is not on your PATH yet, install and start it (macOS / Homebrew):

```bash
brew install postgresql@17 && brew services start postgresql@17
```

Homebrew's keg-only formula isn't linked automatically — add it to your PATH:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Verify the server is accepting connections, then create the database:

```bash
pg_isready -h localhost -p 5432
createdb statuswatch
```

Then create a role for the app (adjust the password):

```bash
psql -d statuswatch -c "CREATE ROLE statuswatch WITH LOGIN PASSWORD 'statuswatch'; GRANT ALL ON DATABASE statuswatch TO statuswatch; GRANT ALL ON SCHEMA public TO statuswatch;"
```

If you'd rather use your own superuser account, just point `PGUSER` at it instead.

### 2. Configure and start the API

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env`: set `PGUSER` / `PGPASSWORD` to match step 1, and generate a real
JWT secret:

```bash
openssl rand -hex 32
```

Set an admin password. Preferred — store only a bcrypt hash:

```bash
npm run hash-password -- 'your-admin-password'
```

Put the output in `ADMIN_PASSWORD_HASH` and delete the `ADMIN_PASSWORD` line. (For a
quick local start you can instead leave `ADMIN_PASSWORD` set in plaintext; the app
falls back to it only when no hash is configured.)

Create the tables and load example data:

```bash
npm run migrate
npm run seed
```

The seed inserts four example services — three real endpoints and one deliberately
unreachable host so you can see the red/down state — and backfills 30 days of
synthetic check history so the charts have something to draw immediately. Re-running
it is safe; it skips services that already exist. Use `npm run seed -- --fresh` to wipe
`services` and `checks` first.

Start the API:

```bash
npm run dev
```

It listens on <http://localhost:4000> and begins probing due services right away.

### 3. Start the frontend

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The dashboard is public; sign in at `/login` with
`ADMIN_USERNAME` and your admin password to add, edit and delete services.

### Production build of the frontend

```bash
cd client
VITE_API_BASE_URL=https://your-api-host/api npm run build
```

Output lands in `client/dist/` as static files. Note that `VITE_*` variables are baked
in at **build** time, not read at runtime.

---

## Troubleshooting

**`[migrate] failed: connect ECONNREFUSED`** — PostgreSQL isn't running (or isn't
installed). Confirm with `pg_isready -h localhost -p 5432`; if `pg_isready` itself is
"command not found", Postgres isn't installed at all — see step 1 above.

**`database "statuswatch" does not exist`** — run `createdb statuswatch`.

**`password authentication failed`** — `PGUSER`/`PGPASSWORD` in `server/.env` don't
match the role you created.

**`permission denied for schema public`** — on Postgres 15+, a plain role has no rights
on `public` by default:

```bash
psql -d statuswatch -c 'GRANT ALL ON SCHEMA public TO statuswatch;'
```

Set `DEBUG=1` before any command to get full stack traces:

```bash
DEBUG=1 npm run migrate
```

---

## API

Reads are public. Writes require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | – | Liveness probe; includes a database round trip |
| `POST` | `/api/auth/login` | – | `{ username, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | ✓ | Validate the current token |
| `GET` | `/api/services` | – | All services with status, uptime (24h/7d/30d) and sparkline |
| `GET` | `/api/services/:id` | – | One service, same shape |
| `GET` | `/api/services/:id/stats` | – | Uptime windows + hourly 24h timeline |
| `GET` | `/api/services/:id/checks?limit=100` | – | Raw check rows, newest first |
| `GET` | `/api/services/:id/incidents?days=30` | – | Derived incident history |
| `POST` | `/api/services` | ✓ | Create — `{ name, url, interval_seconds }` |
| `PATCH` | `/api/services/:id` | ✓ | Partial update |
| `DELETE` | `/api/services/:id` | ✓ | Delete service and its checks |
| `POST` | `/api/services/:id/check` | ✓ | Probe immediately, out of schedule |

Errors are uniform: `{ "error": { "message": "...", "details": { ... } } }`, where
`details` carries per-field validation messages.

```bash
# quick smoke test
curl -s localhost:4000/api/health
curl -s -X POST localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"your-admin-password"}'
```

---

## Configuration

All configuration is environment-driven; nothing is hardcoded. See
`server/.env.example` and `client/.env.example` for the annotated full list.

**Server**

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated, or `*` |
| `DATABASE_URL` | – | Takes precedence over the `PG*` variables |
| `PGHOST` `PGPORT` `PGDATABASE` `PGUSER` `PGPASSWORD` | – | Used when `DATABASE_URL` is unset |
| `PGSSL` | `false` | Set `true` for managed Postgres such as RDS |
| `PG_POOL_MAX` | `10` | |
| `JWT_SECRET` | **required** | |
| `JWT_EXPIRES_IN` | `12h` | |
| `ADMIN_USERNAME` | `admin` | |
| `ADMIN_PASSWORD_HASH` | – | bcrypt hash; preferred |
| `ADMIN_PASSWORD` | – | Plaintext dev fallback; used only if no hash is set |
| `SCHEDULER_ENABLED` | `true` | |
| `SCHEDULER_CRON` | `*/30 * * * * *` | 6-field cron (seconds first) |
| `CHECK_TIMEOUT_MS` | `10000` | |
| `CHECK_CONCURRENCY` | `5` | Probes in flight per tick |

**Client** (build-time)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Set to the API's public URL for deployed builds |
| `VITE_DEV_API_PROXY` | `http://localhost:4000` | Dev-server proxy target |
| `CLIENT_PORT` | `5173` | |

The server fails fast at startup if `JWT_SECRET` or admin credentials are missing,
rather than booting into an insecure state.

---

## Notes for containerising / deploying later

The app is deliberately plain so it drops into containers without modification:

- **Two independent workloads.** `server/` and `client/` each have their own
  `package.json` and no shared root package — build them as separate images.
- **No filesystem state.** Everything persists in Postgres; the API is horizontally
  scalable, with the caveat that each replica runs its own scheduler. Run the API with
  `SCHEDULER_ENABLED=false` and a single separate instance with it on to avoid
  duplicate checks.
- **Config strictly from env**, `DATABASE_URL` supported for managed databases, and
  `PGSSL=true` for RDS.
- **`GET /api/health`** is ready to serve as an ECS/ALB health check; it returns 503
  when the database is unreachable.
- **Graceful shutdown** on `SIGTERM`/`SIGINT`: the server drains in-flight requests,
  stops the cron job and closes the pool.
- **Migrations** run via `npm run migrate`, suitable as a one-off task before rollout.
- **The frontend build is static** — `client/dist/` can go behind any web server or
  into S3 + CloudFront. Remember `VITE_API_BASE_URL` is fixed at build time.
