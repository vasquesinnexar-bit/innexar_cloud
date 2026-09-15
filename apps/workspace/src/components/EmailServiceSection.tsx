"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Plus, KeyRound, Power, PowerOff, RefreshCw } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { withOrgQuery } from "@/lib/org-filter";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { useOrgFilter } from "@/hooks/use-org-filter";

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
}

export function EmailServiceSection({ customerId }: { customerId: string }) {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [boxes, setBoxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState("");
  const [pw, setPw] = useState("");
  const [quota, setQuota] = useState("");
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, bRes] = await Promise.all([
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.ENTITLEMENT(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.MAILBOXES(customerId))),
      ]);
      if (eRes.ok) setEnt(await eRes.json());
      if (bRes.ok) setBoxes(await bRes.json());
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

  const sync = (d: string) =>
    act("sync", async () => {
      await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.MAIL.SYNC(customerId)), {
        method: "POST",
        body: JSON.stringify({ domain: d }),
      });
    });

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Mail className="w-5 h-5" /> E-mail Profissional
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowNew(true)}
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
            <p className="text-slate-300 mb-3">
              Contratadas: <strong>{ent.contracted}</strong> · Em uso: <strong>{ent.used}</strong> ·
              Disponíveis: <strong>{ent.available}</strong>
              {ent.unit_price !== null && (
                <> · {ent.currency} {ent.unit_price}/conta</>
              )}
            </p>
          )}
          {error && <p className="text-red-400 mb-2">{error}</p>}
          {boxes.length === 0 ? (
            <p className="text-slate-400">Nenhuma conta. Registre o domínio e sincronize.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Conta</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Quota</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.map((b) => (
                    <tr key={b.id} className="border-b border-white/5">
                      <td className="py-3 px-4"><code>{b.address}</code></td>
                      <td className="py-3 px-4">{b.quota ?? "∞"}</td>
                      <td className="py-3 px-4">{b.status}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
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
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => domain && sync(domain)} className="px-3 py-1.5 rounded-lg bg-white/10 text-sm flex items-center gap-1">
              <RefreshCw className="w-4 h-4" /> Sincronizar domínio
            </button>
          </div>
        </>
      )}
    </div>
  );
}
