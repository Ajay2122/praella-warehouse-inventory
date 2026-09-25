# Praella Warehouse/Inventory Management System

Practical test submission — Senior Backend Developer (Tier 3), Praella.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design (domain model,
ER diagram, RBAC matrix, API surface, phase plan).

## Tech stack

| Layer          | Choice                                              |
|----------------|-------------------------------------------------------|
| Runtime        | Node.js 20+, TypeScript                                |
| API            | Express.js                                             |
| Database       | PostgreSQL 16, Prisma ORM                              |
| Auth           | JWT access tokens + DB-backed rotating refresh, bcrypt |
| Validation     | Zod                                                    |
| Cache          | Redis 7 (cache-aside, fails open if unavailable)       |
| Queue          | BullMQ (Redis-backed)                                  |
| Testing        | Jest, Supertest (32 integration tests)                 |
| API docs       | Swagger UI / OpenAPI 3 (`/api/docs`)                   |
| Frontend       | React 18, TypeScript, Tailwind CSS, React Query        |
| Infra          | Docker, Docker Compose                                 |

## Project setup

### Option A — one command (Docker)

```bash
docker compose up -d
```

Builds and starts everything: Postgres (`5432`), Redis (`6379`), the API
(`4000`, running migrations on startup), and the web client served by
nginx (`8080`). Seed the database once the containers are healthy:

```bash
docker compose exec api npm run seed
```

Then open `http://localhost:8080`.

### Option B — local dev (hot reload)

Start just the infra containers, run the app processes on the host.

```bash
docker compose up -d postgres redis
```

**Backend:**

```bash
cd server
cp .env.example .env      # defaults already match the containers above
npm install
npx prisma migrate dev
npm run seed
npm run dev                # http://localhost:4000
```

**Frontend** (separate terminal):

```bash
cd client
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

### Verify

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready   # confirms DB connectivity too
```

Swagger UI: `http://localhost:4000/api/docs`.

### Running tests

```bash
cd server
npm test
```

Uses a separate database (`warehouse_inventory_test`, configured in
`server/.env.test`) so it never touches your dev data. `jest.config.js`'s
`globalSetup` pushes the schema onto it automatically before the run.

### Troubleshooting: Docker Desktop won't start (Windows)

If `docker compose up -d` hangs or fails with a `dockerDesktopLinuxEngine`
pipe error, Docker Desktop's WSL2 backend likely hasn't provisioned its
internal distros. From an elevated PowerShell:

```powershell
wsl --install --no-distribution
```

then restart Docker Desktop. As a fallback, any local PostgreSQL 16+ /
Redis 7+ work just as well — point `DATABASE_URL` / `REDIS_URL` in
`server/.env` at those instances instead of the docker-compose ones;
everything past that (`migrate dev`, `seed`, `dev`) is identical. This is
exactly what happened during this project's own development — see
"Challenges" below for what that turned up once Docker was working again.

## Sample / seed data

`npm run seed` (`server/prisma/seed.ts`) creates:

- Organization **Acme Retail**
- Three users, all password `Passw0rd!`:
  - `admin@acme.test` — ADMIN, member of all warehouses
  - `manager@acme.test` — MANAGER, member of all warehouses
  - `staff@acme.test` — STAFF, member of Surat DC only (demonstrates
    per-warehouse access scoping)
- Three warehouses: Surat DC, Mumbai DC, Ahmedabad DC
- Categories: Mobiles, Accessories; Supplier: Global Supplier Co.
- Products: iPhone 15 (128GB), AirPods Pro (2nd gen)
- Stock levels matching the practical-test brief's own example exactly:
  iPhone 15 — Surat 100 / Mumbai 50 / Ahmedabad 25 — each backed by an
  INBOUND `StockMovement` row (nothing sets `StockLevel` without a
  corresponding ledger entry, even in the seed)
- AirPods Pro at Surat DC seeded at 10 units with a replenishment rule of
  20, so the low-stock alert endpoint has something to return immediately
  with no manual setup

## Project summary

### Approach

Built in dependency order rather than page-by-page: schema and ER design
first (everything else references it), then auth/RBAC (every other route
needs it), then the inventory transaction engine (`server/src/lib/inventory.ts`)
as a single shared primitive — one atomic-conditional-update function that
every stock-changing path (manual movements, transfers, PO receive, SO
dispatch) calls inside its own `$transaction`, so "never go negative" and
"all-or-nothing on multi-line operations" only had to be gotten right once.
RBAC is two layers throughout: an org-wide role matrix plus a per-warehouse
membership/role override, and `organizationId` is never trusted from a
request body — only ever derived from the authenticated JWT. The frontend
came last and deliberately stays thin: it's a real, working admin UI
exercising every endpoint, not the graded centerpiece.

