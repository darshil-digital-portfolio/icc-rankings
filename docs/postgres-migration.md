# PostgreSQL Migration Plan

**Branch:** `feat/postgres-migration`
**Status:** Complete
**Created:** 2026-03-17
**Completed:** 2026-03-18

## Context

Moving ICC rankings data from MongoDB → PostgreSQL.
MongoDB is **kept** in the stack for future chat history / session storage.

### Why PostgreSQL
- Data is relational (teams ↔ events ↔ results) — MongoDB adds no value
- SQL is the right interface for the upcoming LangGraph AI agent
- Enables players, venues, and richer analytics in the future
- Simpler queries than MongoDB aggregation pipelines

---

## Schema

### Core Tables

```sql
teams (
    slug         TEXT PRIMARY KEY,   -- natural key, used as FK throughout
    name         TEXT,
    short_name   TEXT,
    flag_emoji   TEXT,
    country_code TEXT
)

events (
    id           SERIAL PRIMARY KEY,
    name         TEXT,
    short_name   TEXT,
    event_type   event_type_enum,    -- postgres enum
    year         SMALLINT,
    host         TEXT
)

event_results (
    id           SERIAL PRIMARY KEY,
    event_id     INTEGER  → events(id),
    team_slug    TEXT     → teams(slug),
    stage        stage_enum,         -- postgres enum
    base_points  SMALLINT,
    multiplier   SMALLINT,
    total_points SMALLINT GENERATED ALWAYS AS (base_points * multiplier) STORED,
    UNIQUE (event_id, team_slug)
)
```

### Future Stubs (empty tables, created now for FK readiness)

```sql
venues  (id, name, city, country, capacity)
players (id, team_slug → teams, full_name, role, batting_style, bowling_style, dob)
```

### Key Design Decisions
- `teams.slug` is the PK — avoids a join layer since every handler looks up by slug
- `total_points` is a generated column — never drifts from `base_points × multiplier`
- `event_type` and `stage` are Postgres ENUMs — schema-enforced, match Rust serde values

---

## Tech Stack Changes

| | Before | After |
|---|---|---|
| DB driver | `mongodb` + `bson` crates | `sqlx` (postgres feature) |
| Connection | `mongodb::Database` | `sqlx::PgPool` |
| Migrations | None (seed-only) | `sqlx migrate` (`apps/api/migrations/`) |
| Docker | `icc_mongo` only | `icc_postgres` added, `icc_mongo` kept |

---

## What Changes vs Stays the Same

**Changed:**
- `apps/api/Cargo.toml` — remove mongodb/bson/futures, add sqlx
- `apps/api/src/db.rs` — PgPool, migration runner
- `apps/api/src/config.rs` — `DATABASE_URL` replaces `MONGODB_URI` + `MONGODB_DB`
- `apps/api/src/error.rs` — replace 3 MongoDB error variants with `sqlx::Error`
- `apps/api/src/seed/mod.rs` — SQL inserts via QueryBuilder
- `apps/api/src/handlers/teams.rs`
- `apps/api/src/handlers/events.rs`
- `apps/api/src/handlers/rankings.rs`
- `docker/docker-compose.yml`

**Untouched (zero changes):**
- `apps/api/src/seed/data.rs` — historical data, source of truth
- `apps/api/src/scoring.rs` — scoring logic
- `apps/api/src/routes/mod.rs` — route definitions
- `apps/api/src/models/` — response structs (API contract unchanged)
- `apps/web/` — entire frontend (zero changes)
- `apps/web/src/types/index.ts`

> **Note:** Event `id` in URLs changes from MongoDB hex (`/events/65f3a2...`) → integer (`/events/1`).
> Safe because IDs are fetched from the events list response — never hardcoded.

---

## Implementation Phases

### Phase 0 — Tooling Setup
- [ ] Install sqlx CLI: `cargo install sqlx-cli --features postgres`
- [ ] Add postgres service to `docker/docker-compose.yml`
- [ ] Create `apps/api/.env` with `DATABASE_URL=postgresql://icc:icc_secret@localhost:54321/icc_ranking`
- [ ] Start postgres: `npm run docker:up`

### Phase 1 — Schema Migrations
- [ ] Create `apps/api/migrations/` directory
- [ ] `0001_extensions.sql` — `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- [ ] `0002_create_enums.sql` — `event_type_enum`, `stage_enum`
- [ ] `0003_create_teams.sql` — teams table + gin index
- [ ] `0004_create_events.sql` — events table + indexes
- [ ] `0005_create_event_results.sql` — event_results + generated column + indexes
- [ ] `0006_create_venues_stub.sql` — venues (empty)
- [ ] `0007_create_players_stub.sql` — players (empty)
- [ ] Run `sqlx migrate run` — verify all 7 Applied
- [ ] Run `sqlx migrate info` — confirm clean state

### Phase 2 — Cargo.toml + db.rs + config.rs
- [ ] Remove `mongodb`, `bson`, `futures` from `Cargo.toml`
- [ ] Add `sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-rustls", "chrono", "macros"] }`
- [ ] Rewrite `db.rs` — PgPool, PgPoolOptions, `sqlx::migrate!()` on startup
- [ ] Update `config.rs` — `database_url: String` field
- [ ] `cargo check` — db.rs and config.rs should compile (handlers will fail, expected)

