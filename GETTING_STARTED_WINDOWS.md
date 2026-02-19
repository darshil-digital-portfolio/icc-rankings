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
| MongoDB (pymongo) | MongoDB (mongodb crate) | same database, different driver |

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

### C. Docker Desktop

Used to run MongoDB without installing it directly on your machine.

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
`cargo run` fetches and compiles all dependencies on the first run (2–5 minutes — see Section 10).

---

## 4. Starting the App (Three Terminals)

Open **three separate PowerShell windows**. Keep all three running.

### Terminal 1 — MongoDB

```powershell
# From project root
npm run docker:up
```

This pulls the MongoDB Docker image and starts the container in the background.

Verify it started:
```powershell
docker ps
# You should see a row with "icc_mongo"
```

**To stop it later:** `npm run docker:down`

### Terminal 2 — Rust API

```powershell
cd apps\api
cargo run
```

**First run:** Rust downloads and compiles ~60 packages. Takes 2–5 minutes — this is expected (see Section 10).
**All subsequent runs:** ~5 seconds.

When ready you will see:

```
INFO icc_ranking_api: Connected to MongoDB db="icc_ranking"
INFO icc_ranking_api: Seeding historical ICC data…
INFO icc_ranking_api: Seeding complete
INFO icc_ranking_api: Listening addr="0.0.0.0:7429"
```

The "Seeding" lines mean all historical ICC data has been loaded into MongoDB automatically.
**It only seeds once** — restarts will say "Database already seeded – skipping".

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

---

## 5. What Each Part Does

```
Browser  →  http://localhost:5237
                    │
             Next.js (frontend)
             renders pages, fetches data from API
                    │
             Rust API  →  http://localhost:7429
             runs queries, returns JSON
                    │
             MongoDB  →  localhost:47017
             stores teams, events, points
             (seeded automatically on first API boot)
```

- **Next.js** — the frontend. Think Jinja2 + React. Pages are in `apps\web\src\app\`.
- **Rust API** — the backend. Think FastAPI written in Rust. Routes are in `apps\api\src\handlers\`.
- **MongoDB** — the database. Collections: `teams`, `events`, `event_results`.

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

### Docker / MongoDB (run from project root)

| What | Command |
|---|---|
| Start MongoDB | `npm run docker:up` |
| Stop MongoDB | `npm run docker:down` |
| Check running containers | `docker ps` |
| Open MongoDB shell | `docker exec -it icc_mongo mongosh icc_ranking` |

---

## 7. Resetting the Database

If you want to wipe all data and re-seed from scratch:

```powershell
# Stop containers
npm run docker:down

# Delete the data volume
docker volume rm icc_ranking_mongo_data

# Restart MongoDB
npm run docker:up

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
| `MongoError: connect ECONNREFUSED` | MongoDB container not running | Run `npm run docker:up` |
| `npm: command not found` | Node.js not installed or shell not restarted | Install Node LTS, reopen PowerShell |
| Page shows "Network Error" | API URL wrong in env file | Check `apps\web\.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:7429` |
| Seed data missing | API started before MongoDB was ready | Stop API (`Ctrl+C`), wait for `docker ps` to show `icc_mongo`, run `cargo run` again |
| `docker: command not found` | Docker Desktop not running | Open Docker Desktop from Start Menu and wait for it to start |

---

## 9. File Structure Quick Reference

```
icc_ranking\
├── apps\
│   ├── api\                  ← Rust backend
│   │   ├── Cargo.toml        ← like pyproject.toml
│   │   └── src\
│   │       ├── main.rs       ← entry point (like main.py)
│   │       ├── scoring.rs    ← point calculation logic
│   │       ├── models\       ← data shapes (like Pydantic models)
│   │       ├── handlers\     ← route logic (like FastAPI route functions)
│   │       └── seed\         ← database seeder (runs once on startup)
│   └── web\                  ← Next.js frontend
│       └── src\
│           ├── app\          ← pages (file = route, like Flask blueprints)
│           ├── components\   ← reusable UI pieces
│           ├── lib\          ← API client, utilities
│           └── types\        ← TypeScript types (like Pydantic, read-only)
└── docker\
    └── docker-compose.yml    ← spins up MongoDB
```

---

## 10. Key Concept: Why Rust Compiles First

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

## 11. Port Reference

| Service | Address |
|---|---|
| Web (Next.js) | http://localhost:**5237** |
| API (Rust) | http://localhost:**7429** |
| MongoDB (host) | localhost:**47017** |
