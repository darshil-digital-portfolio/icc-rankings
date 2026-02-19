# ICC Rankings

A full-stack platform that tracks and visualises cumulative ICC points for every nation across all formats and tournaments — Men's, Women's, T20, Test Championship, and age-group events from 1973 to 2025.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind CSS) |
| Backend | Rust (Axum framework) |
| Database | MongoDB |
| Charts | Recharts |
| Dev infra | Docker Compose |

---

## Scoring System

Points are calculated as:

```
Points = Stage Base × Event Multiplier
```

**Stage base points:**

| Stage | Points |
|---|---|
| Group Stage (first round exit) | 1 |
| Quarter-Final / Super Stage | 2 |
| Semi-Final | 3 |
| Runner-Up | 4 |
| Champion | 5 |

**Event multipliers:**

| Event | Multiplier |
|---|---|
| Women's U19 World Cup | 1× |
| Men's U19 World Cup | 2× |
| Women's T20 World Cup | 3× |
| Women's World Cup | 4× |
| Men's Knockout / Champions Trophy | 5× |
| Men's T20 World Cup | 6× |
| World Test Championship | 7× |
| Men's Cricket World Cup | 8× |

---

## Project Structure

```
icc_ranking/
├── apps/
│   ├── api/               # Rust / Axum REST API
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── scoring.rs
│   │       ├── models/
│   │       ├── handlers/
│   │       ├── routes/
│   │       └── seed/      # auto-seeds DB on first boot
│   └── web/               # Next.js 14 frontend
│       └── src/
│           ├── app/       # pages & routes
│           ├── components/
│           ├── lib/       # API client, utilities
│           └── types/
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   └── Dockerfile.web
├── GETTING_STARTED_WINDOWS.md
└── GETTING_STARTED_LINUX.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/rankings` | Overall rankings (filterable by event type) |
| GET | `/api/v1/rankings/team/:slug/breakdown` | Points breakdown by format for one team |
| GET | `/api/v1/teams` | List all teams |
| GET | `/api/v1/teams/:slug` | Team detail with full tournament history |
| GET | `/api/v1/events` | List all events |
| GET | `/api/v1/events/:id` | Event detail with all participants and points |

---

## Ports

| Service | Local URL |
|---|---|
| Frontend | http://localhost:5237 |
| API | http://localhost:7429 |
| MongoDB | localhost:47017 |

---

## Getting Started

See the guide for your operating system:

- **Windows** → [`GETTING_STARTED_WINDOWS.md`](./GETTING_STARTED_WINDOWS.md)
- **Linux** → [`GETTING_STARTED_LINUX.md`](./GETTING_STARTED_LINUX.md)

---

## Roadmap

### Phase 1 (current)
- Fixed historical data for all ICC events 1973–2025
- Overall and per-format rankings
- Team detail pages with tournament history
- Event detail pages

### Phase 2 (planned)
- Add new events without code changes
- Configurable event multipliers and stage weights via admin UI
- Automatic data ingestion from ICC results feeds
