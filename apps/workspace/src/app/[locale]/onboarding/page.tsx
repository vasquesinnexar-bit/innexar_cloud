"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ListChecks, RefreshCw } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Onboarding {
  id: number;
  customer_id: number;
  customer_name: string | null;
  fulfillment_id: number | null;
  product_name: string | null;
  type: string;
  status: string;
  current_step: string | null;
  progress: number;
  last_error: string | null;
  last_activity_at: string | null;
  updated_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-300",
  pending: "bg-white/10 text-slate-300",
  waiting_customer: "bg-amber-500/15 text-amber-300",
  waiting_dns: "bg-cyan-500/15 text-cyan-300",
  failed: "bg-red-500/15 text-red-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-slate-500/15 text-slate-500",
};

const STATUS_OPTIONS = ["", "pending", "active", "waiting_customer", "waiting_dns", "failed", "completed", "cancelled"];
const TYPE_OPTIONS = ["", "professional_email", "website_project", "hosting", "manual"];

export default function OnboardingPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [stale, setStale] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (stale) params.set("stale_days", stale);
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.ONBOARDING.LIST(params.toString() || undefined))
      );
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiPath, status, type, stale]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ListChecks className="w-6 h-6" /> Onboardings
        </h1>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white" aria-label="Status">
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white" aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {TYPE_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={stale} onChange={(e) => setStale(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white" aria-label="Parados">
          <option value="">Qualquer atividade</option>
          <option value="7">Parados 7+ dias</option>
          <option value="14">Parados 14+ dias</option>
          <option value="30">Parados 30+ dias</option>
        </select>
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">Nenhum onboarding.</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-slate-400">ID</th>
                <th className="text-left py-2 px-3 text-slate-400">Cliente</th>
                <th className="text-left py-2 px-3 text-slate-400">Tipo</th>
                <th className="text-left py-2 px-3 text-slate-400">Status</th>
                <th className="text-left py-2 px-3 text-slate-400">Etapa</th>
                <th className="text-left py-2 px-3 text-slate-400">Progresso</th>
                <th className="text-left py-2 px-3 text-slate-400">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2 px-3">
                    <Link href={`/onboarding/${r.id}`} className="text-blue-300 hover:underline">#{r.id}</Link>
                  </td>
                  <td className="py-2 px-3">{r.customer_name ?? `#${r.customer_id}`}</td>
                  <td className="py-2 px-3 text-slate-400">{r.type}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs ${STATUS_STYLE[r.status] ?? "bg-white/10"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">{r.current_step ?? "—"}</td>
                  <td className="py-2 px-3 text-slate-400">{r.progress}%</td>
                  <td className="py-2 px-3 text-slate-500">{new Date(r.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
