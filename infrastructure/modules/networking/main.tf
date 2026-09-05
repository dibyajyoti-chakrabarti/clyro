locals {
  prefix = "${var.project}-${var.environment}"
}

# One public subnet tier and nothing else.
#
# The previous design had three tiers (public, private-app, private-data) and a
# stoppable NAT instance to give the private tiers egress. That structure
# existed to keep Lambda and Fargate off the public internet while still
# letting them reach it. With the whole application collapsed onto a single
# instance, there is nothing left in a private subnet, so there is nothing left
# to NAT, and the NAT box was the largest always-on cost in the old estate.
#
# The instance sits in a public subnet with an Elastic IP and is protected by
# its security group rather than by subnet placement. That is a real trade: a
# misconfigured security group is now the only thing between the box and the
# internet. It is mitigated by opening nothing but 80 and 443, closing SSH
# entirely in favour of SSM Session Manager, and requiring IMDSv2 so an SSRF
# cannot be turned into credential theft.

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

# Two subnets across two AZs even though only one instance runs today. Subnets
# cannot be moved between AZs later, and several managed services refuse to
# attach to a single-AZ VPC, so the second one costs nothing now and saves a
# rebuild if this ever grows an ALB or an RDS instance.
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.prefix}-public-${count.index + 1}" }
}

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
