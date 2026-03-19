# ICC Rankings — Claude Code Project Guide

## What this project is

Full-stack ICC cricket tournament points tracker. Tracks cumulative team points
across all ICC formats from 1973–2025. **Next.js 14** frontend + **Rust/Axum** API + **PostgreSQL** (primary) + **MongoDB** (kept for future chat/session storage).

```
apps/
  web/    Next.js 14 (App Router, TypeScript, Tailwind CSS, Recharts, TanStack Query)
  api/    Rust (Axum, sqlx/PostgreSQL), historical seed data 1973-2025
docker/   Docker Compose (postgres + mongo + api + web services)
```

## Running locally (3 terminals)

```bash
# Terminal 1 — PostgreSQL + MongoDB (Docker or local)
npm run docker:up        # starts both postgres + mongo via Docker
# Or use local PostgreSQL on port 5432 with DATABASE_URL in apps/api/.env

# Terminal 2 — Rust API  http://localhost:7429
npm run dev:api

# Terminal 3 — Next.js web  http://localhost:5237
npm run dev:web
```

**Ports:** Web: 5237 · API: 7429 · PostgreSQL: 5432 (local) or 54321 (Docker) · MongoDB: 47017

## Web app conventions

- **Path alias:** `@/` = `apps/web/src/`
- **Colors:** `pitch` (royal purple) + `gold` (amber). Never hard-code hex values that duplicate Tailwind config.
- **Styling:** Tailwind utility classes + `cn()` from `@/lib/utils`. Reusable classes live in `globals.css` (`.card`, `.badge`, `.container-page`, `.btn-primary`, etc.)
- **Data fetching:** Server Components fetch via `apiFetch()` from `@/lib/api`. Client components use TanStack Query.
- **Charts:** Recharts in `"use client"` components — always wrap in `<ResponsiveContainer>`. Color maps in `src/lib/utils.ts`.
- **TypeScript:** Strict mode. All types in `src/types/index.ts`. Never use `any` without a comment.
- **Linting:** `npm run lint:web` (ESLint) and `npm run type-check` (inside `apps/web/`)

## API conventions

- All routes under `/api/v1/` (except `/health`)
- Handlers in `src/handlers/`, models in `src/models/`, scoring in `src/scoring.rs`
- Error handling via `src/error.rs` — never `.unwrap()` in handlers
- Run `cargo clippy -- -D warnings` before committing Rust code
- Seed data in `src/seed/data.rs` — only edit to add new historical events

## Scoring system

```
Points = Stage Base × Event Multiplier
Stage:      Group(1)  QF(2)  Semi(3)  Runner-up(4)  Champion(5)
Multiplier: Women's U19(1×) → Men's World Cup(8×)
```

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /api/v1/rankings` | All-time rankings (optional `?event_type=`) |
| `GET /api/v1/rankings/team/:slug/breakdown` | Per-format breakdown for one team |
| `GET /api/v1/teams` | List teams (optional `?name=`) |
| `GET /api/v1/teams/:slug` | Team detail + tournament history |
| `GET /api/v1/events` | List events (up to 200) |
| `GET /api/v1/events/:id` | Event detail + participants |

## Database

**PostgreSQL** (primary): Tables: `teams`, `events`, `event_results`, `venues` (stub), `players` (stub).

- Driver: `sqlx` with runtime string queries (not compile-time macros)
- Migrations: `apps/api/migrations/` — run via `sqlx::migrate!()` on API startup
- Connection: `DATABASE_URL` env var (default: `postgresql://icc:icc_secret@localhost:5432/icc_ranking`)
- Enums: `event_type_enum`, `stage_enum` (Postgres-level enforcement)
- `event_results.total_points` is a `GENERATED ALWAYS AS (base_points * multiplier) STORED` column

**Reset DB:** `psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"` → restart API with `SEED_ON_STARTUP=true`.

**MongoDB** (kept for future use): available on port 47017, no active application code uses it.

## Design tokens

- **Primary:** `pitch-*` = royal purple palette (600: #9333ea, 700: #7e22ce, 950: #3b0764)
- **Accent:** `gold-*` = amber/gold palette (500: #d4af37)
- **Gradient:** `bg-pitch-gradient` = deep purple → royal purple (used in header, hero, team hero)
- **Cards:** `.card` = white bg, slate border, rounded-xl
- **Buttons:** `.btn-primary` (purple), `.btn-gold` (gold CTA), `.btn-secondary` (outline)

## Do NOT touch

- `apps/api/src/seed/data.rs` — historical data source of truth
- `apps/web/src/types/index.ts` — mirrors the API shape exactly; only update if API models change
- Docker service names and port mappings in `docker/docker-compose.yml`
- `apps/web/tailwind.config.ts` color names — components reference them by name throughout
