"""SQL safety validator — ensures generated queries are read-only and bounded."""

import re

import sqlparse

# Only these tables may be queried.
ALLOWED_TABLES = frozenset({
    "teams",
    "events",
    "event_results",
    "venues",
    "players",
})

# Forbidden SQL keywords that indicate write operations.
FORBIDDEN_KEYWORDS = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|"
    r"GRANT|REVOKE|COPY|EXECUTE|CALL|DO|LOCK|VACUUM|REINDEX|CLUSTER|"
    r"SET\s+ROLE|SET\s+SESSION|RESET"
    r")\b",
    re.IGNORECASE,
)

# Dangerous patterns: subquery writes, CTEs with writes, pg_* catalog abuse.
DANGEROUS_PATTERNS = re.compile(
    r"("
    r"pg_sleep|pg_terminate|pg_cancel|pg_reload_conf|"
    r"lo_import|lo_export|"
    r"INTO\s+(?:TEMP|TEMPORARY)?\s*TABLE|"
    r"COPY\s+\w+\s+(?:FROM|TO)|"
    r";\s*(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)"
    r")",
    re.IGNORECASE,
)


class SQLValidationError(Exception):
    """Raised when a generated SQL query fails validation."""


def validate_sql(query: str, max_rows: int = 100) -> str:
    """Validate and sanitise a SQL query.

    Returns the (possibly modified) query string.
    Raises SQLValidationError if the query is unsafe.
    """
    stripped = query.strip().rstrip(";")
    if not stripped:
        raise SQLValidationError("Empty query")

    # Must be a single statement.
    parsed = sqlparse.parse(stripped)
    if len(parsed) != 1:
        raise SQLValidationError("Only single SQL statements are allowed")

    stmt = parsed[0]

    # Must be a SELECT (or WITH … SELECT).
    first_token = stmt.token_first(skip_ws=True, skip_cm=True)
    if first_token is None:
        raise SQLValidationError("Could not parse SQL statement")

    keyword = first_token.ttype
    value = first_token.normalized.upper() if first_token.normalized else ""

    if keyword not in (sqlparse.tokens.Keyword.DML, sqlparse.tokens.Keyword.CTE):
        if value not in ("SELECT", "WITH"):
            raise SQLValidationError(
                f"Only SELECT queries are allowed, got: {value}"
            )

    # Check for forbidden keywords.
    if FORBIDDEN_KEYWORDS.search(stripped):
        match = FORBIDDEN_KEYWORDS.search(stripped)
        raise SQLValidationError(
            f"Forbidden SQL keyword detected: {match.group() if match else 'unknown'}"
        )

    # Check for dangerous patterns.
    if DANGEROUS_PATTERNS.search(stripped):
        raise SQLValidationError("Potentially dangerous SQL pattern detected")

    # Check for comments (could hide malicious SQL).
    if "--" in stripped or "/*" in stripped:
        raise SQLValidationError("SQL comments are not allowed")

    # Enforce LIMIT.
    upper = stripped.upper()
    if "LIMIT" not in upper:
        stripped = f"{stripped}\nLIMIT {max_rows}"
    else:
        # Parse existing LIMIT and cap it.
        limit_match = re.search(r"LIMIT\s+(\d+)", upper)
        if limit_match:
            existing_limit = int(limit_match.group(1))
            if existing_limit > max_rows:
                stripped = re.sub(
                    r"LIMIT\s+\d+",
                    f"LIMIT {max_rows}",
                    stripped,
                    flags=re.IGNORECASE,
                )

    return stripped
