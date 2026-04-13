"""DynamoDB adapter for users — replaces users.py in production."""

import logging
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from app.db.dynamo import _get_session
from app.config import settings

logger = logging.getLogger(__name__)


async def get_or_create_user(
    google_sub: str,
    email: str,
    name: str,
    picture: str,
) -> dict[str, Any]:
    """Upsert user by google_sub. Returns doc with synthetic `is_new_user` key."""
    now = datetime.now(timezone.utc).isoformat()

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)

        # Attempt to insert as a new user (fails if already exists)
        try:
            await table.put_item(
                Item={
                    "google_sub": google_sub,
                    "email": email,
                    "name": name,
                    "picture": picture,
                    "preferences": {"theme": None, "event_filters": []},
                    "is_admin": False,
                    "created_at": now,
                    "updated_at": now,
                },
                ConditionExpression="attribute_not_exists(google_sub)",
            )
            resp = await table.get_item(Key={"google_sub": google_sub})
            doc = dict(resp["Item"])
            doc["is_new_user"] = True
            return doc

        except ClientError as e:
            if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise

        # Existing user — update mutable fields only
        resp = await table.update_item(
            Key={"google_sub": google_sub},
            UpdateExpression="SET email = :e, #n = :n, picture = :p, updated_at = :now",
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={
                ":e": email, ":n": name, ":p": picture, ":now": now,
            },
            ReturnValues="ALL_NEW",
        )
        doc = dict(resp["Attributes"])
        doc["is_new_user"] = False
        return doc


async def get_user(google_sub: str) -> dict[str, Any] | None:
    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)
        resp = await table.get_item(Key={"google_sub": google_sub})
        return resp.get("Item")


async def update_preferences(
    google_sub: str,
    theme: str | None = None,
    event_filters: list[str] | None = None,
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    set_parts = ["updated_at = :now"]
    expr_values: dict[str, Any] = {":now": now}
    expr_names: dict[str, str] = {}

    if theme is not None:
        set_parts.append("preferences.#theme = :theme")
        expr_names["#theme"] = "theme"
        expr_values[":theme"] = theme
    if event_filters is not None:
        set_parts.append("preferences.event_filters = :ef")
        expr_values[":ef"] = event_filters

    async with _get_session().resource("dynamodb", region_name=settings.aws_region) as ddb:
        table = await ddb.Table(settings.dynamo_users_table)
        kwargs: dict[str, Any] = {
            "Key": {"google_sub": google_sub},
            "UpdateExpression": "SET " + ", ".join(set_parts),
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW",
        }
        if expr_names:
            kwargs["ExpressionAttributeNames"] = expr_names
        resp = await table.update_item(**kwargs)
        return resp.get("Attributes")
