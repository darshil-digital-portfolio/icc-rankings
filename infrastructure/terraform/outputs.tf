# infrastructure/terraform/outputs.tf

output "api_lambda_url" {
  description = "Rust API Lambda Function URL — set as NEXT_PUBLIC_API_URL in Vercel"
  value       = aws_lambda_function_url.api.function_url
}

output "chatbot_lambda_url" {
  description = "Chatbot Lambda Function URL — set as NEXT_PUBLIC_CHATBOT_URL and INTERNAL_CHATBOT_URL in Vercel"
  value       = aws_lambda_function_url.chatbot.function_url
}

output "api_ecr_url" {
  description = "ECR repository URL for the Rust API image"
  value       = aws_ecr_repository.api.repository_url
}

output "chatbot_ecr_url" {
  description = "ECR repository URL for the chatbot image"
  value       = aws_ecr_repository.chatbot.repository_url
}

output "conversations_table_name" {
  description = "DynamoDB conversations table name"
  value       = aws_dynamodb_table.conversations.name
}

output "users_table_name" {
  description = "DynamoDB users table name"
  value       = aws_dynamodb_table.users.name
}

output "aws_account_id" {
  description = "Your AWS account ID (needed for ECR login command)"
  value       = data.aws_caller_identity.current.account_id
}

output "ecr_login_command" {
  description = "Run this to authenticate Docker to ECR before pushing images"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}
