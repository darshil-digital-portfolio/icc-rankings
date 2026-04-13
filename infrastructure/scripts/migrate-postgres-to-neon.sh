#!/usr/bin/env bash
# infrastructure/scripts/migrate-postgres-to-neon.sh
#
# Dumps local PostgreSQL and restores to Neon.
# Run from your local machine after completing Neon setup (docs/aws/01-neon-setup.md).
#
# Prerequisites:
#   - Local PostgreSQL running (npm run docker:up)
#   - pg_dump and psql installed locally
#   - Neon project created and connection strings ready
#
# Usage:
#   export LOCAL_DB_URL="postgresql://icc:icc_secret@localhost:54321/icc_ranking"
#   export NEON_DB_URL="postgresql://icc_owner:<pass>@<host>.neon.tech/icc_ranking?sslmode=require"
#   bash infrastructure/scripts/migrate-postgres-to-neon.sh

set -euo pipefail

LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://icc:icc_secret@localhost:54321/icc_ranking}"
NEON_DB_URL="${NEON_DB_URL:?Set NEON_DB_URL to your Neon direct connection string}"
DUMP_FILE="/tmp/icc_ranking_$(date +%Y%m%d_%H%M%S).dump"

echo "=== Step 1: Dump local PostgreSQL ==="
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  "${LOCAL_DB_URL}" \
  -f "${DUMP_FILE}"
echo "Dump saved: ${DUMP_FILE}"

echo "=== Step 2: Restore to Neon ==="
pg_restore \
  --dburl="${NEON_DB_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  "${DUMP_FILE}"

echo "=== Step 3: Create read-only user on Neon ==="
psql "${NEON_DB_URL}" << 'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'icc_readonly') THEN
    CREATE ROLE icc_readonly LOGIN PASSWORD 'icc_readonly_secret';
  END IF;
END
$$;
GRANT CONNECT ON DATABASE icc_ranking TO icc_readonly;
GRANT USAGE ON SCHEMA public TO icc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO icc_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO icc_readonly;
SQL

echo "=== Step 4: Verify row counts ==="
psql "${NEON_DB_URL}" -c "
SELECT 'teams' as tbl, count(*) FROM teams
UNION ALL SELECT 'events', count(*) FROM events
UNION ALL SELECT 'event_results', count(*) FROM event_results;
"

echo "=== Migration complete! Cleanup: rm ${DUMP_FILE} ==="
