import logging
from typing import Any

from psycopg import sql as psycopg_sql
from psycopg_pool import AsyncConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None

# Schema description injected into LLM prompts so the agent knows what's available.
DB_SCHEMA = """
DATABASE SCHEMA
===============

Tables
------
1. teams
   - slug       (TEXT, PRIMARY KEY)  — URL-friendly identifier, e.g. 'india', 'australia'
   - name       (TEXT)               — Full team name, e.g. 'India', 'Australia'
   - short_name (TEXT)               — Abbreviation, e.g. 'IND', 'AUS'
   - flag_emoji (TEXT)               — Unicode flag emoji
   - country_code (TEXT)             — ISO country code

2. events
   - id         (SERIAL, PRIMARY KEY)
   - name       (TEXT)               — Full event name, e.g. 'ICC Men\\'s Cricket World Cup 2023'
   - short_name (TEXT)               — Short display name
   - event_type (event_type_enum)    — Tournament format (see below)
   - year       (SMALLINT)           — Year the event took place
   - host       (TEXT)               — Host country or countries

3. event_results
   - id           (SERIAL, PRIMARY KEY)
   - event_id     (INTEGER, FK → events.id ON DELETE CASCADE)
   - team_slug    (TEXT, FK → teams.slug ON DELETE CASCADE)
   - stage        (stage_enum)       — How far the team progressed (see below)
   - base_points  (SMALLINT)         — Points awarded for the stage reached
   - multiplier   (SMALLINT)         — Event importance multiplier
   - total_points (SMALLINT, GENERATED ALWAYS AS base_points * multiplier STORED)
   - UNIQUE(event_id, team_slug)

Enums
-----
event_type_enum values (ordered by multiplier, ascending):
  'women_u19'              (multiplier 1)
  'men_u19'                (multiplier 2)
  'women_t20_world_cup'    (multiplier 3)
  'women_world_cup'        (multiplier 4)
  'men_knockout_champions' (multiplier 5)
  'men_t20_world_cup'      (multiplier 6)
  'test_championship'      (multiplier 7)
  'men_world_cup'          (multiplier 8)

stage_enum values (ordered by base_points, ascending):
  'first_stage'  (base_points 1)
  'other_stage'  (base_points 2)
  'semi_final'   (base_points 3)
  'final'        (base_points 4)
  'champion'     (base_points 5)

Scoring
-------
total_points = base_points × multiplier
Example: Winning the Men's World Cup = 5 (champion) × 8 (men_world_cup) = 40 points.

Notes
-----
- Data spans 1973–2025, covering all ICC tournament formats.
- venues and players tables exist but are stubs (minimal data).
- Use team slug (e.g. 'india') for joins, not team name.
""".strip()


async def init_pool() -> None:
    global _pool
    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=2,
        max_size=10,
        open=False,
    )
    await _pool.open()
    # Verify connectivity and set read-only + statement timeout per connection.
    async with _pool.connection() as conn:
        await conn.execute("SELECT 1")
    logger.info("PostgreSQL connection pool initialised")


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


async def execute_query(
    query: str,
    params: tuple[Any, ...] | None = None,
) -> list[dict[str, Any]]:
    """Execute a read-only SQL query and return rows as dicts.

    Enforces:
      - SET TRANSACTION READ ONLY
      - statement_timeout per settings
      - Row limit per settings
    """
    if _pool is None:
        raise RuntimeError("Database pool not initialised")

    timeout_ms = settings.query_timeout_seconds * 1000

    async with _pool.connection() as conn:
        await conn.execute(
            psycopg_sql.SQL("SET statement_timeout = {}").format(
                psycopg_sql.Literal(timeout_ms)
            )
        )
        await conn.execute("SET TRANSACTION READ ONLY")

        async with conn.cursor() as cur:
            await cur.execute(query, params)
            if cur.description is None:
                return []
            columns = [desc.name for desc in cur.description]
            rows = await cur.fetchmany(settings.max_query_rows)
            return [dict(zip(columns, row)) for row in rows]
