# Getting Started — Linux
### For Python/uv developers — no prior Rust or Node experience needed

> Commands are written for **Debian/Ubuntu** (`apt`).
> Equivalents for Fedora (`dnf`) and Arch (`pacman`) are noted where they differ.

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

### A. Rust toolchain

Rust has its own installer called `rustup` — think of it like `uv` but for Rust.
**Do not install Rust via `apt`** — the distro package is almost always outdated.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

The installer will prompt you — press **1** (Proceed with default installation).

Then activate Rust in your current shell without reopening it:

```bash
source $HOME/.cargo/env
```

Verify:

```bash
rustc --version    # e.g. rustc 1.80.0
cargo --version    # e.g. cargo 1.80.0
```

> The activation line (`source $HOME/.cargo/env`) is automatically added to your `~/.bashrc` / `~/.zshrc`,
> so all future shells will have `cargo` available without you doing anything extra.

> `cargo` = Rust's combined pip + build tool + test runner. You will use it constantly.

### B. Node.js (LTS)

Required for the Next.js frontend. Use the NodeSource installer to get a current version — distro packages are typically too old.

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Fedora
sudo dnf install nodejs --repo nodesource-lts

# Arch
sudo pacman -S nodejs npm
```

Verify:

```bash
node --version    # should be v20+
npm --version     # should be v10+
```

### C. Python 3.12+ and uv

Required for the **Twelfth Man** AI chatbot service.

Python 3.12 should already be installed on modern Ubuntu/Debian. Verify:

```bash
python3 --version    # should be 3.12+
```

Install **uv** (fast Python package manager):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verify:

```bash
uv --version
```

### D. Docker Engine + Compose plugin

Used to run PostgreSQL and MongoDB without installing them directly on your machine.

```bash
# Ubuntu / Debian — official Docker repo
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Fedora
sudo dnf install -y docker docker-compose-plugin
sudo systemctl enable --now docker

# Arch
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
```

**Allow running Docker without `sudo`** (you must log out and back in after this):

```bash
sudo usermod -aG docker $USER
# Log out and log back in, then verify:
docker run hello-world
```

Verify compose is available:

```bash
docker compose version    # note: no hyphen — this is Compose v2
```

---

## 3. One-Time Project Setup

Run these once after cloning the project. All commands from the **project root** (`icc_ranking/`).

### Step 1 — Copy environment files

```bash
cp .env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

These files tell each service where to find the others. The defaults work as-is for local development.

### Step 2 — Install JavaScript dependencies

```bash
npm install
```

This downloads Next.js and all frontend packages into `apps/web/node_modules/`.
Equivalent of `uv sync`. Takes ~30 seconds.

### Step 3 — Rust dependencies are automatic

Unlike Python, you do **not** pre-install Rust packages manually.
`cargo run` fetches and compiles all dependencies on the first run (2–5 minutes — see Section 11).

### Step 4 — Set up the Twelfth Man chatbot (Python)

```bash
cd apps/chatbot

# Create a virtual environment using uv
uv venv env-chatbot --python 3.12

# Install dependencies
uv pip install -r requirements.txt --python env-chatbot/bin/python

# Copy and configure the environment file
cp .env.example .env
# Edit .env and add your Anthropic API key:
#   ANTHROPIC_API_KEY=sk-ant-...

cd ..
```

### Step 5 — Create the read-only PostgreSQL user

The chatbot needs a read-only database user. After starting the databases (Section 4, Terminal 1), run this once:

```bash
psql postgresql://icc:icc_secret@localhost:5432/icc_ranking -f docker/init-readonly-user.sql
```

> If using Docker PostgreSQL (port 54321), use:
> `psql postgresql://icc:icc_secret@localhost:54321/icc_ranking -f docker/init-readonly-user.sql`

---

## 4. Starting the App (Four Terminals)

Open **four separate terminal tabs or windows**. Keep all four running.

### Terminal 1 — PostgreSQL + MongoDB

```bash
# From project root
npm run docker:up
```

This pulls the PostgreSQL and MongoDB Docker images and starts them in the background.

Verify they started:

```bash
docker ps
# You should see rows with "icc_postgres" and "icc_mongo" in the NAMES column
```

**To stop them later:** `npm run docker:down`

### Terminal 2 — Rust API

```bash
npm run dev:api
# Or: cd apps/api && cargo run
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

Verify it works:

```bash
curl http://localhost:7429/health
# Expected: {"status":"ok","service":"icc-ranking-api","version":"0.1.0"}
```

### Terminal 3 — Next.js Frontend

```bash
npm run dev:web
# Or: cd apps/web && npm run dev -- --port 5237
```

When ready you will see:

```
▲ Next.js 14.x.x
- Local: http://localhost:5237
- Ready in 2.1s
```

Open **http://localhost:5237** in your browser.

### Terminal 4 — Twelfth Man AI Chatbot

```bash
cd apps/chatbot
source env-chatbot/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

> Shortcut from the project root: `npm run dev:chatbot` (uses the venv Python directly)

When ready you will see:

```
INFO     Twelfth Man ready on 0.0.0.0:8100 (router=claude-haiku-4-5-..., sql=claude-sonnet-4-...)
INFO     Uvicorn running on http://0.0.0.0:8100
```

Verify it works:

