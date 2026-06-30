###############################################################################
# NAT instance — a small EC2 (Graviton) acting as the egress NAT for the
# private subnets. Cheaper than a managed NAT Gateway and can be STOPPED to
# drop cost to ~$0 (it has no Elastic IP; the public IP is auto-assigned and
# changes on restart, which is harmless — routes target the stable ENI).
###############################################################################

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM: SSM access only (no SSH key, no inbound).
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "nat" {
  name               = "${var.name_prefix}-nat"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.nat.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "nat" {
  name = "${var.name_prefix}-nat"
  role = aws_iam_role.nat.name
}

# Security group: accept any traffic from inside the VPC (it forwards
# arbitrary outbound from the private subnets); allow all egress.
resource "aws_security_group" "nat" {
  name        = "${var.name_prefix}-nat"
  description = "NAT instance - forwards VPC egress to the internet"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name_prefix}-nat" })

  ingress {
    description = "All traffic from within the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    description = "All outbound to the internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Enable IP forwarding + iptables MASQUERADE, persisted across stop/start.
# (user_data does not re-run on stop/start, so the rules must be saved.)
locals {
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-nat.conf
    sysctl -p /etc/sysctl.d/99-nat.conf
    IFACE=$(ip route show default | awk '/default/ {print $5; exit}')
    dnf install -y iptables-services
    iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE
    iptables -A FORWARD -i "$IFACE" -o "$IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT
    iptables -A FORWARD -i "$IFACE" -j ACCEPT
    service iptables save
    systemctl enable iptables
  EOF
}

resource "aws_instance" "nat" {
  ami                         = data.aws_ami.al2023_arm.id
  instance_type               = var.instance_type
  subnet_id                   = var.public_subnet_id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  iam_instance_profile        = aws_iam_instance_profile.nat.name
  associate_public_ip_address = true

  # CRITICAL: a NAT must forward packets not addressed to itself.
  source_dest_check = false

  user_data                   = local.user_data
  user_data_replace_on_change = true

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat" })
}
