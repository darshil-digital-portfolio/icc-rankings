# infrastructure/terraform/ecr.tf

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}/icc-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true # Allows destroy even if images exist

  image_scanning_configuration {
    scan_on_push = true # Free security scan on every push
  }

  tags = { Name = "${var.project_name}-api-repo" }
}

resource "aws_ecr_repository" "chatbot" {
  name                 = "${var.project_name}/icc-chatbot"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project_name}-chatbot-repo" }
}

# Keep only last 3 images to stay well within the 50GB always-free limit
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "chatbot" {
  repository = aws_ecr_repository.chatbot.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = { type = "expire" }
    }]
  })
}
