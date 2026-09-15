"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Plus, KeyRound, Power, PowerOff, RefreshCw, Globe, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { withOrgQuery } from "@/lib/org-filter";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { useOrgFilter } from "@/hooks/use-org-filter";

const WEBMAIL_URL = "https://webmail.innexar.com.br";

interface Entitlement {
  contracted: number;
  used: number;
  available: number;
  currency: string;
  unit_price: number | null;
}

interface Mailbox {
  id: number;
  address: string;
  display_name: string | null;
  quota: string | null;
  status: string;
  usage_used: string | null;
  usage_pct: string | null;
}

interface Domain {
  id: number;
  domain: string;
  status: string;
  verified_at: string | null;
}

interface DNSChecks {
  all_ok: boolean;
  checks: Record<string, { ok: boolean; found: string[]; expected: string; hint: string }>;
  expected_records: { type: string; host: string; value: string }[];
}

function parseSize(s: string | null): number | null {
  if (!s) return null;
  const m = /^([\d.,]+)\s*([KMGT]?)$/i.exec(s.trim());
  if (!m) return null;
  const mult: Record<string, number> = { "": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  return parseFloat(m[1].replace(",", ".")) * (mult[m[2].toUpperCase()] ?? 1);
}

function fmtBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

const DNS_LABEL: Record<string, string> = { mx: "MX", spf: "SPF", dkim: "DKIM", dmarc: "DMARC" };

export function EmailServiceSection({ customerId }: { customerId: string }) {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [boxes, setBoxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showDomain, setShowDomain] = useState(false);
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [pw, setPw] = useState("");
  const [quota, setQuota] = useState("");
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [dnsFor, setDnsFor] = useState<string | null>(null);
  const [dns, setDns] = useState<DNSChecks | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, bRes, dRes] = await Promise.all([
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.ENTITLEMENT(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.MAILBOXES(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.DOMAINS(customerId))),
      ]);
      if (eRes.ok) setEnt(await eRes.json());
      if (bRes.ok) setBoxes(await bRes.json());
      if (dRes.ok) setDomains(await dRes.json());
    } catch {
      /* sem serviço de e-mail: seção mostra vazio */
    } finally {
      setLoading(false);
    }
  }, [customerId, apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const checkDNS = async (d: string) => {
    setDnsFor(d);
    setDns(null);
    setDnsLoading(true);
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.DOMAIN_DNS(d)));
      if (res.ok) setDns(await res.json());
    } finally {
      setDnsLoading(false);
    }
  };

  const addDomain = () =>
    act("new-domain", async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.MAIL.DOMAINS(customerId)),
        { method: "POST", body: JSON.stringify({ domain: newDomain }) }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail?.message ?? `HTTP ${res.status}`);
      }
      setShowDomain(false);
      setNewDomain("");
    });

  const create = () =>
    act("new", async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.MAIL.MAILBOXES(customerId)),
        { method: "POST", body: JSON.stringify({ domain, local_part: local, password: pw, quota: quota || null }) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowNew(false);
      setLocal("");
      setDomain("");
      setPw("");
      setQuota("");
    });

  const setPassword = (id: number) =>
    act(`pw-${id}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.MAIL.PASSWORD(id, customerId)),
        { method: "POST", body: JSON.stringify({ password: pw }) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPwFor(null);
      setPw("");
    });

  const toggle = (id: number, disabled: boolean) =>
    act(`t-${id}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(disabled ? WORKSPACE_API_PATHS.MAIL.DISABLE(id, customerId) : WORKSPACE_API_PATHS.MAIL.ENABLE(id, customerId)),
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });

  const remove = (address: string, id: number) => {
    if (!confirm(`Excluir ${address}? A caixa é removida do servidor.`)) return;
    act(`del-${id}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.MAIL.DELETE(id, customerId)),
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  };

  const sync = (d: string) =>
    act("sync", async () => {
      await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.SYNC(customerId)), {
        method: "POST",
        body: JSON.stringify({ domain: d }),
      });
    });

  const storageTotal = boxes.reduce((acc, b) => acc + (parseSize(b.usage_used) ?? 0), 0);
  const status = !ent || ent.contracted <= 0 ? "Sem plano" : ent.used > 0 ? "Ativo" : "Ativo (sem contas)";

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Mail className="w-5 h-5" /> E-mail Profissional
          <span className={`px-2 py-0.5 rounded-lg text-xs ${ent && ent.contracted > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
            {status}
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setManage(!manage)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
            aria-expanded={manage}
          >
            {manage ? "Ocultar" : "Gerenciar"}
          </button>
          <button
            type="button"
            onClick={() => { setShowNew(true); setManage(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium"
          >
            <Plus className="w-4 h-4" /> Nova conta
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <>
          {ent && (
            <p className="text-slate-300 mb-1">
              Plano: <strong>{ent.contracted} contas</strong> · Em uso: <strong>{ent.used}/{ent.contracted}</strong>
              {ent.unit_price !== null && (
                <> · {ent.currency} {ent.unit_price}/conta</>
              )}
              {storageTotal > 0 && <> · Storage: <strong>{fmtBytes(storageTotal)}</strong></>}
            </p>
          )}
          {domains.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {domains.map((d) => (
                <span key={d.id} className="px-2 py-0.5 rounded-lg bg-white/10 text-slate-300 text-xs flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {d.domain}
                </span>
              ))}
            </div>
          )}
          {error && <p className="text-red-400 mb-2">{error}</p>}
          {manage && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300">Domínios</h4>
                <button
                  type="button"
                  onClick={() => setShowDomain(!showDomain)}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-200 text-sm"
                >
                  Adicionar domínio
                </button>
              </div>
              {showDomain && (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="ex: cliente.com.br"
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addDomain}
                    disabled={busy === "new-domain" || !newDomain}
                    className="px-3 py-1.5 rounded-lg bg-blue-500 text-sm disabled:opacity-50"
                  >
                    Registrar
                  </button>
                  <span className="text-xs text-slate-500">O domínio precisa existir no mailserver (DKIM/conta).</span>
                </div>
              )}
              {domains.map((d) => (
                <div key={d.id} className="rounded-xl border border-white/10 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-white text-sm font-medium">{d.domain} <span className="text-slate-500">· {d.status}</span></p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => (dnsFor === d.domain ? setDnsFor(null) : checkDNS(d.domain))}
                        className="px-2 py-1 rounded-lg bg-white/10 text-xs"
                      >
                        Verificar DNS
                      </button>
                      <button
                        type="button"
                        onClick={() => sync(d.domain)}
                        disabled={busy === "sync"}
                        className="px-2 py-1 rounded-lg bg-white/10 text-xs flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Sincronizar
                      </button>
                    </div>
                  </div>
                  {dnsFor === d.domain && (
                    <div className="text-xs space-y-1">
                      {dnsLoading && <p className="text-slate-400">Verificando…</p>}
                      {dns && (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(dns.checks).map(([k, v]) => (
                              <span key={k} title={v.hint} className={`px-2 py-0.5 rounded-lg flex items-center gap-1 ${v.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                {v.ok ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                                {DNS_LABEL[k] ?? k}
                              </span>
                            ))}
                          </div>
                          {!dns.all_ok && (
                            <details className="text-slate-400">
                              <summary className="cursor-pointer">Registros esperados</summary>
                              <ul className="mt-1 space-y-1">
                                {dns.expected_records.map((r, i) => (
                                  <li key={i}><code className="text-slate-300">{r.host} {r.type} {String(r.value).slice(0, 90)}{String(r.value).length > 90 ? "…" : ""}</code></li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {boxes.length === 0 ? (
            <p className="text-slate-400 mt-3">Nenhuma conta. Registre o domínio e sincronize.</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Conta</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Uso</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Quota</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((b) => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="py-3 px-4"><code>{b.address}</code></td>
                      <td className="py-3 px-4 text-sm text-slate-300">
                        {b.usage_used ? (
                          <span title={b.usage_pct ? `${b.usage_pct}%` : undefined}>
                            {b.usage_used}{b.usage_pct ? ` (${b.usage_pct}%)` : ""}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4">{b.quota ?? "∞"}</td>
                      <td className="py-3 px-4">{b.status}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <a
                            href={WEBMAIL_URL}
                            target="_blank"
                            rel="noopener"
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                            title="Abrir webmail"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => { setPwFor(b.id); setPw(""); }}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
                          >
                            <KeyRound className="w-4 h-4" /> Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => toggle(b.id, b.status === "active")}
                            disabled={busy === `t-${b.id}`}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
                          >
                            {b.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(b.address, b.id)}
                            disabled={busy === `del-${b.id}`}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm"
                            title="Excluir conta"
                          >
                            Excluir
                          </button>
                        </div>
                        {pwFor === b.id && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="password"
                              value={pw}
                              onChange={(e) => setPw(e.target.value)}
                              placeholder="Nova senha (mín. 8)"
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setPassword(b.id)}
                              disabled={busy === `pw-${b.id}`}
                              className="px-3 py-1.5 rounded-lg bg-blue-500 text-sm"
                            >
                              Salvar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showNew && (
            <div className="grid gap-2 max-w-md mt-4">
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="domínio (ex: cliente.com.br)" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
              <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="nome (ex: contato)" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha (mín. 8)" autoComplete="new-password" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
              <input value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Quota (ex: 2G, vazio = ilimitada)" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
              <div className="flex gap-2">
                <button type="button" onClick={create} disabled={busy === "new"} className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium">Criar</button>
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-white/10">Fechar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
