locals {
  prefix = "${var.project}-${var.environment}"
}

# ── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.prefix}-igw" }
}

# ── Subnets ──────────────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.prefix}-public-${count.index + 1}" }
}

resource "aws_subnet" "private_app" {
  count             = length(var.private_app_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_app_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${local.prefix}-private-app-${count.index + 1}" }
}

resource "aws_subnet" "private_data" {
  count             = length(var.private_data_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_data_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${local.prefix}-private-data-${count.index + 1}" }
}

# ── NAT instance (stoppable, replaces managed NAT Gateways for cost control) ─
# A managed NAT Gateway bills hourly even while stopped (it can't be stopped
# at all). This EC2-based NAT can be stopped nightly via the infra-stop
# workflow, dropping its cost to ~$0 outside the 9AM-9PM IST service window.

module "nat" {
  source = "../nat-instance"

  name_prefix      = local.prefix
  vpc_id           = aws_vpc.main.id
  vpc_cidr_block   = var.vpc_cidr
  public_subnet_id = aws_subnet.public[0].id
  instance_type    = var.nat_instance_type
}

# ── Route Tables ──────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.prefix}-rt-public" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_app" {
  count  = length(var.private_app_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = module.nat.primary_eni_id
  }

  tags = { Name = "${local.prefix}-rt-private-app-${count.index + 1}" }
}

resource "aws_route_table_association" "private_app" {
  count          = length(aws_subnet.private_app)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

resource "aws_route_table" "private_data" {
  count  = length(var.private_data_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = module.nat.primary_eni_id
  }

  tags = { Name = "${local.prefix}-rt-private-data-${count.index + 1}" }
}

resource "aws_route_table_association" "private_data" {
  count          = length(aws_subnet.private_data)
  subnet_id      = aws_subnet.private_data[count.index].id
  route_table_id = aws_route_table.private_data[count.index].id
}

# ── Security Groups ───────────────────────────────────────────────────────────

resource "aws_security_group" "lambda" {
  name        = "${local.prefix}-lambda-sg"
  description = "Backend Lambda (VPC-attached) egress"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.prefix}-lambda-sg" }
}

resource "aws_security_group" "rds" {
  name        = "${local.prefix}-rds-sg"
  description = "Allow PostgreSQL from the backend Lambda only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from backend Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.prefix}-rds-sg" }
}
