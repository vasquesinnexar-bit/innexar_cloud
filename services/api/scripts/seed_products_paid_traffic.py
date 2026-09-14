#!/usr/bin/env python3
"""Create paid traffic products and monthly USD plans.

Plans:
- Paid Traffic Start: $97/month
- Paid Traffic Growth: $197/month
- Paid Traffic Premium: $397/month

Usage: python scripts/seed_products_paid_traffic.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

ORG_ID = "innexar"

PRODUCTS = [
    {
        "name": "Paid Traffic Start",
        "desc": "Beginner paid traffic management for businesses starting with ads and first lead generation.",
        "amount": 97.00,
        "plan_name": "Monthly",
        "interval": "month",
    },
    {
        "name": "Paid Traffic Growth",
        "desc": "Scaling paid traffic management for businesses increasing conversions and customer flow.",
        "amount": 197.00,
        "plan_name": "Monthly",
        "interval": "month",
    },
    {
        "name": "Paid Traffic Premium",
        "desc": "Full-scale traffic management with Meta Ads + Google Ads and advanced funnel strategy.",
        "amount": 397.00,
        "plan_name": "Monthly",
        "interval": "month",
    },
]


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        for p in PRODUCTS:
            r = await conn.execute(
                text(
                    "SELECT id FROM billing_products WHERE name = :name AND org_id = :org LIMIT 1"
                ),
                {"name": p["name"], "org": ORG_ID},
            )
            if r.fetchone():
                print(f"Product '{p['name']}' already exists.")
                continue

            await conn.execute(
                text(
                    "INSERT INTO billing_products (org_id, name, description, is_active, provisioning_type, hestia_package, created_at, updated_at) "
                    "VALUES (:org, :name, :desc, true, NULL, NULL, NOW(), NOW())"
                ),
                {"org": ORG_ID, "name": p["name"], "desc": p["desc"]},
            )

            r = await conn.execute(
                text(
                    "SELECT id FROM billing_products WHERE name = :name AND org_id = :org LIMIT 1"
                ),
                {"name": p["name"], "org": ORG_ID},
            )
            row = r.fetchone()
            assert row is not None
            product_id = row[0]

            await conn.execute(
                text(
                    "INSERT INTO billing_price_plans (product_id, name, interval, amount, currency, created_at) "
                    "VALUES (:pid, :plan_name, :interval, :amount, 'USD', NOW())"
                ),
                {
                    "pid": product_id,
                    "plan_name": p["plan_name"],
                    "interval": p["interval"],
                    "amount": p["amount"],
                },
            )
            print(f"OK. Product '{p['name']}' created, ${p['amount']:.0f}/month.")

    print("Seed done: Paid Traffic Start ($97), Growth ($197), Premium ($397) USD.")


if __name__ == "__main__":
    asyncio.run(main())
