"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Policy {
  id: number;
  scope: string;
  scope_ref: string | null;
  grace_period_days: number;
  reminder_days_before: number[] | null;
  reminder_days_after: number[] | null;
  suspend_after_days: number;
  cancel_after_days: number | null;
  auto_reactivate: boolean;
  is_active: boolean;
}

const EMPTY = {
  scope: "global",
  scope_ref: "",
  grace_period_days: 7,
  reminder_days_before: [3, 1],
  reminder_days_after: [1, 3, 5],
  suspend_after_days: 14,
  cancel_after_days: null as number | null,
  auto_reactivate: true,
};

export default function BillingPoliciesPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<Policy[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.POLICIES));
    if (res.ok) setRows(await res.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.POLICIES), {
        method: "POST",
        body: JSON.stringify({
          ...form,
          scope_ref: form.scope_ref.trim() || null,
          cancel_after_days: form.cancel_after_days,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.detail === "string" ? d.detail : "Erro ao salvar");
        return;
      }
      setForm({ ...EMPTY });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Políticas de cobrança
      </h1>
      {rows.length === 0 ? (
        <p className="text-slate-400">Nenhuma política. A global padrão será criada no backend.</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-slate-400">Escopo</th>
                <th className="text-left py-2 px-3 text-slate-400">Grace</th>
                <th className="text-left py-2 px-3 text-slate-400">Suspensão</th>
                <th className="text-left py-2 px-3 text-slate-400">Cancela</th>
                <th className="text-left py-2 px-3 text-slate-400">Auto-reativa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 px-3">
                    {p.scope}
                    {p.scope_ref ? ` · ${p.scope_ref}` : ""}
                  </td>
                  <td className="py-2 px-3">{p.grace_period_days}d</td>
                  <td className="py-2 px-3">{p.suspend_after_days}d</td>
                  <td className="py-2 px-3">{p.cancel_after_days != null ? `${p.cancel_after_days}d` : "—"}</td>
                  <td className="py-2 px-3">{p.auto_reactivate ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={save} className="bg-white/5 border border-white/10 rounded-2xl p-4 grid gap-2 max-w-xl">
        <h3 className="text-white font-semibold">Nova / atualizar política</h3>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"
            aria-label="Escopo"
          >
            <option value="global">Global</option>
            <option value="org">Organização</option>
            <option value="product">Produto</option>
            <option value="contract">Contrato</option>
          </select>
          <input
            value={form.scope_ref}
            onChange={(e) => setForm({ ...form, scope_ref: e.target.value })}
            placeholder="Ref (org/produto/contrato)"
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-slate-400">
            Grace (dias)
            <input
              type="number"
              min={0}
              value={form.grace_period_days}
              onChange={(e) => setForm({ ...form, grace_period_days: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Suspender após (dias)
            <input
              type="number"
              min={0}
              value={form.suspend_after_days}
              onChange={(e) => setForm({ ...form, suspend_after_days: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Cancelar após (dias, vazio=nunca)
            <input
              type="number"
              min={0}
              value={form.cancel_after_days ?? ""}
              onChange={(e) => setForm({ ...form, cancel_after_days: num(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.auto_reactivate}
            onChange={(e) => setForm({ ...form, auto_reactivate: e.target.checked })}
          />
          Reativar automaticamente ao pagar
        </label>
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium w-fit">
          Salvar política
        </button>
      </form>
    </div>
  );
}
