"""DNS discovery (P1.3): NS, registros e detecção de provider. Leitura apenas."""

from __future__ import annotations

NS_PROVIDER_MAP: tuple[tuple[str, str], ...] = (
    ("cloudflare", "Cloudflare"),
    ("awsdns", "Route53"),
    ("route53", "Route53"),
    ("domaincontrol", "GoDaddy"),
    ("hostinger", "Hostinger"),
    ("registro.br", "Registro.br"),
    ("dns.br", "Registro.br"),
    ("namecheap", "Namecheap"),
    ("digitalocean", "DigitalOcean"),
    ("azure-dns", "Azure DNS"),
    ("googledomains", "Google Cloud DNS"),
    ("google", "Google Cloud DNS"),
    ("ns1.", None),  # genérico demais: cai em desconhecido
)

MX_PROVIDER_MAP: tuple[tuple[str, str], ...] = (
    ("google", "Google Workspace"),
    ("googlemail", "Google Workspace"),
    ("outlook", "Microsoft 365"),
    ("hotmail", "Microsoft 365"),
    ("zoho", "Zoho"),
    ("proton", "Proton"),
    ("yandex", "Yandex"),
    ("mail.innexar.com.br", "Innexar"),
)


def _resolve(name: str, rdtype: str) -> list[str]:
    try:
        import dns.resolver

        res = dns.resolver.Resolver()
        res.lifetime = res.timeout = 8
        out = []
        for r in res.resolve(name, rdtype):
            if rdtype == "MX":
                out.append(str(r.exchange).rstrip(".").lower())
            elif rdtype == "NS":
                out.append(str(r.target).rstrip(".").lower())
            elif rdtype == "TXT":
                out.append(
                    "".join(
                        p.decode() if isinstance(p, bytes) else str(p)
                        for p in r.strings
                    )
                )
            else:
                out.append(str(r).strip())
        return out
    except Exception:  # noqa: BLE001 (ausência = dado, não erro)
        return []


def detect_dns_provider(nameservers: list[str]) -> str | None:
    joined = " ".join(nameservers).lower()
    for marker, label in NS_PROVIDER_MAP:
        if label is None:
            continue
        if marker in joined:
            return label
    return None


def detect_mail_provider(mx_hosts: list[str]) -> str | None:
    joined = " ".join(mx_hosts).lower()
    for marker, label in MX_PROVIDER_MAP:
        if marker in joined:
            return label
    if mx_hosts:
        return "Outro"
    return None


def discover(domain: str) -> dict:
    """Descoberta pública completa (nunca escreve, nunca levanta)."""
    from app.modules.mail.service import check_domain_dns

    domain = (domain or "").strip().lower()
    ns = _resolve(domain, "NS")
    mx = _resolve(domain, "MX")
    mail = check_domain_dns(domain)
    raw_checks = dict(mail.get("checks", {}) or {})
    all_ok = bool(raw_checks.pop("all_ok", False))
    return {
        "domain": domain,
        "nameservers": ns,
        "dns_provider": detect_dns_provider(ns),
        "mx": mx,
        "mail_provider": detect_mail_provider(mx),
        "mail_checks": raw_checks,
        "all_ok": all_ok,
    }
