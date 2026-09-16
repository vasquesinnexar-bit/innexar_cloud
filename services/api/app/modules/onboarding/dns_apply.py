"""DNS apply via Cloudflare do cliente (P1.3): preview, snapshot, upsert, rollback.

Regras de segurança:
- Nunca apaga registro que não criou sem snapshot + confirmação.
- MX/SPF existentes de outro provider = conflito (exige confirmação explícita).
- Nunca dois SPF (merge ou manual).
- Idempotente: aplicar 2x não duplica (upsert por tipo+nome+conteúdo).
- Chamadas de rede via to_thread (nunca bloqueia o loop no request).
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

MAIL_IPV4 = "173.212.248.236"
DKIM_SELECTOR = "mail"


def normalize_dkim_txt(raw: str | None) -> str | None:
    """mail.txt (BIND, multilinha) → string única p/ API Cloudflare."""
    if not raw:
        return None
    text = re.sub(r"[\s()\"]+", " ", raw).strip()
    text = re.sub(r"\s+", " ", text)
    if "v=DKIM1" not in text.replace(" ", ""):
        return None
    return text


def desired_records(domain: str, dkim_txt: str | None) -> list[dict]:
    """Registros que o MailProvider exige (fonte única de verdade)."""
    records = [
        {"type": "MX", "name": "@", "content": f"mail.{domain}", "priority": 10},
        {
            "type": "TXT",
            "name": "@",
            "content": f"v=spf1 mx a:mail.{domain} ip4:{MAIL_IPV4} -all",
        },
        {
            "type": "TXT",
            "name": "_dmarc",
            "content": f"v=DMARC1; p=quarantine; rua=mailto:postmaster@{domain}",
        },
        {"type": "A", "name": "mail", "content": MAIL_IPV4},
    ]
    if dkim_txt:
        records.append(
            {"type": "TXT", "name": f"{DKIM_SELECTOR}._domainkey", "content": dkim_txt}
        )
    return records


def _slot_of(rec: dict, domain: str) -> tuple:
    name = (rec.get("name") or "").rstrip(".").lower()
    dom = domain.lower()
    if name == dom:
        name = "@"
    elif name.endswith("." + dom):
        name = name[: -(len(dom) + 1)]
    return ((rec.get("type") or "").upper(), name)


def build_preview(
    existing: list[dict],
    desired: list[dict],
    domain: str,
    *,
    confirmed_conflicts: bool = False,
) -> dict:
    """Diff seguro: add / keep / conflicts. Nunca propõe delete cego."""
    adds, keeps, conflicts = [], [], []
    for want in desired:
        slot = (want["type"].upper(), want["name"].lower())
        same = [
            e
            for e in existing
            if _slot_of(e, domain) == slot
            and (e.get("content") or "").strip() == (want.get("content") or "").strip()
        ]
        if same:
            keeps.append({**want, "existing_id": same[0].get("id")})
            continue
        occupiers = [e for e in existing if _slot_of(e, domain) == slot]
        if want["type"].upper() == "MX" and any(
            "mail." not in (e.get("content") or "").lower() for e in occupiers
        ):
            conflicts.append(
                {
                    "type": "MX",
                    "name": want["name"],
                    "want": want,
                    "existing": [
                        {"content": e.get("content")}
                        for e in occupiers
                        if "mail." not in (e.get("content") or "").lower()
                    ],
                    "message": "Este domínio já utiliza outro serviço de e-mail.",
                }
            )
            continue
        if want["type"].upper() == "TXT" and want["content"].startswith("v=spf1"):
            spfs = [
                e for e in occupiers if (e.get("content") or "").startswith("v=spf1")
            ]
            if spfs and not confirmed_conflicts:
                conflicts.append(
                    {
                        "type": "TXT",
                        "name": want["name"],
                        "want": want,
                        "existing": [{"content": e.get("content")} for e in spfs],
                        "message": "Já existe SPF. Mesclar ou revisar manualmente.",
                    }
                )
                continue
        adds.append(want)
    return {"add": adds, "keep": keeps, "conflicts": conflicts}


async def apply_preview(
    client,
    zone_id: str,
    domain: str,
    preview: dict,
    *,
    snapshot: list | None = None,
) -> dict:
    """Aplica adds com upsert + rollback em falha parcial. Retorna criados."""
    import anyio

    created = []
    try:
        for want in preview.get("add", []):
            existing = await anyio.to_thread.run_sync(
                client.list_dns_records,
                zone_id,
                want["type"],
                want["name"] if want["name"] != "@" else None,
            )
            if any(
                _slot_of(e, domain) == (want["type"].upper(), want["name"].lower())
                and (e.get("content") or "").strip()
                == (want.get("content") or "").strip()
                for e in existing
            ):
                continue
            kwargs = {}
            if want.get("priority") is not None:
                kwargs["priority"] = want["priority"]
            rec = await anyio.to_thread.run_sync(
                client.create_dns_record,
                zone_id,
                want["type"],
                want["name"],
                want["content"],
                **kwargs,
            )
            created.append(rec.get("id") if isinstance(rec, dict) else None)
    except Exception as e:  # noqa: BLE001 (rollback do que criou)
        logger.exception("dns apply parcial; rollback %s", len(created))
        for rid in created:
            if not rid:
                continue
            try:
                await anyio.to_thread.run_sync(client.delete_dns_record, zone_id, rid)
            except Exception:  # noqa: BLE001 (melhor esforço)
                logger.exception("rollback dns %s falhou", rid)
        raise RuntimeError(f"apply parcial com rollback: {e}") from e
    return {"created": len(created), "snapshot_n": len(snapshot or [])}
