#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time data migration: MongoDB → PostgreSQL
#
# Prerequisites:
#   - MongoDB running on localhost:47017 (docker container icc_mongo)
#   - PostgreSQL running on localhost:5432 with user icc / db icc_ranking
#   - Schema already migrated (sqlx migrate run)
#   - mongosh and psql available
#
# Usage:
#   chmod +x scripts/migrate-mongo-to-postgres.sh
#   ./scripts/migrate-mongo-to-postgres.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MONGO_URI="mongodb://localhost:47017/icc_ranking"
PG_CONN="postgresql://icc:icc_secret@localhost:5432/icc_ranking"

echo "=== MongoDB → PostgreSQL Migration ==="
echo ""

# ── 1. Check connectivity ─────────────────────────────────────────────────────
echo "[1/5] Checking MongoDB connectivity..."
mongosh "$MONGO_URI" --quiet --eval "db.teams.countDocuments()" > /dev/null 2>&1 \
    || { echo "ERROR: Cannot connect to MongoDB at $MONGO_URI"; exit 1; }

echo "[1/5] Checking PostgreSQL connectivity..."
psql "$PG_CONN" -c "SELECT 1" > /dev/null 2>&1 \
    || { echo "ERROR: Cannot connect to PostgreSQL at $PG_CONN"; exit 1; }

echo "  Both databases reachable."

# ── 2. Export from MongoDB ────────────────────────────────────────────────────
TMPDIR=$(mktemp -d)
echo ""
echo "[2/5] Exporting data from MongoDB..."

# Export teams
mongosh "$MONGO_URI" --quiet --eval '
    db.teams.find({}, {_id: 0, slug: 1, name: 1, short_name: 1, flag_emoji: 1, country_code: 1})
        .forEach(t => print(JSON.stringify(t)))
' > "$TMPDIR/teams.jsonl"
TEAM_COUNT=$(wc -l < "$TMPDIR/teams.jsonl")
echo "  Teams exported: $TEAM_COUNT"

# Export events (with their MongoDB _id for result mapping)
mongosh "$MONGO_URI" --quiet --eval '
    db.events.find({}).sort({year: 1}).forEach(e => {
        print(JSON.stringify({
            mongo_id: e._id.toString(),
            name: e.name,
            short_name: e.short_name,
            event_type: e.event_type,
            year: e.year,
            host: e.host
        }))
    })
' > "$TMPDIR/events.jsonl"
EVENT_COUNT=$(wc -l < "$TMPDIR/events.jsonl")
echo "  Events exported: $EVENT_COUNT"

# Export event_results (with mongo ObjectId refs we'll map later)
mongosh "$MONGO_URI" --quiet --eval '
    db.event_results.find({}).forEach(r => {
        print(JSON.stringify({
            event_mongo_id: r.event_id.toString(),
            team_mongo_id: r.team_id.toString(),
            stage: r.stage,
            base_points: r.base_points,
            multiplier: r.multiplier
        }))
    })
' > "$TMPDIR/results.jsonl"
RESULT_COUNT=$(wc -l < "$TMPDIR/results.jsonl")
echo "  Results exported: $RESULT_COUNT"

# Export team mongo_id → slug mapping
mongosh "$MONGO_URI" --quiet --eval '
    db.teams.find({}, {_id: 1, slug: 1}).forEach(t => {
        print(JSON.stringify({mongo_id: t._id.toString(), slug: t.slug}))
    })
' > "$TMPDIR/team_map.jsonl"

# ── 3. Clear PostgreSQL tables (in case of re-run) ────────────────────────────
echo ""
echo "[3/5] Clearing PostgreSQL tables..."
psql "$PG_CONN" --quiet -c "TRUNCATE event_results, events, teams CASCADE;"
echo "  Tables truncated."

# ── 4. Import into PostgreSQL ─────────────────────────────────────────────────
echo ""
echo "[4/5] Importing data into PostgreSQL..."

# Import teams
python3 -c "
import json, subprocess

