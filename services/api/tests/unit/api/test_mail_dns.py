"""TAREFA 2: DNS check (mockado), registro com contrato, usage map."""

from unittest.mock import patch

from app.modules.mail.service import check_domain_dns


class _RData:
    def __init__(self, *parts: bytes):
        self.strings = parts


class _FakeResolver:
    lifetime = timeout = 8

    def __init__(self, zone: dict):
        self._zone = zone

    def resolve(self, name: str, rdtype: str):
        key = (str(name).rstrip(".").lower(), rdtype)
        if key not in self._zone:
            raise Exception("NXDOMAIN")
        return self._zone[key]


class _MX:
    def __init__(self, host: str):
        self.exchange = host


def _zone_ok() -> dict:
    return {
        ("cliente.com.br", "MX"): [_MX("mail.cliente.com.br.")],
        ("cliente.com.br", "TXT"): [
            _RData(b"v=spf1 mx a:mail.cliente.com.br ip4:173.212.248.236 -all")
        ],
        ("mail._domainkey.cliente.com.br", "TXT"): [
            _RData(b"v=DKIM1; h=sha256; k=rsa; p=ABC")
        ],
        ("_dmarc.cliente.com.br", "TXT"): [
            _RData(b"v=DMARC1; p=quarantine; rua=mailto:postmaster@cliente.com.br")
        ],
    }


def test_dns_all_ok():
    with patch("dns.resolver.Resolver", return_value=_FakeResolver(_zone_ok())):
        r = check_domain_dns("cliente.com.br")
    assert r["checks"]["all_ok"] is True
    assert all(v["ok"] for k, v in r["checks"].items() if k != "all_ok")


def test_dns_missing_dkim():
    zone = _zone_ok()
    del zone[("mail._domainkey.cliente.com.br", "TXT")]
    with patch("dns.resolver.Resolver", return_value=_FakeResolver(zone)):
        r = check_domain_dns("cliente.com.br")
    assert r["checks"]["all_ok"] is False
    assert r["checks"]["dkim"]["ok"] is False
    assert r["checks"]["mx"]["ok"] is True


def test_dns_total_failure_never_raises():
    with patch("dns.resolver.Resolver", return_value=_FakeResolver({})):
        r = check_domain_dns("inexistente-xyz.com.br")
    assert r["checks"]["all_ok"] is False
    assert r["domain"] == "inexistente-xyz.com.br"
