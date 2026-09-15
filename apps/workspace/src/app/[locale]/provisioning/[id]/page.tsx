"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCw, CheckCircle, XCircle } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";
import { FULFILLMENT_STATUS_STYLE } from "@/components/fulfillment-status";

interface AuditEntry {
  id: number;
  action: string;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

interface Detail {
  id: number;
  customer_id: number;
  customer_name: string | null;
  contract_id: number;
  contract_item_id: number;
  product_name: string | null;
  invoice_id: number | null;
  subscription_id: number | null;
  service_id: number | null;
  project_id: number | null;
  strategy: string;
  handler_key: string;
  status: string;
  current_step: string | null;
  progress: number;
  last_error: string | null;
  retryable: boolean;
  retry_count: number;
  next_retry_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  contract_item: { id: number; description: string | null; quantity: number; unit_amount: number | null } | null;
}

export default function FulfillmentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [detail, setDetail] = useState<Detail | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dRes, aRes] = await Promise.all([
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.DETAIL(id))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.AUDIT(id))),
      ]);
      if (dRes.ok) setDetail(await dRes.json());
      if (aRes.ok) setAudit(await aRes.json());
    } finally {
      setLoading(false);
    }
  }, [id, apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<Response>) => {
    if (key === "retry" && !confirm("Reprocessar provisionamento? O handler será executado novamente de forma idempotente.")) return;
    setBusy(key);
    setError("");
    try {
      const res = await fn();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json());
      const aRes = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.AUDIT(id!)));
      if (aRes.ok) setAudit(await aRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const retry = () =>
    act("retry", () =>
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.RETRY(id!)), { method: "POST" }));
  const resolve = () =>
    act("resolve", () =>
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.RESOLVE(id!)), {
        method: "POST", body: JSON.stringify({ note: note || null }),
      }));
  const cancel = () =>
    act("cancel", () =>
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.FULFILLMENT.CANCEL(id!)), {
        method: "POST", body: JSON.stringify({ note: note || null }),
      }));

  if (loading) return <p className="text-slate-400">Carregando…</p>;
  if (!detail) return <p className="text-slate-400">Fulfillment não encontrado.</p>;

  const canRetry = ["failed", "waiting_input", "manual_review", "queued"].includes(detail.status);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/provisioning" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm">
        <ArrowLeft className="w-4 h-4" /> Provisionamento
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Fulfillment #{detail.id}</h1>
        <span className={`px-2 py-1 rounded-lg text-xs ${FULFILLMENT_STATUS_STYLE[detail.status] ?? "bg-white/10"}`}>
          {detail.status}
        </span>
      </div>
      {error && <p className="text-red-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-2">Contexto comercial</h2>
          {row("Cliente", detail.customer_name ? `${detail.customer_name} (#${detail.customer_id})` : `#${detail.customer_id}`)}
          {row("Produto", detail.product_name ?? "—")}
          {row("Contrato", `#${detail.contract_id}`)}
          {row("ContractItem", `#${detail.contract_item_id}${detail.contract_item?.description ? ` — ${detail.contract_item.description}` : ""}`)}
          {row("Invoice", detail.invoice_id ? `#${detail.invoice_id}` : "—")}
          {row("Subscription", detail.subscription_id ? `#${detail.subscription_id}` : "—")}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-2">Execução</h2>
          {row("Strategy", detail.strategy)}
          {row("Handler", detail.handler_key)}
          {row("Etapa", detail.current_step ?? "—")}
          {row("Progresso", `${detail.progress}%`)}
          {row("Tentativas", String(detail.retry_count))}
          {row("Próx. retry", detail.next_retry_at ? new Date(detail.next_retry_at).toLocaleString() : "—")}
          {row("Service", detail.service_id ? `#${detail.service_id}` : "—")}
          {row("Project", detail.project_id ? `#${detail.project_id}` : "—")}
        </div>
      </div>
      {detail.last_error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <p className="text-sm text-red-300 font-medium mb-1">Último erro (sanitizado)</p>
          <pre className="text-xs text-red-200/80 whitespace-pre-wrap break-all">{detail.last_error}</pre>
        </div>
      )}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white">Ações</h2>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional, p/ resolver/cancelar)" className="w-full max-w-md px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={retry} disabled={busy === "retry" || !canRetry} className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm disabled:opacity-50 flex items-center gap-1">
            <RotateCw className="w-4 h-4" /> Reprocessar
          </button>
          <button type="button" onClick={resolve} disabled={busy === "resolve" || detail.status === "active"} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Marcar resolvido
          </button>
          <button type="button" onClick={cancel} disabled={busy === "cancel" || detail.status === "active"} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50 flex items-center gap-1">
            <XCircle className="w-4 h-4" /> Cancelar
          </button>
        </div>
        <p className="text-xs text-slate-500">Reprocessar executa o handler de forma idempotente no servidor (nunca no browser) e registra audit.</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-2">Histórico</h2>
        {audit.length === 0 ? (
          <p className="text-slate-400 text-sm">Sem eventos.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 text-slate-300">
                <span>{a.action} <span className="text-slate-500">({a.actor_type}{a.actor_id ? `:${a.actor_id}` : ""})</span></span>
                <span className="text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
