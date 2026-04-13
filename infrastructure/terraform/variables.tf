# infrastructure/terraform/variables.tf

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "icc-rankings"
}

variable "domain_name" {
  description = "Root domain (e.g. darshil-ai.com) — used for CORS allowed origins"
  type        = string
  default     = "darshil-ai.com"
}

variable "neon_database_url" {
  description = "Neon PostgreSQL pooled connection URL (for Rust API Lambda)"
  type        = string
  sensitive   = true
  # Format: postgresql://icc_owner:<pass>@<host>-pooler.neon.tech/icc_ranking?sslmode=require
}

variable "neon_readonly_database_url" {
  description = "Neon PostgreSQL pooled connection URL for read-only user (for chatbot Lambda)"
  type        = string
  sensitive   = true
  # Format: postgresql://icc_readonly:icc_readonly_secret@<host>-pooler.neon.tech/icc_ranking?sslmode=require
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Twelfth Man chatbot"
  type        = string
  sensitive   = true
}

variable "service_api_token" {
  description = "Internal PSK between Next.js and chatbot (run: openssl rand -hex 32)"
  type        = string
  sensitive   = true
}