```bash
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

- **Next.js** — the frontend. Pages are in `apps/web/src/app/` (including `/chat`).
- **Rust API** — the backend. Routes are in `apps/api/src/handlers/`.
- **Twelfth Man** — AI chatbot. LangGraph agents in `apps/chatbot/app/graph/`.
- **PostgreSQL** — primary database. Tables: `teams`, `events`, `event_results`.
- **MongoDB** — stores chatbot conversation history.

---

## 6. Useful Commands

### Rust API (run from `apps/api/`)

| What | Command |
|---|---|
| Start dev server | `cargo run` |
| Start with verbose logs | `RUST_LOG=debug cargo run` |
| Build release binary | `cargo build --release` |
| Run tests | `cargo test` |
| Check for errors (no build) | `cargo check` |
| Lint | `cargo clippy -- -D warnings` |
| Add a dependency | `cargo add <crate-name>` |

> On Linux, environment variables are set inline before the command: `RUST_LOG=debug cargo run`

### Next.js (run from `apps/web/`)

| What | Command |
|---|---|
| Dev server with hot reload | `npm run dev -- --port 5237` |
| Production build | `npm run build` |
| TypeScript type check | `npm run type-check` |
| Lint | `npm run lint` |

### Twelfth Man chatbot (run from `apps/chatbot/`)

| What | Command |
|---|---|
| Start dev server | `npm run dev:chatbot` (from project root) |
| Activate venv | `source env-chatbot/bin/activate` |
| Run tests | `env -u PYTHONPATH env-chatbot/bin/python -m pytest tests/ -v` |
| Run tests with coverage | `env -u PYTHONPATH env-chatbot/bin/python -m pytest tests/ -v --cov=app --cov-report=term-missing` |
| Install new dependency | `uv pip install <package> --python env-chatbot/bin/python` |

### Docker / Databases (run from project root)

| What | Command |
|---|---|
| Start databases | `npm run docker:up` |
| Stop databases | `npm run docker:down` |
| Check running containers | `docker ps` |
| Open PostgreSQL shell | `psql postgresql://icc:icc_secret@localhost:5432/icc_ranking` |
| Open MongoDB shell | `docker exec -it icc_mongo mongosh icc_ranking` |

---

## 7. Resetting the Database

If you want to wipe all data and re-seed from scratch:

```bash
# Stop containers
npm run docker:down

# Delete the data volumes
docker volume rm docker_postgres_data docker_mongo_data

# Restart databases
npm run docker:up

# Re-create the read-only user (after PostgreSQL is healthy)
psql postgresql://icc:icc_secret@localhost:5432/icc_ranking -f docker/init-readonly-user.sql

# Then restart the API — it will re-seed automatically
# (back in Terminal 2, stop with Ctrl+C, then run cargo run again)
```

---

## 8. Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `cargo: command not found` | Rust not on PATH | Run `source $HOME/.cargo/env` or reopen terminal |
| `cargo run` sits compiling for 5 min | First-time compile — normal | Wait, do not interrupt |
| `Connection refused :7429` | API not running | Start Terminal 2 |
| `Connection refused :8100` | Chatbot not running | Start Terminal 4 |
| `ANTHROPIC_API_KEY` error | Missing API key | Edit `apps/chatbot/.env` and set your key |
| `uv: command not found` | uv not installed | Run `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| PostgreSQL connection refused | Docker not running | Run `npm run docker:up` and wait for healthy |
| `npm: command not found` | Node.js not installed | Install via NodeSource (Section 2B) |
| Page shows "Network Error" | API URL wrong in env file | Check `apps/web/.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:7429` |
| Chat shows "couldn't reach chatbot" | Chatbot not running or wrong port | Start Terminal 4, check `NEXT_PUBLIC_CHATBOT_URL` |
| `permission denied` running Docker | User not in docker group | Run `sudo usermod -aG docker $USER`, then log out and back in |
| `ModuleNotFoundError` in chatbot | Wrong Python or venv not active | Use `env -u PYTHONPATH env-chatbot/bin/python` |

---

## 9. File Structure Quick Reference

```
icc_ranking/
├── apps/
│   ├── api/                  ← Rust backend
│   │   ├── Cargo.toml        ← like pyproject.toml
│   │   ├── migrations/       ← PostgreSQL schema migrations
│   │   └── src/
│   │       ├── main.rs       ← entry point (like main.py)
│   │       ├── scoring.rs    ← point calculation logic
│   │       ├── models/       ← data shapes (like Pydantic models)
│   │       ├── handlers/     ← route logic (like FastAPI route functions)
│   │       └── seed/         ← database seeder (runs once on startup)
│   └── web/                  ← Next.js frontend
│       └── src/
│           ├── app/          ← pages (file = route, like Flask blueprints)
│           │   └── chat/     ← Twelfth Man chat page
│           ├── components/   ← reusable UI pieces
│           │   └── chat/     ← chat message, chart, view components
│           ├── lib/          ← API client, chatbot client, utilities
│           └── types/        ← TypeScript types (like Pydantic, read-only)
├── apps/chatbot/               ← Python chatbot service (YOU ARE HERE if Python dev)
│   ├── app/
│   │   ├── main.py           ← FastAPI entry point
│   │   ├── config.py         ← settings (reads .env)
│   │   ├── models.py         ← Pydantic request/response models
│   │   ├── db/               ← PostgreSQL + MongoDB connections
│   │   ├── graph/            ← LangGraph agents and prompts
│   │   └── guardrails/       ← SQL validation, safety checks
│   ├── tests/                ← pytest suite (132 tests)
│   ├── requirements.txt
│   └── .env                  ← your Anthropic API key goes here
└── docker/
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

The `target/` folder holds the compiled output — it can grow to 1–3 GB. This is normal.
It is already in `.gitignore` so it will never be committed.

> On slow machines or VMs, the first compile may take longer. Do not interrupt `cargo run` mid-compile
> — it will appear frozen but is working. You can watch CPU usage to confirm.

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
