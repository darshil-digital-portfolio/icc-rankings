#!/usr/bin/env bash
# infrastructure/scripts/migrate-postgres-to-neon.sh
#
# Migrates local PostgreSQL data to Neon using COPY protocol (bypasses pg_dump).
#
# Strategy:
#   Step 1 — Apply schema to Neon by running the Rust API once (sqlx migrations)
#   Step 2 — Stream each table's data from local → Neon via COPY TO STDOUT | COPY FROM STDIN
#   Step 3 — Create read-only user on Neon
#
# Prerequisites:
#   - Local PostgreSQL running with seeded data on port 5432
#   - psql installed locally
#   - Neon project created
#   - API binary built: cargo build --manifest-path apps/api/Cargo.toml
#
# Usage:
#   export LOCAL_DB_URL="postgresql://icc:icc_secret@localhost:5432/icc_ranking"
#   export NEON_DB_URL="postgresql://neondb_owner:<pass>@<host>.neon.tech/neondb?sslmode=require"
#   bash infrastructure/scripts/migrate-postgres-to-neon.sh

set -euo pipefail

LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://icc:icc_secret@localhost:5432/icc_ranking}"
NEON_DB_URL="${NEON_DB_URL:?Set NEON_DB_URL to your Neon direct connection string}"

echo "=== Step 1: Apply schema to Neon via sqlx migrations ==="
echo "In another terminal, run the API against Neon to apply migrations:"
echo ""
echo "  DATABASE_URL=\"${NEON_DB_URL}\" SEED_ON_STARTUP=false cargo run --manifest-path apps/api/Cargo.toml"
echo ""
echo "Wait for 'Listening on 0.0.0.0:7429', then Ctrl+C it."
echo ""
read -r -p "Press ENTER once the API has started and you've stopped it..."

# Verify schema exists on Neon
TABLE_COUNT=$(psql "${NEON_DB_URL}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='teams';" | tr -d ' \n')
if [ "${TABLE_COUNT}" -eq 0 ]; then
  echo "ERROR: 'teams' table not found on Neon. Migrations may not have run."
  exit 1
fi
echo "Schema verified on Neon."

echo "=== Step 2: Copy data table-by-table (LOCAL → Neon) ==="
# Order matters: parent tables before tables with FK references
TABLES=("teams" "events" "event_results" "venues" "players")

for TABLE in "${TABLES[@]}"; do
  echo -n "  Copying ${TABLE}... "
  ROW_COUNT=$(psql "${LOCAL_DB_URL}" -t -c "SELECT count(*) FROM public.${TABLE};" | tr -d ' \n')
  if [ "${ROW_COUNT}" -eq 0 ]; then
    echo "skipped (0 rows)"
    continue
  fi
  psql "${LOCAL_DB_URL}" -c "COPY public.${TABLE} TO STDOUT" | psql "${NEON_DB_URL}" -c "COPY public.${TABLE} FROM STDIN"
  echo "${ROW_COUNT} rows copied"
done

echo "=== Step 3: Create read-only user on Neon ==="
psql "${NEON_DB_URL}" << 'SQL'
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
SQL

echo "=== Step 4: Verify row counts ==="
psql "${NEON_DB_URL}" -c "
SELECT 'teams' as tbl, count(*) FROM public.teams
UNION ALL SELECT 'events', count(*) FROM public.events
UNION ALL SELECT 'event_results', count(*) FROM public.event_results;
"

echo "=== Migration complete! ==="
