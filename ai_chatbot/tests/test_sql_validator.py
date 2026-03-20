"""Tests for the SQL guardrails validator — the most critical safety component."""

import pytest

from app.guardrails.sql_validator import SQLValidationError, validate_sql


# ──────────────────────────────────────────────────────────────────────────────
# Valid queries — should pass
# ──────────────────────────────────────────────────────────────────────────────


class TestValidQueries:
    """Queries that should pass validation and be returned (possibly modified)."""

    def test_simple_select(self):
        result = validate_sql("SELECT * FROM teams")
        assert "SELECT * FROM teams" in result
        assert "LIMIT" in result

    def test_select_with_where(self):
        result = validate_sql("SELECT name FROM teams WHERE slug = 'india'")
        assert "slug = 'india'" in result
        assert "LIMIT" in result

    def test_select_with_join(self):
        sql = (
            "SELECT t.name, er.total_points FROM event_results er "
            "JOIN teams t ON t.slug = er.team_slug"
        )
        result = validate_sql(sql)
        assert "JOIN" in result
        assert "LIMIT" in result

    def test_select_with_aggregation(self):
        sql = (
            "SELECT t.name, COUNT(*) as titles FROM event_results er "
            "JOIN teams t ON t.slug = er.team_slug "
            "WHERE er.stage = 'champion' GROUP BY t.name ORDER BY titles DESC"
        )
        result = validate_sql(sql)
        assert "GROUP BY" in result

    def test_select_with_existing_limit_within_max(self):
        result = validate_sql("SELECT * FROM teams LIMIT 10")
        assert "LIMIT 10" in result

    def test_cte_with_select(self):
        sql = (
            "WITH top_teams AS (SELECT team_slug, SUM(total_points) as pts "
            "FROM event_results GROUP BY team_slug) "
            "SELECT * FROM top_teams ORDER BY pts DESC"
        )
        result = validate_sql(sql)
        assert "WITH" in result
        assert "LIMIT" in result

    def test_select_with_subquery(self):
        sql = (
            "SELECT name FROM teams WHERE slug IN "
            "(SELECT team_slug FROM event_results WHERE stage = 'champion')"
        )
        result = validate_sql(sql)
        assert "IN" in result

    def test_trailing_semicolon_stripped(self):
        result = validate_sql("SELECT * FROM teams;")
        assert not result.endswith(";")
        assert "LIMIT" in result

    def test_whitespace_handling(self):
        result = validate_sql("  SELECT * FROM teams  ")
        assert "SELECT" in result

    def test_select_with_cast(self):
        sql = "SELECT name FROM teams WHERE slug::text = 'india'"
        result = validate_sql(sql)
        assert "::text" in result


# ──────────────────────────────────────────────────────────────────────────────
# LIMIT enforcement
# ──────────────────────────────────────────────────────────────────────────────


class TestLimitEnforcement:
    """Ensure LIMIT is always present and capped."""

    def test_adds_limit_when_missing(self):
        result = validate_sql("SELECT * FROM teams", max_rows=50)
        assert "LIMIT 50" in result

    def test_caps_excessive_limit(self):
        result = validate_sql("SELECT * FROM teams LIMIT 9999", max_rows=100)
        assert "LIMIT 100" in result

    def test_preserves_lower_limit(self):
        result = validate_sql("SELECT * FROM teams LIMIT 5", max_rows=100)
        assert "LIMIT 5" in result

    def test_default_max_rows_is_100(self):
        result = validate_sql("SELECT * FROM teams")
        assert "LIMIT 100" in result

    def test_custom_max_rows(self):
        result = validate_sql("SELECT * FROM teams", max_rows=25)
        assert "LIMIT 25" in result


# ──────────────────────────────────────────────────────────────────────────────
# Rejected queries — DML/DDL
# ──────────────────────────────────────────────────────────────────────────────


class TestBlocksDML:
    """Data modification queries must be rejected."""

    def test_insert(self):
        with pytest.raises(SQLValidationError, match="(?i)insert"):
            validate_sql("INSERT INTO teams (slug, name) VALUES ('test', 'Test')")

    def test_update(self):
        with pytest.raises(SQLValidationError):
            validate_sql("UPDATE teams SET name = 'Hack' WHERE slug = 'india'")

    def test_delete(self):
        with pytest.raises(SQLValidationError):
            validate_sql("DELETE FROM teams WHERE slug = 'india'")

    def test_drop_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("DROP TABLE teams")

    def test_alter_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("ALTER TABLE teams ADD COLUMN hacked BOOLEAN")

    def test_truncate(self):
        with pytest.raises(SQLValidationError):
            validate_sql("TRUNCATE teams")

    def test_create_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("CREATE TABLE evil (id SERIAL)")

    def test_grant(self):
        with pytest.raises(SQLValidationError):
            validate_sql("GRANT ALL ON teams TO public")

    def test_revoke(self):
        with pytest.raises(SQLValidationError):
            validate_sql("REVOKE ALL ON teams FROM icc_readonly")


# ──────────────────────────────────────────────────────────────────────────────
# Rejected queries — dangerous patterns
# ──────────────────────────────────────────────────────────────────────────────


class TestBlocksDangerousPatterns:
    """Potentially dangerous SQL patterns must be rejected."""

    def test_pg_sleep(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT pg_sleep(100)")

    def test_pg_terminate_backend(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT pg_terminate_backend(1234)")

    def test_into_temp_table(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT * INTO TEMP TABLE evil FROM teams")

    def test_copy_from(self):
        with pytest.raises(SQLValidationError):
            validate_sql("COPY teams FROM '/etc/passwd'")

    def test_chained_statement_injection(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT 1; DROP TABLE teams")

    def test_lo_import(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT lo_import('/etc/passwd')")


# ──────────────────────────────────────────────────────────────────────────────
# Rejected queries — comments (could hide malicious SQL)
# ──────────────────────────────────────────────────────────────────────────────


class TestBlocksComments:
    """SQL comments are not allowed (could hide injections)."""

    def test_single_line_comment(self):
        with pytest.raises(SQLValidationError, match="comments"):
            validate_sql("SELECT * FROM teams -- sneaky")

    def test_block_comment(self):
        with pytest.raises(SQLValidationError, match="comments"):
            validate_sql("SELECT * FROM teams /* hidden */")


# ──────────────────────────────────────────────────────────────────────────────
# Edge cases
# ──────────────────────────────────────────────────────────────────────────────


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_empty_string(self):
        with pytest.raises(SQLValidationError, match="Empty"):
            validate_sql("")

    def test_whitespace_only(self):
        with pytest.raises(SQLValidationError, match="Empty"):
            validate_sql("   ")

    def test_multiple_statements(self):
        with pytest.raises(SQLValidationError):
            validate_sql("SELECT 1; SELECT 2")

    def test_case_insensitive_dml_detection(self):
        with pytest.raises(SQLValidationError):
            validate_sql("insert INTO teams VALUES ('x', 'x', 'x', '', '')")

    def test_mixed_case_keywords(self):
        result = validate_sql("SeLeCt * FrOm teams")
        assert "teams" in result

    def test_limit_case_insensitive(self):
        result = validate_sql("SELECT * FROM teams limit 5", max_rows=100)
        assert "5" in result
