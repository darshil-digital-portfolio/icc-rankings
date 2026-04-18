"""Tests for check_and_increment_usage in users_dynamo.py."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from botocore.exceptions import ClientError

from app.db.users_dynamo import check_and_increment_usage


def _mock_dynamo_setup(mock_table):
    mock_ddb = AsyncMock()
    mock_ddb.Table = AsyncMock(return_value=mock_table)
    mock_resource = AsyncMock()
    mock_resource.__aenter__ = AsyncMock(return_value=mock_ddb)
    mock_resource.__aexit__ = AsyncMock(return_value=False)
    mock_session = MagicMock()
    mock_session.resource = MagicMock(return_value=mock_resource)
    return mock_session


def _client_error(code):
    return ClientError({"Error": {"Code": code, "Message": ""}}, "UpdateItem")


@pytest.mark.asyncio
async def test_under_limit_returns_true(monkeypatch):
    """Condition 1 succeeds on first call → True, call_count=1."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(return_value={})
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))

    result = await check_and_increment_usage("user123", "2026-04", 10)

    assert result is True
    assert mock_table.update_item.call_count == 1


@pytest.mark.asyncio
async def test_new_month_resets_and_returns_true(monkeypatch):
    """Condition 1 raises ConditionalCheckFailedException, Condition 2 succeeds → True, call_count=2."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(
        side_effect=[
            _client_error("ConditionalCheckFailedException"),
            {},
        ]
    )
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))

    result = await check_and_increment_usage("user123", "2026-04", 10)

    assert result is True
    assert mock_table.update_item.call_count == 2


@pytest.mark.asyncio
async def test_limit_reached_returns_false(monkeypatch):
    """Both Condition 1 and Condition 2 raise ConditionalCheckFailedException → False, call_count=4."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(
        side_effect=[
            _client_error("ConditionalCheckFailedException"),  # Condition 1, attempt 1
            _client_error("ConditionalCheckFailedException"),  # Condition 2, attempt 1
            _client_error("ConditionalCheckFailedException"),  # Condition 1, attempt 2
            _client_error("ConditionalCheckFailedException"),  # Condition 2, attempt 2
        ]
    )
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))

    result = await check_and_increment_usage("user123", "2026-04", 10)

    assert result is False
    assert mock_table.update_item.call_count == 4


@pytest.mark.asyncio
async def test_unexpected_error_on_condition1_propagates(monkeypatch):
    """Non-conditional ClientError on Condition 1 bubbles up."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(
        side_effect=_client_error("ProvisionedThroughputExceededException")
    )
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))
    from app.db.users_dynamo import check_and_increment_usage
    with pytest.raises(ClientError):
        await check_and_increment_usage("sub-abc", "2026-04", 30)


@pytest.mark.asyncio
async def test_unexpected_error_on_condition2_propagates(monkeypatch):
    """Non-conditional ClientError on Condition 2 bubbles up."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(
        side_effect=[
            _client_error("ConditionalCheckFailedException"),
            _client_error("ProvisionedThroughputExceededException"),
        ]
    )
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))
    from app.db.users_dynamo import check_and_increment_usage
    with pytest.raises(ClientError):
        await check_and_increment_usage("sub-abc", "2026-04", 30)


@pytest.mark.asyncio
async def test_concurrent_month_reset_retries_and_succeeds(monkeypatch):
    """Race at month rollover: Condition 2 loser retries Condition 1 and succeeds."""
    mock_table = AsyncMock()
    mock_table.update_item = AsyncMock(
        side_effect=[
            _client_error("ConditionalCheckFailedException"),  # Condition 1, attempt 1
            _client_error("ConditionalCheckFailedException"),  # Condition 2, attempt 1 (lost race)
            None,  # Condition 1, attempt 2 (month now reset by winner)
        ]
    )
    monkeypatch.setattr("app.db.users_dynamo._get_session", lambda: _mock_dynamo_setup(mock_table))
    from app.db.users_dynamo import check_and_increment_usage
    result = await check_and_increment_usage("sub-abc", "2026-04", 30)
    assert result is True
    assert mock_table.update_item.call_count == 3
