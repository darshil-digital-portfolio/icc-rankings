# Getting Started — Windows
### For Python/uv developers — no prior Rust or Node experience needed

---

## 1. Ecosystem Mapping (Python → This Project)

| Python world | This project | What it does |
|---|---|---|
| `uv` / `pip` | `cargo` | installs packages & builds the app |
| `pyproject.toml` / `requirements.txt` | `Cargo.toml` | declares dependencies |
| `.venv` / `site-packages` | `target/` folder | compiled output (never touch manually) |
| FastAPI / Flask | Axum (Rust) | the HTTP web framework |
| `uvicorn main:app` | `cargo run` | runs the server |
| `npm` for frontend | `npm` | installs JS packages |
| `package.json` | `package.json` | same concept, declares JS dependencies |
| `node_modules/` | `node_modules/` | JS equivalent of `.venv` |
| Pydantic models | `serde` structs | serialise/deserialise data (JSON ↔ struct) |
| PostgreSQL (psycopg) | PostgreSQL (sqlx) | same database, different driver |

---

## 2. Prerequisites — Install These First

Open **PowerShell as Administrator** for all install commands below.

### A. Rust toolchain

Rust has its own installer called `rustup` — think of it like `uv` but for Rust.

```powershell
winget install Rustlang.Rustup
```

Close and reopen PowerShell after installation, then verify:

```powershell
rustc --version    # e.g. rustc 1.80.0
cargo --version    # e.g. cargo 1.80.0
```

> `cargo` = Rust's combined pip + build tool + test runner. You will use it constantly.

### B. Node.js (LTS)

Required for the Next.js frontend.

```powershell
winget install OpenJS.NodeJS.LTS
```

Verify (in a new PowerShell window):

```powershell
node --version    # should be v20+
npm --version     # should be v10+
```

### C. Python 3.12+ and uv

Required for the **Twelfth Man** AI chatbot service.

```powershell
winget install Python.Python.3.12
```

Close and reopen PowerShell, then install **uv**:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Verify:

```powershell
python --version    # should be 3.12+
uv --version
```

### D. Docker Desktop

Used to run PostgreSQL and MongoDB without installing them directly on your machine.

1. Download from: **https://www.docker.com/products/docker-desktop/**
2. Run the installer — keep all defaults
3. Launch Docker Desktop and wait until it shows "Docker is running" in the system tray
4. Verify in PowerShell:

```powershell
docker --version
docker compose version
```

> Docker Desktop must be **running in the background** whenever you work on this project.

---

## 3. One-Time Project Setup

