# Praella Warehouse/Inventory Management System

Practical test submission — Senior Backend Developer (Tier 3), Praella.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design (domain model,
ER diagram, RBAC matrix, API surface, phase plan).

> Status: Phase 2 (database schema, migrations, seed data) complete. This
> README is filled in progressively as each phase lands; the sections the
> PDF requires (summary, challenges, time spent, pending items) are
> completed at the end.

## Tech stack

| Layer          | Choice                                   |
|----------------|-------------------------------------------|
| Runtime        | Node.js 20+, TypeScript                   |
| API            | Express.js                                |
| Database       | PostgreSQL 16, Prisma ORM                 |
| Auth           | JWT (access + rotating refresh), bcrypt   |
| Validation     | Zod                                       |
| Cache          | Redis 7                                   |
| Queue          | BullMQ (Redis-backed)                     |
| Testing        | Jest, Supertest                           |
| API docs       | Swagger / OpenAPI                         |
| Frontend       | React, TypeScript, Tailwind CSS           |
| Infra          | Docker, Docker Compose                    |

## Project setup

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts Postgres (`localhost:5432`, db `warehouse_inventory`, user/pass
`postgres`/`postgres`) and Redis (`localhost:6379`).

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Defaults in `.env.example` match the docker-compose services, so no edits
are required for local development.

### 3. Install, migrate, seed, run

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

The API listens on `http://localhost:4000`.

### Troubleshooting: Docker Desktop won't start (Windows)

If `docker compose up -d` hangs or fails with a `dockerDesktopLinuxEngine`
pipe error, Docker Desktop's WSL2 backend likely hasn't provisioned its
internal distros. From an elevated PowerShell:

```powershell
wsl --install --no-distribution
```

then restart Docker Desktop. As a fallback, any local PostgreSQL 16+ works
just as well — create a database and a role for it, then point
`DATABASE_URL` in `server/.env` at that instance instead of the
docker-compose one; everything past that step (`migrate dev`, `seed`,
`dev`) is identical. Redis (Phase 11+) can similarly be swapped for any
local Redis instance via `REDIS_URL`.

### 4. Verify

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

`/health` confirms the process is up; `/health/ready` additionally confirms
the database is reachable.

## Project summary

_(filled in as the project nears completion, per the deliverable spec: approach, what I liked/disliked, challenges, time spent, pending items)_

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
  20, so the low-stock alert endpoint (built in Phase 7) has something to
  return immediately with no manual setup
