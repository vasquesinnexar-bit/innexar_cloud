"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PackageCheck, RefreshCw } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";
import { FULFILLMENT_STATUS_STYLE } from "@/components/fulfillment-status";

interface Fulfillment {
  id: number;
  customer_id: number;
  customer_name: string | null;
  contract_id: number;
  contract_item_id: number;
  product_name: string | null;
  invoice_id: number | null;
  strategy: string;
  handler_key: string;
  status: string;
  current_step: string | null;
  progress: number;
  last_error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["", "queued", "provisioning", "waiting_input", "failed", "manual_review", "active", "suspended", "cancelled"];
const HANDLER_OPTIONS = ["", "mail", "hestia", "project", "manual"];

export default function ProvisioningPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [handler, setHandler] = useState("");
  const [customerId, setCustomerId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (handler) params.set("handler", handler);
      if (customerId) params.set("customer_id", customerId);
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.FULFILLMENT.LIST(params.toString() || undefined))
      );
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiPath, status, handler, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PackageCheck className="w-6 h-6" /> Provisionamento
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
        <select value={handler} onChange={(e) => setHandler(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white" aria-label="Handler">
          <option value="">Todos os handlers</option>
          {HANDLER_OPTIONS.filter(Boolean).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="customer_id" inputMode="numeric" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm w-32" />
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">Nenhum fulfillment. Pagamentos confirmados geram fulfillments automaticamente.</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-slate-400">ID</th>
                <th className="text-left py-2 px-3 text-slate-400">Cliente</th>
                <th className="text-left py-2 px-3 text-slate-400">Produto</th>
                <th className="text-left py-2 px-3 text-slate-400">Handler</th>
                <th className="text-left py-2 px-3 text-slate-400">Status</th>
                <th className="text-left py-2 px-3 text-slate-400">Etapa</th>
                <th className="text-left py-2 px-3 text-slate-400">Erro</th>
                <th className="text-left py-2 px-3 text-slate-400">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2 px-3">
                    <Link href={`/provisioning/${r.id}`} className="text-blue-300 hover:underline">#{r.id}</Link>
                  </td>
                  <td className="py-2 px-3">{r.customer_name ?? `#${r.customer_id}`}</td>
                  <td className="py-2 px-3">{r.product_name ?? "—"}</td>
                  <td className="py-2 px-3 text-slate-400">{r.handler_key}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs ${FULFILLMENT_STATUS_STYLE[r.status] ?? "bg-white/10"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">{r.current_step ?? "—"}</td>
                  <td className="py-2 px-3 text-red-300/80 truncate max-w-[240px]" title={r.last_error ?? ""}>{r.last_error ?? "—"}</td>
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
