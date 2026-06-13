"""Deterministic monthly-cost estimator for the Step 3 canvas.

The *calculation* is deterministic (design §3.3: "calculated from a known
pricing table, not AI-generated"). The *per-unit prices* are supplied by a
``price_book`` that the Reasoning agent fills live from the awslabs Pricing MCP.
When no ``price_book`` is passed (local stub mode before the MCP is deployed, or
on an MCP failure) the calibrated ``DEFAULT_PRICE_BOOK`` is used as a fallback.

The default book is calibrated to reproduce the reference panel in the docs for
the seeded ``invoiceapp`` example (scale=small, criticality=high,
environment=production)::

    ECS Fargate (backend)     $34/month   # 1 Fargate task ($18) + public ALB ($16)
    ECS Fargate (worker)      $18/month
    RDS PostgreSQL            $45/month   # single-AZ $22.5 doubled for multi-AZ
    ElastiCache Redis         $16/month   # single-AZ $8 doubled for multi-AZ
    S3 + CloudFront           $8/month
    SQS                       $2/month
    ECR storage               $4/month
    ─────────────────────────────────
    Total                     $127/month

Switching db -> aurora_postgres moves the db line $45 -> $112 (+$67), total -> $194.

Live prices (real db.t3.small ~= $24.8/mo, etc.) will differ slightly from these
calibrated numbers — that is expected; only the fallback reproduces the doc.
"""

from __future__ import annotations

import copy
from typing import Any

from .types import Canvas, CostEstimate, CostLineItem, Intent, Overrides, PriceBook

HOURS_PER_MONTH = 730

# Deterministic instance sizing per scale tier (Step 3 §3.3 + Step 2 Q2). The
# Pricing-MCP adapter reads this to know *which* instance class to price for
# each (service, scale) pair before filling a live price book.
SIZING_BY_SCALE: dict[str, dict[str, Any]] = {
    "solo": {"fargate_vcpu": 0.25, "fargate_gb": 0.5, "rds_class": "db.t3.micro",
             "aurora_class": "db.t3.medium", "cache_node": "cache.t3.micro", "tasks": 1},
    "small": {"fargate_vcpu": 0.5, "fargate_gb": 1, "rds_class": "db.t3.small",
              "aurora_class": "db.t3.medium", "cache_node": "cache.t3.micro", "tasks": 1},
    "medium": {"fargate_vcpu": 1, "fargate_gb": 2, "rds_class": "db.t3.medium",
               "aurora_class": "db.r6g.large", "cache_node": "cache.t3.small", "tasks": 2},
    "large": {"fargate_vcpu": 2, "fargate_gb": 4, "rds_class": "db.r6g.large",
              "aurora_class": "db.r6g.large", "cache_node": "cache.r6g.large", "tasks": 3},
}

# Calibrated fallback unit prices: single-unit, single-AZ monthly cost (us-east-1).
# Same shape the live Pricing-MCP adapter produces, so it can override any subset.
DEFAULT_PRICE_BOOK: PriceBook = {
    "compute": {  # monthly per ECS task / instance, by scale
        "ecs_fargate": {"solo": 9, "small": 18, "medium": 36, "large": 72},
        "ecs_ec2": {"solo": 8, "small": 15, "medium": 30, "large": 60},
        "ec2": {"solo": 8, "small": 15, "medium": 30, "large": 60},
    },
    "database": {  # monthly per instance, single-AZ, by scale
        "rds_postgres": {"solo": 13, "small": 22.5, "medium": 60, "large": 180},
        "aurora_postgres": {"solo": 33, "small": 56, "medium": 120, "large": 300},
    },
    "cache": {  # monthly per node, single-AZ, by scale
        "elasticache": {"solo": 8, "small": 8, "medium": 25, "large": 110},
    },
    "flat": {  # usage-based, not scaled by uptime
        "s3_cloudfront": 8,
        "sqs": 2,
        "s3": 5,
    },
    "alb_monthly": 16,  # baked into a public-facing service node
    "ecr_storage_monthly": 4,  # added once when any container (image=ecr) node exists
}

# Illustrative regional price multipliers (applied on top of the price book).
REGION_MULTIPLIER: dict[str, float] = {
    "us-east-1": 1.0,
    "us-east-2": 1.0,
    "us-west-2": 1.0,
    "eu-west-1": 1.08,
    "eu-central-1": 1.10,
    "ap-south-1": 0.95,
    "ap-southeast-1": 1.07,
    "ap-northeast-1": 1.09,
}

DISPLAY_NAME: dict[str, str] = {
    "ecs_fargate": "ECS Fargate",
    "ecs_ec2": "ECS on EC2",
    "ec2": "EC2",
    "rds_postgres": "RDS PostgreSQL",
    "aurora_postgres": "Aurora PostgreSQL",
    "elasticache": "ElastiCache Redis",
    "s3_cloudfront": "S3 + CloudFront",
    "sqs": "SQS",
    "s3": "S3",
}


def merge_price_book(partial: PriceBook | None) -> PriceBook:
    """Deep-merge a (possibly partial) live price book over the calibrated
    default, so the Pricing-MCP adapter can override only the dimensions it has
    live data for and inherit the rest."""
    book = copy.deepcopy(DEFAULT_PRICE_BOOK)
    if not partial:
        return book
    for key, value in partial.items():
        if isinstance(value, dict) and isinstance(book.get(key), dict):
            for sub_key, sub_value in value.items():
                if isinstance(sub_value, dict) and isinstance(book[key].get(sub_key), dict):
                    book[key][sub_key].update(sub_value)
                else:
                    book[key][sub_key] = sub_value
        else:
            book[key] = value
    return book


