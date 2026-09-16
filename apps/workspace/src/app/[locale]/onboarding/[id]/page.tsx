"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCw, CheckCircle, ShieldCheck } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Step {
  step_key: string;
  position: number;
  required: boolean;
  status: string;
  data: Record<string, unknown> | null;
  validation_error: string | null;
  completed_at: string | null;
}

interface Detail {
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
  created_at: string;
  updated_at: string;
  steps: Step[];
}

export default function OnboardingDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.ONBOARDING.DETAIL(id)));
      if (res.ok) setDetail(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id, apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<Response>) => {
    if (key === "resolve" && !confirm("Marcar onboarding como resolvido manualmente?")) return;
    setBusy(key);
    setError("");
    try {
      const res = await fn();
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail?.message ?? j?.detail ?? `HTTP ${res.status}`);
      }
      setDetail(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-slate-400">Carregando…</p>;
  if (!detail) return <p className="text-slate-400">Onboarding não encontrado.</p>;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );

  const domainStep = detail.steps.find((s) => s.step_key === "domain");
  const domainData = (domainStep?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Link href="/onboarding" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm">
        <ArrowLeft className="w-4 h-4" /> Onboardings
      </Link>
      <h1 className="text-2xl font-bold text-white">
        Onboarding #{detail.id} · {detail.type} · {detail.status}
      </h1>
      {error && <p className="text-red-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-2">Contexto</h2>
          {row("Cliente", detail.customer_name ? `${detail.customer_name} (#${detail.customer_id})` : `#${detail.customer_id}`)}
          {row("Produto", detail.product_name ?? "—")}
          {row("Fulfillment", detail.fulfillment_id ? `#${detail.fulfillment_id}` : "—")}
          {row("Progresso", `${detail.progress}%`)}
          {detail.last_error && row("Último erro", detail.last_error)}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-2">Domínio / DNS detectado</h2>
          {row("Domínio", String(domainData.domain ?? "—"))}
          {row("Posse", String(domainData.ownership ?? "—"))}
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-2">Etapas</h2>
        <ul className="space-y-1 text-sm">
          {detail.steps.map((s) => (
            <li key={s.step_key} className="flex justify-between gap-2 text-slate-300">
              <span>{s.step_key} {s.required ? "" : "(opcional)"}</span>
              <span className="text-slate-500">{s.status}{s.validation_error ? ` — ${s.validation_error}` : ""}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-white">Intervenção</h2>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" className="w-full max-w-md px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => act("verify", () => workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.ONBOARDING.VERIFY(id!)), { method: "POST" }))} disabled={busy === "verify"} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Revalidar DNS
          </button>
          <button type="button" onClick={() => act("retry", () => workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.ONBOARDING.RETRY(id!)), { method: "POST" }))} disabled={busy === "retry"} className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm disabled:opacity-50 flex items-center gap-1">
            <RotateCw className="w-4 h-4" /> Retry
          </button>
          <button type="button" onClick={() => act("resolve", () => workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.ONBOARDING.RESOLVE(id!)), { method: "POST", body: JSON.stringify({ note: note || null }) }))} disabled={busy === "resolve"} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm disabled:opacity-50 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Marcar resolvido
          </button>
        </div>
      </div>
    </div>
  );
}