Run these once after cloning the project. All commands from the **project root** (`icc_ranking\`).

### Step 1 — Copy environment files

```powershell
copy .env.example apps\api\.env
copy apps\web\.env.local.example apps\web\.env.local
```

These files tell each service where to find the others. The defaults work as-is for local development.

### Step 2 — Install JavaScript dependencies

```powershell
npm install
```

This downloads Next.js and all frontend packages into `apps\web\node_modules\`.
Equivalent of `uv sync`. Takes ~30 seconds.

### Step 3 — Rust dependencies are automatic

Unlike Python, you do **not** pre-install Rust packages manually.
`cargo run` fetches and compiles all dependencies on the first run (2–5 minutes — see Section 11).

### Step 4 — Set up the Twelfth Man chatbot (Python)

```powershell
cd ai_chatbot

# Create a virtual environment using uv
uv venv env-chatbot --python 3.12

# Install dependencies
uv pip install -r requirements.txt --python env-chatbot\Scripts\python.exe

# Copy and configure the environment file
copy .env.example .env
# Edit .env with notepad and add your Anthropic API key:
#   ANTHROPIC_API_KEY=sk-ant-...
notepad .env

cd ..
```

### Step 5 — Create the read-only PostgreSQL user

The chatbot needs a read-only database user. After starting the databases (Section 4, Terminal 1), you need a PostgreSQL client. You can use the Docker container:

```powershell
docker exec -i icc_postgres psql -U icc -d icc_ranking -f - < docker\init-readonly-user.sql
```

Or if you have `psql` installed locally:

```powershell
$env:PGPASSWORD="icc_secret"; psql -h localhost -p 54321 -U icc -d icc_ranking -f docker\init-readonly-user.sql
```

---

## 4. Starting the App (Four Terminals)

Open **four separate PowerShell windows**. Keep all four running.

### Terminal 1 — PostgreSQL + MongoDB

```powershell
# From project root
npm run docker:up
```

This pulls the PostgreSQL and MongoDB Docker images and starts them in the background.

Verify they started:

```powershell
docker ps
# You should see rows with "icc_postgres" and "icc_mongo"
```

**To stop them later:** `npm run docker:down`

### Terminal 2 — Rust API

```powershell
cd apps\api
cargo run
```

**First run:** Rust downloads and compiles ~60 packages. Takes 2–5 minutes — this is expected (see Section 11).
**All subsequent runs:** ~5 seconds.

When ready you will see:

```
INFO icc_ranking_api: Running migrations...
INFO icc_ranking_api: Seeding historical ICC data…
INFO icc_ranking_api: Seeding complete
INFO icc_ranking_api: Listening addr="0.0.0.0:7429"
```

Verify it works (in any PowerShell window or your browser):

```powershell
curl http://localhost:7429/health
# Expected: {"status":"ok","service":"icc-ranking-api","version":"0.1.0"}
```

### Terminal 3 — Next.js Frontend

```powershell
cd apps\web
npm run dev -- --port 5237
```

When ready you will see:

```
▲ Next.js 14.x.x
- Local: http://localhost:5237
- Ready in 2.1s
```

Open **http://localhost:5237** in your browser.

### Terminal 4 — Twelfth Man AI Chatbot

```powershell
cd ai_chatbot
env-chatbot\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

> Shortcut from the project root: `npm run dev:chatbot` (Linux/macOS only — uses venv Python directly)

When ready you will see:

```
INFO     Twelfth Man ready on 0.0.0.0:8100 (router=claude-haiku-4-5-..., sql=claude-sonnet-4-...)
INFO     Uvicorn running on http://0.0.0.0:8100
```

Verify it works:

```powershell
curl http://localhost:8100/health
# Expected: {"status":"ok","service":"twelfth-man"}
```

Open **http://localhost:5237/chat** to use the chatbot.

---

## 5. What Each Part Does

```
Browser  →  http://localhost:5237
                    │
             Next.js (frontend)
             renders pages, fetches data from APIs
                    │
        ┌───────────┴───────────┐
        │                       │
  Rust API → :7429       Twelfth Man → :8100
  rankings, teams,       AI chatbot (LangGraph)
  events, points         natural language queries
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
  PostgreSQL → :5432      MongoDB → :47017
  teams, events,          conversation history
  event_results           (90-day retention)
```

- **Next.js** — the frontend. Pages are in `apps\web\src\app\` (including `\chat`).
- **Rust API** — the backend. Routes are in `apps\api\src\handlers\`.
- **Twelfth Man** — AI chatbot. LangGraph agents in `ai_chatbot\app\graph\`.
- **PostgreSQL** — primary database. Tables: `teams`, `events`, `event_results`.
- **MongoDB** — stores chatbot conversation history.

---

## 6. Useful Commands

### Rust API (run from `apps\api\`)

| What | Command |
|---|---|
| Start dev server | `cargo run` |
| Start with verbose logs | `$env:RUST_LOG="debug"; cargo run` |
| Build release binary | `cargo build --release` |
| Run tests | `cargo test` |
| Check for errors (no build) | `cargo check` |
| Lint | `cargo clippy -- -D warnings` |
| Add a dependency | `cargo add <crate-name>` |

> Note the PowerShell syntax for env vars: `$env:VAR="value"; command`
> This is different from Linux where you'd write `VAR=value command` on one line.

### Next.js (run from `apps\web\`)

| What | Command |
|---|---|
| Dev server with hot reload | `npm run dev -- --port 5237` |
| Production build | `npm run build` |
| TypeScript type check | `npm run type-check` |
| Lint | `npm run lint` |

### Twelfth Man chatbot (run from `ai_chatbot\`)

| What | Command |
|---|---|
| Start dev server | `npm run dev:chatbot` (from project root) |
| Activate venv | `env-chatbot\Scripts\activate` |
| Run tests | `env-chatbot\Scripts\python -m pytest tests\ -v` |
| Run tests with coverage | `env-chatbot\Scripts\python -m pytest tests\ -v --cov=app --cov-report=term-missing` |
| Install new dependency | `uv pip install <package> --python env-chatbot\Scripts\python.exe` |

### Docker / Databases (run from project root)

| What | Command |
|---|---|
| Start databases | `npm run docker:up` |
| Stop databases | `npm run docker:down` |
| Check running containers | `docker ps` |
| Open PostgreSQL shell | `docker exec -it icc_postgres psql -U icc -d icc_ranking` |
| Open MongoDB shell | `docker exec -it icc_mongo mongosh icc_ranking` |

---

## 7. Resetting the Database

If you want to wipe all data and re-seed from scratch:

```powershell
# Stop containers
npm run docker:down

# Delete the data volumes
docker volume rm docker_postgres_data docker_mongo_data

# Restart databases
npm run docker:up

# Re-create the read-only user (after PostgreSQL is healthy)
docker exec -i icc_postgres psql -U icc -d icc_ranking -f - < docker\init-readonly-user.sql

# Then restart the API — it will re-seed automatically
# (back in Terminal 2, stop with Ctrl+C, then run cargo run again)
```

---

## 8. Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `cargo: command not found` | Rust not installed or shell not restarted | Install rustup, then reopen PowerShell |
| `cargo run` sits compiling for 5 min | First-time compile — normal | Wait, do not interrupt |
| `Connection refused :7429` | API not running | Start Terminal 2 |
| `Connection refused :8100` | Chatbot not running | Start Terminal 4 |
| `ANTHROPIC_API_KEY` error | Missing API key | Edit `ai_chatbot\.env` and set your key |
| `uv: command not found` | uv not installed | Run the uv install script from Section 2C |
| PostgreSQL connection refused | Docker not running | Run `npm run docker:up` and wait for healthy |
| `npm: command not found` | Node.js not installed or shell not restarted | Install Node LTS, reopen PowerShell |
| Page shows "Network Error" | API URL wrong in env file | Check `apps\web\.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:7429` |
| Chat shows "couldn't reach chatbot" | Chatbot not running or wrong port | Start Terminal 4, check port 8100 |
| `docker: command not found` | Docker Desktop not running | Open Docker Desktop from Start Menu and wait for it to start |

---

## 9. File Structure Quick Reference

```
icc_ranking\
├── apps\
│   ├── api\                  ← Rust backend
│   │   ├── Cargo.toml        ← like pyproject.toml
│   │   ├── migrations\       ← PostgreSQL schema migrations
│   │   └── src\
│   │       ├── main.rs       ← entry point (like main.py)
│   │       ├── scoring.rs    ← point calculation logic
│   │       ├── models\       ← data shapes (like Pydantic models)
│   │       ├── handlers\     ← route logic (like FastAPI route functions)
│   │       └── seed\         ← database seeder (runs once on startup)
│   └── web\                  ← Next.js frontend
│       └── src\
│           ├── app\          ← pages (file = route, like Flask blueprints)
│           │   └── chat\     ← Twelfth Man chat page
│           ├── components\   ← reusable UI pieces
│           │   └── chat\     ← chat message, chart, view components
│           ├── lib\          ← API client, chatbot client, utilities
│           └── types\        ← TypeScript types (like Pydantic, read-only)
├── ai_chatbot\               ← Python chatbot service (YOU ARE HERE if Python dev)
│   ├── app\
│   │   ├── main.py           ← FastAPI entry point
│   │   ├── config.py         ← settings (reads .env)
│   │   ├── models.py         ← Pydantic request/response models
│   │   ├── db\               ← PostgreSQL + MongoDB connections
│   │   ├── graph\            ← LangGraph agents and prompts
│   │   └── guardrails\       ← SQL validation, safety checks
│   ├── tests\                ← pytest suite (132 tests)
│   ├── requirements.txt
│   └── .env                  ← your Anthropic API key goes here
└── docker\
    └── docker-compose.yml    ← spins up PostgreSQL + MongoDB
```

---

## 10. Twelfth Man Chatbot — How It Works

The chatbot uses a **LangGraph** multi-agent graph:

```
User message
     │
  [Router]  ← Claude Haiku (cheap, fast)
     │         Classifies: SQL query? Analytics? Greeting? Off-topic?
     │
  ┌──┴──┐
  │     │
[SQL] [Analytics]  ← Claude Sonnet (accurate)
  │     │            SQL generation + pandas code
  │     │
  └──┬──┘
     │
  [Formatter]  ← Claude Haiku
     │            Markdown + chart specs + follow-up suggestions
     │
  Response
```

- **Router** decides what kind of question it is (costs ~$0.001)
- **SQL Agent** generates and validates SELECT queries (costs ~$0.01)
- **Analytics Agent** generates pandas code for stats (costs ~$0.01)
- **Formatter** turns raw data into a friendly response with optional charts
- Average query costs ~$0.02-0.03

---

## 11. Key Concept: Why Rust Compiles First

Python runs code line by line at runtime — no compilation step.
Rust converts everything to native machine code **before** running. This means:

| Moment | Time | Why |
|---|---|---|
| First `cargo run` ever | 2–5 min | Downloading + compiling all dependencies |
| After changing your own code | ~5–15 sec | Only your changed files recompile |
| No code changes, just restart | ~2 sec | Binary already built |

The `target\` folder holds the compiled output — it can grow to 1–3 GB. This is normal.
It is already in `.gitignore` so it will never be committed.

---

## 12. Port Reference

| Service | Address |
|---|---|
| Web (Next.js) | http://localhost:**5237** |
| API (Rust) | http://localhost:**7429** |
| Chatbot (Python) | http://localhost:**8100** |
| PostgreSQL (local) | localhost:**5432** |
| PostgreSQL (Docker) | localhost:**54321** |
| MongoDB | localhost:**47017** |