def _multi_az(intent: Intent) -> bool:
    """Multi-AZ (doubles RDS + cache) only when criticality is high *and* the
    environment is production. Staging/development are always single-AZ
    (Step 2 Q7)."""
    return intent.get("criticality") == "high" and intent.get("environment") == "production"


def _effective_hours(overrides: Overrides | None) -> float:
    if not overrides:
        return HOURS_PER_MONTH
    hpd = overrides.get("hours_per_day")
    dpw = overrides.get("days_per_week")
    if hpd is None and dpw is None:
        return HOURS_PER_MONTH
    hpd = 24 if hpd is None else float(hpd)
    dpw = 7 if dpw is None else float(dpw)
    return round(hpd * dpw * 52 / 12)  # weeks/month = 52/12


def _public_service_ids(canvas: Canvas) -> set[str]:
    """Service nodes targeted by an edge from a static (frontend) node are
    public-facing and carry an ALB."""
    by_id = {n["id"]: n for n in canvas.get("nodes", [])}
    public: set[str] = set()
    for conn in canvas.get("connections", []):
        src = by_id.get(conn.get("from"))
        dst = by_id.get(conn.get("to"))
        if src and dst and src.get("type") == "static" and dst.get("type") == "service":
            public.add(dst["id"])
    return public


def estimate_cost(
    canvas: Canvas,
    intent: Intent,
    overrides: Overrides | None = None,
    price_book: PriceBook | None = None,
) -> CostEstimate:
    """Return a line-item monthly cost estimate for the canvas.

    ``price_book`` is the live book from the Pricing MCP (may be partial); when
    omitted, the calibrated ``DEFAULT_PRICE_BOOK`` is used.

    Returns::

        {
          "currency": "USD",
          "total": int,
          "line_items": [{"node_id": str|None, "label": str, "monthly": int}, ...],
          "assumptions": [str, ...],
          "price_source": "pricing_mcp" | "default",
        }
    """

    book = merge_price_book(price_book)
    scale = intent.get("scale", "small")
    multi_az = _multi_az(intent)
    region = (overrides or {}).get("region", "us-east-1")
    region_mult = REGION_MULTIPLIER.get(region, 1.0)
    eff_hours = _effective_hours(overrides)
    hour_factor = eff_hours / HOURS_PER_MONTH  # scales hourly-billed resources

    public_ids = _public_service_ids(canvas)
    tasks = SIZING_BY_SCALE.get(scale, SIZING_BY_SCALE["small"])["tasks"]

    line_items: list[CostLineItem] = []
    has_container = False

    for node in canvas.get("nodes", []):
        node_id = node.get("id")
        node_type = node.get("type")
        aws = node.get("aws_service")
        monthly = 0.0
        label = DISPLAY_NAME.get(aws, aws or node_type)

        if node_type in ("service", "worker"):
            table = book["compute"].get(aws, book["compute"]["ecs_fargate"])
            per_task = table.get(scale, table.get("small"))
            count = tasks if node_type == "service" else 1
            monthly = per_task * count
            if node_id in public_ids:
                monthly += book["alb_monthly"]  # public-facing service fronts an ALB
            if node.get("image") == "ecr":
                has_container = True
            label = f"{DISPLAY_NAME.get(aws, aws)} ({node_id})"
        elif node_type == "database":
            table = book["database"].get(aws, book["database"]["rds_postgres"])
            monthly = table.get(scale, table.get("small"))
            if multi_az:
                monthly *= 2
        elif node_type == "cache":
            table = book["cache"].get(aws, book["cache"]["elasticache"])
            monthly = table.get(scale, table.get("small"))
            if multi_az:
                monthly *= 2
        else:
            monthly = book["flat"].get(aws, 0)

        # Hourly-billed resources scale with uptime; flat usage services do not.
        if node_type in ("service", "worker", "database", "cache"):
            monthly *= hour_factor
        monthly *= region_mult

        if monthly > 0:
            line_items.append({"node_id": node_id, "label": label, "monthly": round(monthly)})

    if has_container:
        line_items.append({
            "node_id": None,
            "label": "ECR storage",
            "monthly": round(book["ecr_storage_monthly"] * region_mult),
        })

    total = sum(item["monthly"] for item in line_items)

    return {
        "currency": "USD",
        "total": total,
        "line_items": line_items,
        "assumptions": _assumptions(overrides, region, eff_hours),
        "price_source": "pricing_mcp" if price_book else "default",
    }


def _assumptions(overrides: Overrides | None, region: str, eff_hours: float) -> list[str]:
    assumptions: list[str] = []
    if overrides and (overrides.get("hours_per_day") is not None or overrides.get("days_per_week") is not None):
        hpd = overrides.get("hours_per_day", 24)
        dpw = overrides.get("days_per_week", 7)
        label = overrides.get("operating_hours")
        suffix = f" ({label})" if label else ""
        assumptions.append(f"{hpd} hours/day, {dpw} days/week{suffix}")
        assumptions.append(f"Effective monthly hours: {int(eff_hours)}")
    else:
        assumptions.append("730 hours/month (24/7 uptime)")
    assumptions.append(f"{region} pricing")
    assumptions.append("Prices exclude data transfer costs")
    assumptions.append("Free tier not applied")
    return assumptions


def cost_delta(
    canvas_before: Canvas,
    canvas_after: Canvas,
    intent: Intent,
    overrides: Overrides | None = None,
    price_book: PriceBook | None = None,
) -> dict[str, int]:
    """Return ``{"before": int, "after": int, "delta": int}`` totals for a change."""
    before = estimate_cost(canvas_before, intent, overrides, price_book)["total"]
    after = estimate_cost(canvas_after, intent, overrides, price_book)["total"]
    return {"before": before, "after": after, "delta": after - before}
