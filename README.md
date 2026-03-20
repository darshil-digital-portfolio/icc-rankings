# ICC Rankings

A full-stack platform that tracks and visualises cumulative ICC points for every nation across all formats and tournaments — Men's, Women's, T20, Test Championship, and age-group events from 1973 to 2025.

Includes **Twelfth Man**, an AI chatbot that answers questions about ICC data using natural language.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind CSS, Recharts) |
| Backend API | Rust (Axum framework, sqlx) |
| AI Chatbot | Python (FastAPI, LangGraph, Claude API) |
| Primary Database | PostgreSQL 16 |
| Chat History | MongoDB 7 |
| Dev Infra | Docker Compose, uv (Python env) |

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
│   ├── api/                 # Rust / Axum REST API
│   │   ├── Cargo.toml
│   │   ├── migrations/      # PostgreSQL migrations (run on startup)
│   │   └── src/
│   │       ├── main.rs
│   │       ├── scoring.rs
│   │       ├── models/
│   │       ├── handlers/
│   │       ├── routes/
│   │       └── seed/        # auto-seeds DB on first boot
│   └── web/                 # Next.js 14 frontend
│       └── src/
│           ├── app/         # pages & routes (including /chat)
│           ├── components/  # UI components (including chat/)
│           ├── lib/         # API client, chatbot client, utilities
│           └── types/
├── apps/chatbot/              # Python / LangGraph AI chatbot
│   ├── app/
│   │   ├── main.py          # FastAPI server
│   │   ├── graph/           # LangGraph agents (router, sql, analytics, formatter)
│   │   ├── db/              # PostgreSQL (read-only) + MongoDB (chat history)
│   │   └── guardrails/      # SQL validation, topic safety
│   ├── tests/               # pytest test suite (132 tests)
│   ├── requirements.txt
│   └── requirements-dev.txt
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── Dockerfile.chatbot
│   └── init-readonly-user.sql
├── GETTING_STARTED_WINDOWS.md
└── GETTING_STARTED_LINUX.md
```

---

## API Endpoints

### Rust API (port 7429)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/rankings` | Overall rankings (filterable by `?event_type=`) |
| GET | `/api/v1/rankings/team/:slug/breakdown` | Points breakdown by format for one team |
| GET | `/api/v1/teams` | List all teams |
| GET | `/api/v1/teams/:slug` | Team detail with full tournament history |
| GET | `/api/v1/events` | List all events |
| GET | `/api/v1/events/:id` | Event detail with all participants and points |

### Twelfth Man Chatbot (port 8100)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/chat` | Send a message, get AI response (with optional chart spec) |
| GET | `/history/{session_id}` | Retrieve conversation history |
| POST | `/session` | Create a new anonymous session |

---

## Ports

| Service | Local URL |
|---|---|
| Frontend (Next.js) | http://localhost:5237 |
| API (Rust) | http://localhost:7429 |
| Chatbot (Python) | http://localhost:8100 |
| PostgreSQL | localhost:5432 (local) or localhost:54321 (Docker) |
| MongoDB | localhost:47017 |

---

## Quick Start

### Prerequisites

- **Rust** (via rustup)
- **Node.js** 20+ and npm 10+
- **Python** 3.12+ and **uv** (for the chatbot)
- **Docker** (for PostgreSQL and MongoDB)
- **Anthropic API key** (for the chatbot)

### Run (4 terminals)

```bash
# Terminal 1 — Databases
npm run docker:up

# Terminal 2 — Rust API
npm run dev:api

# Terminal 3 — Next.js
npm run dev:web

# Terminal 4 — Twelfth Man chatbot (activate venv first)
cd apps/chatbot && source env-chatbot/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

Open **http://localhost:5237** — the main site.
Open **http://localhost:5237/chat** — the AI chatbot.

See the full guide for your OS:

- **Linux** → [`GETTING_STARTED_LINUX.md`](./GETTING_STARTED_LINUX.md)
- **Windows** → [`GETTING_STARTED_WINDOWS.md`](./GETTING_STARTED_WINDOWS.md)

---

## Roadmap

### Phase 1 (complete)
- Fixed historical data for all ICC events 1973–2025
- Overall and per-format rankings
- Team detail pages with tournament history
- Event detail pages

### Phase 2 (complete)
- PostgreSQL migration (primary database)
- Dark mode with royal purple + gold theme

### Phase 3 (current)
- Twelfth Man AI chatbot (LangGraph + Claude)
- Natural language queries over ICC data
- Statistical analysis (std dev, growth rates, comparisons)
- In-chat chart visualisations

### Phase 4 (planned)
- Streaming chatbot responses
- Context-aware chat (knows which page you're on)
- Add new events without code changes
- Admin UI for event multipliers and stage weights
