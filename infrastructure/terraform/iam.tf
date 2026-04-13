# infrastructure/terraform/iam.tf

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── API Lambda Role ────────────────────────────────────────────────────────────
# The Rust API only needs to write logs. No DynamoDB access (reads PostgreSQL via Neon).

resource "aws_iam_role" "lambda_api" {
  name               = "${var.project_name}-lambda-api-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_api_logs" {
  role       = aws_iam_role.lambda_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ── Chatbot Lambda Role ────────────────────────────────────────────────────────
# The chatbot needs: logs + DynamoDB (conversations + users tables).

resource "aws_iam_role" "lambda_chatbot" {
  name               = "${var.project_name}-lambda-chatbot-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_chatbot_logs" {
  role       = aws_iam_role.lambda_chatbot.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_chatbot_dynamodb" {
  name = "${var.project_name}-chatbot-dynamodb"
  role = aws_iam_role.lambda_chatbot.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "DynamoDBTableAccess"
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ]
      Resource = [
        aws_dynamodb_table.conversations.arn,
        "${aws_dynamodb_table.conversations.arn}/index/*",
        aws_dynamodb_table.users.arn,
      ]
    }]
  })
}
