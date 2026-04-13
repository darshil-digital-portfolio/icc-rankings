#!/usr/bin/env python3
"""infrastructure/scripts/migrate-mongo-to-dynamodb.py

Exports conversations and users from local MongoDB → DynamoDB.
Run from your local machine with both MongoDB and AWS credentials available.

Usage:
    pip install pymongo boto3
    export MONGO_URL="mongodb://localhost:47017"
    export CONVERSATIONS_TABLE="icc-rankings-conversations"
    export USERS_TABLE="icc-rankings-users"
    export AWS_DEFAULT_REGION="ap-south-1"
    python infrastructure/scripts/migrate-mongo-to-dynamodb.py
"""

import os
import time
from datetime import datetime, timezone

import boto3
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:47017")
MONGO_DB = os.environ.get("MONGO_DB", "icc_ranking")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "ap-south-1")
CONVERSATIONS_TABLE = os.environ.get("CONVERSATIONS_TABLE", "icc-rankings-conversations")
USERS_TABLE = os.environ.get("USERS_TABLE", "icc-rankings-users")
RETENTION_DAYS = 90


def clean(doc: dict) -> dict:
    """Recursively convert MongoDB doc to DynamoDB-safe format."""
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, list):
            out[k] = [
                clean(i) if isinstance(i, dict) else
                i.isoformat() if isinstance(i, datetime) else i
                for i in v
            ]
        elif isinstance(v, dict):
            out[k] = clean(v)
        elif v is not None:
            out[k] = v
    return out


def ttl_from(updated_at: str | None) -> int:
    if updated_at:
        try:
            return int(datetime.fromisoformat(updated_at).timestamp()) + RETENTION_DAYS * 86400
        except (ValueError, TypeError):
            pass
    return int(time.time()) + RETENTION_DAYS * 86400


def migrate_conversations(mongo_db, dynamo):
    table = dynamo.Table(CONVERSATIONS_TABLE)
    coll = mongo_db["conversations"]
    total = coll.count_documents({})
    print(f"Migrating {total} conversations...")
    ok = err = 0
    for doc in coll.find({}):
        try:
            item = clean(doc)
            if "session_id" not in item:
                print(f"  SKIP (no session_id): {doc.get('_id')}")
                continue
            item.setdefault("updated_at", datetime.now(timezone.utc).isoformat())
            item["ttl"] = ttl_from(item.get("updated_at"))
            table.put_item(Item=item)
            ok += 1
            if ok % 10 == 0:
                print(f"  {ok}/{total}...")
        except Exception as e:
            err += 1
            print(f"  ERROR {doc.get('session_id', '?')}: {e}")
    print(f"Conversations: {ok} OK, {err} errors")
    return ok, err


def migrate_users(mongo_db, dynamo):
    table = dynamo.Table(USERS_TABLE)
    coll = mongo_db["users"]
    total = coll.count_documents({})
    print(f"Migrating {total} users...")
    ok = err = 0
    for doc in coll.find({}):
        try:
            item = clean(doc)
            if "google_sub" not in item:
                print(f"  SKIP (no google_sub): {doc.get('_id')}")
                continue
            item.pop("_is_new", None)  # Internal MongoDB sentinel — not needed in DynamoDB
            table.put_item(Item=item)
            ok += 1
        except Exception as e:
            err += 1
            print(f"  ERROR {doc.get('google_sub', '?')}: {e}")
    print(f"Users: {ok} OK, {err} errors")
    return ok, err


def main():
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    print("MongoDB connected.")

    print(f"Connecting to DynamoDB in {AWS_REGION}...")
    dynamo = boto3.resource("dynamodb", region_name=AWS_REGION)
    print("DynamoDB connected.\n")

    c_ok, c_err = migrate_conversations(client[MONGO_DB], dynamo)
    print()
    u_ok, u_err = migrate_users(client[MONGO_DB], dynamo)
    print(f"\n=== Done: {c_ok + u_ok} migrated, {c_err + u_err} errors ===")
    if c_err + u_err:
        exit(1)


if __name__ == "__main__":
    main()
