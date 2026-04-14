# infrastructure/terraform/lambda.tf

# ── Rust API Lambda ────────────────────────────────────────────────────────────

resource "aws_lambda_function" "api" {
  function_name = "${var.project_name}-api"
  role          = aws_iam_role.lambda_api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"

  memory_size = 256 # MB — Rust is very lean
  timeout     = 30  # seconds — API requests should be fast

  environment {
    variables = {
      DATABASE_URL    = var.neon_database_url
      API_HOST        = "0.0.0.0"
      API_PORT        = "7429"
      RUST_LOG        = "info"
      SEED_ON_STARTUP = "false" # Data already in Neon after migration
      PORT            = "7429"  # Lambda Web Adapter reads this
    }
  }

  lifecycle {
    # Image URI is managed by CI/CD (docker push + lambda update-function-code)
    # Terraform only sets the initial image; subsequent deploys bypass Terraform
    ignore_changes = [image_uri]
  }

  tags = { Name = "${var.project_name}-api" }
}

resource "aws_lambda_permission" "api_public_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE" # Public API — anyone can call it

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST"]
    allow_headers     = ["Content-Type", "Authorization"]
    max_age           = 86400
  }
}

# ── Python Chatbot Lambda ──────────────────────────────────────────────────────

resource "aws_lambda_function" "chatbot" {
  function_name = "${var.project_name}-chatbot"
  role          = aws_iam_role.lambda_chatbot.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.chatbot.repository_url}:latest"

  memory_size = 1024 # MB — Python + LangGraph + pandas needs headroom
  timeout     = 300  # 5 minutes — LangGraph multi-agent calls can take time

  environment {
    variables = {
      DATABASE_URL               = var.neon_readonly_database_url
      DYNAMO_CONVERSATIONS_TABLE = aws_dynamodb_table.conversations.name
      DYNAMO_USERS_TABLE         = aws_dynamodb_table.users.name
      ANTHROPIC_API_KEY          = var.anthropic_api_key
      SERVICE_API_TOKEN          = var.service_api_token
      APP_ENV                    = "production"
      HOST                       = "0.0.0.0"
      PORT                       = "8100" # Lambda Web Adapter reads this
    }
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = { Name = "${var.project_name}-chatbot" }
}

resource "aws_lambda_permission" "chatbot_public_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.chatbot.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_function_url" "chatbot" {
  function_name      = aws_lambda_function.chatbot.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins = [
      "https://icc-rankings.${var.domain_name}",
    ]
    allow_methods = ["GET", "POST"]
    allow_headers = ["Content-Type", "Authorization", "X-Service-Token"]
    max_age       = 86400
  }
}