### What I liked

The atomic-conditional-decrement pattern for concurrency
(`UPDATE ... WHERE quantity >= amount`, checking `count === 0`) — it's a
small piece of code but it's the actual mechanism that makes "never
oversell" true under real concurrent load, and it was satisfying to
verify with a live test firing two simultaneous requests at the same
stock row. Idempotency-Key handling was also a good design exercise: the
first implementation cached error responses too, which meant a client
that fixed a bad request could never retry with the same key — the test
suite caught this before it shipped.

### What I disliked / would reconsider

Hand-maintaining the OpenAPI spec separately from the Zod schemas
(`server/src/docs/openapi.ts`) is real duplication — a `zod-to-openapi`
pipeline would be the right fix given more time, and is the one place in
this codebase where documentation can drift from validation without
anything catching it. The bulk-update job's per-item RBAC is also
looser than I'd want: enqueueing is gated to Admin/Manager, but the worker
itself doesn't re-check per-warehouse access on each line.

### Challenges

The development machine's Docker Desktop initially didn't come up — its
WSL2 backend hadn't provisioned its internal distros. Development
continued against a native local PostgreSQL/Redis in the meantime (the
Docker Compose path was validated separately via `docker compose config`
and a full read-through of both Dockerfiles), and once Docker Desktop was
working, `docker compose up -d --build` was run for real and every
service verified end-to-end: all four containers healthy, migrations
applied automatically on API startup, `docker compose exec api npm run
seed` populating the database, login and every page of the web client
working through nginx's proxy to the API container.

That real run caught three bugs the "reviewed but unproven" version had
been hiding, all now fixed in `server/Dockerfile`:
1. The runtime image ran `npm ci --omit=dev`, but `npx prisma migrate
   deploy` needs the `prisma` CLI and `npm run seed` needs `tsx` - both
   devDependencies. (It didn't fail loudly for migrations - `npx` silently
   fell back to fetching `prisma` fresh from the registry on every
   container start - but `npm run seed` failed outright with
   `tsx: not found`.)
2. Removing `--omit=dev` wasn't enough on its own: `ENV NODE_ENV=production`
   was declared *before* `RUN npm ci`, and npm treats that env var as an
   implicit `--omit=dev` regardless of the command's own flags. Moving the
   `ENV` line to after the install step fixed it.
3. `prisma/seed.ts` imports `../src/lib/password` - the TypeScript source,
   run directly via `tsx`, not the compiled `dist/` output - but the
   runtime stage never copied `src/` in. Added `COPY src ./src`.

None of these were catchable by reading the Dockerfile or by
`docker compose config` (which only validates YAML structure, not that
the image actually runs) - only by actually building and running the
image. A good reminder that "the Dockerfile looks right" and "the
container works" are different claims.

A live browser smoke test of the frontend (independently of the Docker
work above) also caught two real backend bugs that unit/integration tests
hadn't: the Redis cache client's `enableOfflineQueue` default meant every
cached endpoint hung for the full retry window instead of failing open
when Redis was unreachable, and the BullMQ queue connection had the same
latent issue for the bulk-update endpoint. Both fixed
(`server/src/lib/redis.ts`, `server/src/jobs/queue.ts`).

### Estimated time spent

This project was built in an extended pair-programming session with
Claude (Anthropic's Claude Code), working through the phases end-to-end
in one continuous sitting rather than across separate days — architecture
and schema design, all backend modules, the test suite, API docs, and the
frontend were each built, then verified live (via curl, the automated
tests, and a real browser session) before moving to the next phase. I
haven't converted that into an "hours" figure here since it doesn't map
cleanly onto solo-developer time; happy to walk through the actual
build/commit history (`git log`) if useful context for evaluation.

### Pending items / known gaps

- **OpenAPI spec is hand-maintained**, not generated from the Zod schemas
  — noted as the one place docs and validation could drift apart.
- **Bulk stock update worker doesn't re-check per-item warehouse RBAC** —
  only checked once at enqueue time.
- **No hosted deployment** — this submission targets local
  `docker compose up -d` / local dev per the setup instructions above,
  not a live URL.
- **Trimmed from the original design** (see ARCHITECTURE.md section 10):
  a separate `Role`/`Permission` table (the role-string + per-warehouse
  override model already satisfies the RBAC requirement without it) and
  GraphQL (REST only, per the brief's "REST or GraphQL" either/or).
- Everything else in ARCHITECTURE.md's phase list (auth, RBAC, warehouses,
  catalog, inventory engine, transfers, replenishment, purchase/sales
  orders, pagination/filtering/search, Redis caching, BullMQ background
  jobs, rate limiting, audit logs, automated tests, Swagger docs, and the
  React frontend) is implemented and verified working.
