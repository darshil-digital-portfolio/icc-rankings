# infrastructure/terraform/main.tf

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # State is stored locally. Never commit terraform.tfstate.
  # For a team setup, migrate to S3 backend — see terraform-quickstart.md.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "icc-rankings"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
