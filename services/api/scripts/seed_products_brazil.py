#!/usr/bin/env python3
"""Seed BR website products (BRL) in the unified workspace database.

Uso: python scripts/seed_products_brazil.py
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

ORG_ID = "innexar-br"

PRODUCTS: list[tuple[str, str, float]] = [
    ("Site Essencial", "Site profissional com hospedagem inclusa", 299.00),
    ("Site Profissional", "Site + Sistema de leads + Marketing integrado", 499.00),
    ("Máquina de Vendas", "Site + CRM + Automação de marketing completa", 799.00),
    ("Ads Essencial", "Gestão de campanhas + básico em redes sociais", 399.00),
    ("Ads Premium", "Gestão completa de marketing digital", 699.00),
    ("Marketing 360°", "Marketing total com produção de vídeo", 1299.00),
]


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        for name, desc, amount in PRODUCTS:
            row = await conn.execute(
                text(
                    "SELECT id FROM billing_products "
                    "WHERE name = :name AND org_id = :org_id LIMIT 1"
                ),
                {"name": name, "org_id": ORG_ID},
            )
            existing = row.fetchone()
            if existing:
                product_id = existing[0]
                await conn.execute(
                    text(
                        "UPDATE billing_products SET description = :desc, is_active = true "
                        "WHERE id = :id"
                    ),
                    {"desc": desc, "id": product_id},
                )
                plan_row = await conn.execute(
                    text(
                        "SELECT id FROM billing_price_plans "
                        "WHERE product_id = :pid AND interval = 'month' LIMIT 1"
                    ),
                    {"pid": product_id},
                )
                plan = plan_row.fetchone()
                if plan:
                    await conn.execute(
                        text(
                            "UPDATE billing_price_plans "
                            "SET amount = :amount, currency = 'BRL' "
                            "WHERE id = :id"
                        ),
                        {"amount": amount, "id": plan[0]},
                    )
                else:
                    await conn.execute(
                        text(
                            "INSERT INTO billing_price_plans "
                            "(product_id, name, interval, amount, currency, created_at) "
                            "VALUES (:pid, 'Mensal', 'month', :amount, 'BRL', NOW())"
                        ),
                        {"pid": product_id, "amount": amount},
                    )
                print(f"Atualizado: {name} (R$ {amount:.2f}/mês)")
                continue

            await conn.execute(
                text(
                    "INSERT INTO billing_products "
                    "(org_id, name, description, is_active, provisioning_type, "
                    "hestia_package, created_at, updated_at) "
                    "VALUES (:org_id, :name, :desc, true, 'site_delivery', NULL, NOW(), NOW())"
                ),
                {"org_id": ORG_ID, "name": name, "desc": desc},
            )
            pid_row = await conn.execute(
                text(
                    "SELECT id FROM billing_products "
                    "WHERE name = :name AND org_id = :org_id LIMIT 1"
                ),
                {"name": name, "org_id": ORG_ID},
            )
            product_id = pid_row.fetchone()[0]
            await conn.execute(
                text(
                    "INSERT INTO billing_price_plans "
                    "(product_id, name, interval, amount, currency, created_at) "
                    "VALUES (:pid, 'Mensal', 'month', :amount, 'BRL', NOW())"
                ),
                {"pid": product_id, "amount": amount},
            )
            print(f"Criado: {name} (R$ {amount:.2f}/mês)")

    await engine.dispose()
    print("Seed BR concluído.")


if __name__ == "__main__":
    asyncio.run(main())
