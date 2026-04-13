# Terraform Quickstart

## What is Terraform?

Terraform is Infrastructure as Code — you write `.tf` files describing AWS resources
and Terraform creates/updates/destroys them. Think of it as a recipe for your cloud.

- **Provider**: Plugin for a cloud (we use `hashicorp/aws`)
- **Resource**: A thing to create (e.g. `aws_lambda_function`, `aws_dynamodb_table`)
- **State**: Terraform records what it created in `terraform.tfstate` — treat this like a database
- **Plan**: `terraform plan` previews changes (safe, no charges)
- **Apply**: `terraform apply` makes actual changes

## Install

```bash
# Via tfenv (manages multiple versions)
git clone --depth=1 https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
tfenv install 1.9.0 && tfenv use 1.9.0
terraform --version  # 1.9.0
```

## First Run

```bash
cd infrastructure/terraform

cp terraform.tfvars.example terraform.tfvars
# Fill in your secrets (never commit terraform.tfvars!)

terraform init      # Downloads AWS provider
terraform plan      # Preview — safe, no charges
terraform apply     # Creates resources — will prompt for confirmation
terraform output    # Shows Lambda URLs and other values
```

## Important Files

- `terraform.tfvars` — your secrets — **never commit this**
- `terraform.tfstate` — Terraform's memory — **never delete, never commit**
- Both are in `.gitignore` already

## Common Commands

```bash
terraform plan             # Preview changes
terraform apply            # Apply changes
terraform output           # Show output values (Lambda URLs etc.)
terraform destroy          # Destroy everything (careful!)
terraform fmt              # Format .tf files
terraform state list       # List all managed resources
```
