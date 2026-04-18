# Neon PostgreSQL Setup Guide

## What is Neon?

Neon is serverless PostgreSQL. It's the same database engine as PostgreSQL —
every query, data type, extension, and migration you wrote for local PostgreSQL
works identically on Neon. The difference: Neon pauses the compute after
5 minutes of inactivity (the database itself stays intact), then wakes up in
~1–2 seconds on the next connection. No server to manage. No monthly minimum.

## Is it actually free?

Yes, for this project. Free tier includes:
- **0.5 GB storage** (the full ICC dataset 1973–2025 is ~5–10 MB)
- **191.9 compute hours/month** (auto-suspend means you use maybe 5 min/month for hobby)
- **No credit card required**
- 1 project, 3 branches (use branches for dev/prod separation)

## Setup Steps

### 1. Create Account

Go to https://neon.tech → **Sign Up** (use GitHub or Google — no credit card needed).

### 2. Create a Project

- Click **New Project**
- Name: `icc-rankings`
- PostgreSQL version: **16**
- Region: **Asia Pacific (Singapore) (ap-southeast-1)** ← closest to India
- Skip neon auth
- Click **Create Project**

### 3. Get Your Connection Strings

After creation, Neon shows your connection details. You need two:

**Direct connection** (for migrations and the Rust API):
```
postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require
```

**Pooled connection** (for Lambda — avoids connection exhaustion):
```
postgresql://neondb_owner:<password>@<host>-pooler.neon.tech/neondb?sslmode=require
```

> Lambda creates many short-lived connections. Always use the pooled URL for
> Lambda functions. The Neon pooler handles connection reuse automatically.

Save both strings — you'll add them to `terraform.tfvars`.

### 4. Grant Schema Permissions

On a new Neon project the `neondb_owner` role may not have `CREATE` on the
public schema (PostgreSQL 15+ changed the default). Run this once in
**Neon Console → SQL Editor** before starting the API:

```sql
GRANT ALL ON SCHEMA public TO neondb_owner;
```

Without this, the Rust API fails at startup with:
`permission denied for schema public` when `sqlx` tries to create its
`_sqlx_migrations` tracking table.

### 5. Read-Only User

The `icc_readonly` role is created automatically by `migrate-postgres-to-neon.sh` (Step 3 of that script). You do not need to create it manually.

If you ever need to recreate it, run in the Neon Console → **SQL Editor**:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'icc_readonly') THEN
    CREATE ROLE icc_readonly LOGIN PASSWORD 'icc_readonly_secret';
  END IF;
  EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO icc_readonly';
END
$$;
GRANT USAGE ON SCHEMA public TO icc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO icc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO icc_readonly;
```

### 6. Neon Branches (Optional but Recommended)

Neon lets you create database branches — like git branches for your data.
- `main` branch → production
- Create a `dev` branch for local development (uses same schema, independent data)

Console → **Branches** → **New Branch** → name: `dev`
Get the `dev` branch connection string for your local `.env` files.

### 7. Connection String for the Read-Only User

Build the read-only pooled URL manually (user `icc_readonly` was created by the migration script):
```
postgresql://icc_readonly:icc_readonly_secret@<host>-pooler.neon.tech/neondb?sslmode=require
```
This goes into `neon_readonly_database_url` in `terraform.tfvars` (used by the chatbot).

### 8. Why sslmode=require?

Neon requires SSL on all connections. The `?sslmode=require` parameter is already
supported by both `sqlx` (Rust) and `psycopg` (Python). No code changes needed —
just include it in the connection string.

## What Happens When Neon Suspends?

After 5 minutes of no queries, Neon pauses compute. The data is safe (persisted to
S3-backed storage). The next connection wakes it up in ~1–2 seconds. For the Rust API,
this means the very first API call after a long idle might be 1–2 seconds slower.
For a hobby project, this is acceptable.