with open('$TMPDIR/teams.jsonl') as f:
    teams = [json.loads(line) for line in f if line.strip()]

values = []
for t in teams:
    slug = t['slug'].replace(\"'\", \"''\")
    name = t['name'].replace(\"'\", \"''\")
    short = t['short_name'].replace(\"'\", \"''\")
    flag = t['flag_emoji'].replace(\"'\", \"''\")
    cc = t['country_code'].replace(\"'\", \"''\")
    values.append(f\"('{slug}', '{name}', '{short}', '{flag}', '{cc}')\")

sql = 'INSERT INTO teams (slug, name, short_name, flag_emoji, country_code) VALUES ' + ',\n'.join(values) + ' ON CONFLICT (slug) DO NOTHING;'
subprocess.run(['psql', '$PG_CONN', '--quiet', '-c', sql], check=True)
print(f'  Teams imported: {len(teams)}')
"

# Import events and build mongo_id → pg_id map
python3 -c "
import json, subprocess

with open('$TMPDIR/events.jsonl') as f:
    events = [json.loads(line) for line in f if line.strip()]

# Insert events one by one to get RETURNING id
id_map = {}
for e in events:
    name = e['name'].replace(\"'\", \"''\")
    short = e['short_name'].replace(\"'\", \"''\")
    host = e['host'].replace(\"'\", \"''\")
    sql = f\"INSERT INTO events (name, short_name, event_type, year, host) VALUES ('{name}', '{short}', '{e['event_type']}', {e['year']}, '{host}') RETURNING id;\"
    result = subprocess.run(['psql', '$PG_CONN', '--quiet', '-t', '-c', sql], capture_output=True, text=True, check=True)
    pg_id = int(result.stdout.strip())
    id_map[e['mongo_id']] = pg_id

# Save the map
with open('$TMPDIR/event_id_map.json', 'w') as f:
    json.dump(id_map, f)

print(f'  Events imported: {len(events)}')
"

# Import results
python3 -c "
import json, subprocess

with open('$TMPDIR/results.jsonl') as f:
    results = [json.loads(line) for line in f if line.strip()]

with open('$TMPDIR/event_id_map.json') as f:
    event_map = json.load(f)

with open('$TMPDIR/team_map.jsonl') as f:
    team_map = {}
    for line in f:
        if line.strip():
            t = json.loads(line)
            team_map[t['mongo_id']] = t['slug']

values = []
skipped = 0
for r in results:
    event_id = event_map.get(r['event_mongo_id'])
    team_slug = team_map.get(r['team_mongo_id'])
    if event_id is None or team_slug is None:
        skipped += 1
        continue
    stage = r['stage']
    bp = r['base_points']
    mult = r['multiplier']
    slug_escaped = team_slug.replace(\"'\", \"''\")
    values.append(f\"({event_id}, '{slug_escaped}', '{stage}', {bp}, {mult})\")

# Batch insert
batch_size = 100
for i in range(0, len(values), batch_size):
    batch = values[i:i+batch_size]
    sql = 'INSERT INTO event_results (event_id, team_slug, stage, base_points, multiplier) VALUES ' + ',\n'.join(batch) + ' ON CONFLICT (event_id, team_slug) DO NOTHING;'
    subprocess.run(['psql', '$PG_CONN', '--quiet', '-c', sql], check=True)

print(f'  Results imported: {len(values)} (skipped: {skipped})')
"

# ── 5. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "[5/5] Verifying migration..."
psql "$PG_CONN" --quiet -c "
    SELECT 'teams' AS table_name, COUNT(*) AS rows FROM teams
    UNION ALL
    SELECT 'events', COUNT(*) FROM events
    UNION ALL
    SELECT 'event_results', COUNT(*) FROM event_results
    ORDER BY table_name;
"

echo ""
echo "=== Migration complete! ==="
echo "Temp files at: $TMPDIR"

# Cleanup
rm -rf "$TMPDIR"
echo "Temp files cleaned up."
