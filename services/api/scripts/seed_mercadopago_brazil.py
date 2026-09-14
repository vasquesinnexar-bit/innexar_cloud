"""
Seed Mercado Pago integration configs for Brazil (innexar-br).

Usage (from backend directory, with env loaded):
  export MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
  export MERCADOPAGO_PUBLIC_KEY=APP_USR-...
  export MERCADOPAGO_WEBHOOK_SECRET=...
  python -m scripts.seed_mercadopago_brazil
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.core.encryption import encrypt_value
from app.core.org import ORG_INNEXAR_BR

ORG_ID = ORG_INNEXAR_BR
MODE = os.environ.get("MERCADOPAGO_MODE", "live")

ENTRIES: tuple[tuple[str, str], ...] = (
    ("access_token", "MERCADOPAGO_ACCESS_TOKEN"),
    ("public_key", "MERCADOPAGO_PUBLIC_KEY"),
    ("webhook_secret", "MERCADOPAGO_WEBHOOK_SECRET"),
)


async def _upsert(db, key: str, plain: str) -> None:
    encrypted = encrypt_value(plain)
    if not encrypted:
        print(f"Encryption failed for {key}. Check ENCRYPTION_KEY / SECRET_KEY_STAFF.")
        sys.exit(1)
    r = await db.execute(
        text(
            """
            SELECT id FROM integration_configs
            WHERE provider = 'mercadopago' AND key = :key
              AND org_id = :org_id AND scope = 'tenant'
            LIMIT 1
            """
        ),
        {"key": key, "org_id": ORG_ID},
    )
    row = r.first()
    if row:
        await db.execute(
            text(
                """
                UPDATE integration_configs
                SET value_encrypted = :enc, enabled = true, mode = :mode, updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"enc": encrypted, "mode": MODE, "id": row[0]},
        )
        print(f"Updated mercadopago/{key} (id={row[0]}).")
    else:
        ins = await db.execute(
            text(
                """
                INSERT INTO integration_configs
                  (org_id, scope, customer_id, provider, key, value_encrypted, mode, enabled, created_at, updated_at)
                VALUES
                  (:org_id, 'tenant', NULL, 'mercadopago', :key, :enc, :mode, true, NOW(), NOW())
                RETURNING id
                """
            ),
            {"org_id": ORG_ID, "key": key, "enc": encrypted, "mode": MODE},
        )
        new_id = ins.scalar_one()
        print(f"Created mercadopago/{key} (id={new_id}).")


async def main() -> None:
    to_seed: list[tuple[str, str]] = []
    for key, env_name in ENTRIES:
        value = (
            os.environ.get(env_name)
            or os.environ.get(env_name.replace("MERCADOPAGO_", "MP_"))
            or ""
        ).strip()
        if value:
            to_seed.append((key, value))
    if not to_seed:
        print("No MP env vars set. Set at least MERCADOPAGO_ACCESS_TOKEN.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        for key, value in to_seed:
            await _upsert(db, key, value)
        await db.commit()
    print(f"Mercado Pago configs seeded for org_id={ORG_ID}.")


if __name__ == "__main__":
    asyncio.run(main())
