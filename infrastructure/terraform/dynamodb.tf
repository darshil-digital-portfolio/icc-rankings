# infrastructure/terraform/dynamodb.tf

# ── Conversations table ────────────────────────────────────────────────────────
# Replaces MongoDB `conversations` collection.
# PK: session_id (UUID, unique per conversation)
# GSI: user_id → updated_at (list a user's sessions newest first)
# TTL: DynamoDB auto-deletes items after 90 days (replaces manual cleanup job)

resource "aws_dynamodb_table" "conversations" {
  name         = "${var.project_name}-conversations"
  billing_mode = "PAY_PER_REQUEST" # $0 for hobby; no capacity planning needed
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S" # ISO 8601 string — sorts lexicographically = chronologically
  }

  global_secondary_index {
    name            = "user_id-updated_at-index"
    hash_key        = "user_id"
    range_key       = "updated_at"
    projection_type = "INCLUDE"
    non_key_attributes = ["session_id", "messages", "created_at"]
  }

  ttl {
    attribute_name = "ttl" # Unix timestamp; DynamoDB deletes expired items automatically
    enabled        = true
  }

  tags = { Name = "${var.project_name}-conversations" }
}

# ── Users table ────────────────────────────────────────────────────────────────
# Replaces MongoDB `users` collection.
# PK: google_sub (unique Google account identifier)

resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "google_sub"

  attribute {
    name = "google_sub"
    type = "S"
  }

  tags = { Name = "${var.project_name}-users" }
}