### Phase 3 — Error Handling
- [ ] Rewrite `error.rs` — remove MongoDB/bson variants, add `sqlx::Error`
- [ ] Add `sqlx::Error::RowNotFound` → `AppError::NotFound` mapping
- [ ] `cargo check` — error.rs compiles clean

### Phase 4 — Seed Rewrite
- [ ] Rewrite `seed/mod.rs` — QueryBuilder batch inserts, `ON CONFLICT DO NOTHING`
- [ ] Keep `data.rs` completely untouched
- [ ] Run `SEED_ON_STARTUP=true cargo run` — verify rows in Postgres
- [ ] Spot-check: `SELECT COUNT(*) FROM teams` = 32, `SELECT COUNT(*) FROM events` = expected

### Phase 5 — Handler: Teams
- [ ] Rewrite `handlers/teams.rs`
  - [ ] `list_teams` — LEFT JOIN + optional ILIKE search
  - [ ] `get_team` — team row + history rows
- [ ] Smoke-test `GET /api/v1/teams`
- [ ] Smoke-test `GET /api/v1/teams/india`
- [ ] Compare response shape to MongoDB version

### Phase 6 — Handler: Events
- [ ] Rewrite `handlers/events.rs`
  - [ ] `list_events` — double LEFT JOIN for champion info
  - [ ] `get_event` — simple JOIN
- [ ] Smoke-test `GET /api/v1/events`
- [ ] Smoke-test `GET /api/v1/events/1`
- [ ] Compare response shape to MongoDB version

### Phase 7 — Handler: Rankings
- [ ] Rewrite `handlers/rankings.rs`
  - [ ] `get_rankings` — GROUP BY with optional event_type filter
  - [ ] `get_team_breakdown` — GROUP BY event_type
- [ ] Smoke-test `GET /api/v1/rankings`
- [ ] Smoke-test `GET /api/v1/rankings/team/india/breakdown`
- [ ] Smoke-test `GET /api/v1/rankings?event_type=test_championship`
- [ ] Compare response shape to MongoDB version

### Phase 8 — Model Cleanup
- [ ] Remove `bson::oid::ObjectId` from model files
- [ ] Update `id` fields: `i32` for events/results, slug for teams

### Phase 9 — Docker + Dockerfile
- [ ] Finalize `docker/docker-compose.yml` — postgres service, updated API env vars
- [ ] Run `cargo sqlx prepare` — generate `.sqlx/` offline query metadata for Docker builds
- [ ] Update `docker/Dockerfile.api` if needed for sqlx offline mode
- [ ] Test full stack: `docker compose up`

### Phase 10 — Validation
- [ ] `cargo clippy -- -D warnings` — zero warnings
- [ ] `cargo test` — scoring tests pass
- [ ] All 6 endpoints return correct data
- [ ] `npm run lint:web` — passes
- [ ] `npm run type-check` (in `apps/web/`) — passes
- [ ] Frontend loads correctly, all pages render

---

## SQL Reference Queries (for handlers)

### Rankings
```sql
SELECT t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short_name,
       t.flag_emoji,
       SUM(er.total_points)::INT AS total_points,
       COUNT(*)::INT             AS events_participated,
       SUM(CASE WHEN er.stage = 'champion' THEN 1 ELSE 0 END)::INT AS titles
FROM event_results er
JOIN teams t ON t.slug = er.team_slug
-- optional: JOIN events e ON e.id = er.event_id WHERE e.event_type = $1::event_type_enum
GROUP BY t.slug, t.name, t.short_name, t.flag_emoji
ORDER BY total_points DESC
LIMIT $2 OFFSET $3
```

### Team Breakdown
```sql
SELECT e.event_type::TEXT,
       SUM(er.total_points)::INT AS total_points,
       COUNT(*)::INT             AS events_participated,
       SUM(CASE WHEN er.stage = 'champion' THEN 1 ELSE 0 END)::INT AS titles
FROM event_results er
JOIN events e ON e.id = er.event_id
WHERE er.team_slug = $1
GROUP BY e.event_type
ORDER BY total_points DESC
```

### Events List (with champion info)
```sql
SELECT e.id, e.name, e.short_name, e.event_type::TEXT, e.year, e.host,
       COUNT(er.id)::INT AS teams_count,
       champ.team_slug   AS champion_slug,
       t.name            AS champion_name,
       t.flag_emoji      AS champion_flag
FROM events e
LEFT JOIN event_results er    ON er.event_id = e.id
LEFT JOIN event_results champ ON champ.event_id = e.id AND champ.stage = 'champion'
LEFT JOIN teams t             ON t.slug = champ.team_slug
GROUP BY e.id, champ.team_slug, t.name, t.flag_emoji
ORDER BY e.year DESC
LIMIT $1 OFFSET $2
```

---

## Future Work (post-migration)

- [ ] Add `venue_id` FK to `events` table once venue data is ready
- [ ] Populate `players` table — integrate with external cricket API for player data
- [ ] Set up live event ingestion via Sportmonks / CricketData API (~$6–30/mo)
- [ ] Data quality pass — fact-check `data.rs` against ESPNcricinfo
- [ ] LangGraph AI agent — connect to this PostgreSQL instance for SQL analytics

---

## Docker Port Reference (unchanged)

| Service | Host Port | Container Port |
|---|---|---|
| Web | 5237 | 3000 |
| API | 7429 | 7429 |
| PostgreSQL | 54321 | 5432 |
| MongoDB | 47017 | 27017 |
