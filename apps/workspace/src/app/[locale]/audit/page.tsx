"use client";

import { useState, useEffect, useCallback } from "react";
import { ScrollText } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Entry {
  id: number;
  entity: string;
  entity_id: string | null;
  action: string;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

const ACTION_PT: Record<string, string> = {
  manual_payment_confirmed: "Pagamento manual confirmado",
  invoice_past_due: "Fatura vencida",
  service_suspended: "Serviço suspenso",
  service_reactivated: "Serviço reativado",
  contract_suspended: "Contrato suspenso",
  mailbox_created: "Conta de e-mail criada",
  mailbox_deleted: "Conta de e-mail removida",
  mailbox_password_changed: "Senha de e-mail alterada",
  hosting_linked: "Hospedagem vinculada",
  hosting_restart: "Restart executado",
  refund_created: "Reembolso criado",
  billing_policy_changed: "Política alterada",
  paid: "Pagamento aprovado",
  payment_failed: "Pagamento falhou",
};

export default function AuditPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (path: string) => withOrgQuery(path, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (action.trim()) params.set("action", action.trim());
      const qs = params.toString() ? `?${params}` : "";
      const res = await workspaceFetchStaff(apiPath(`${WORKSPACE_API_PATHS.AUDIT}${qs}`));
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiPath, q, action]);

  useEffect(() => {
    const t = setTimeout(load, q ? 400 : 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <ScrollText className="w-6 h-6" /> Auditoria
      </h1>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por entidade, id ou ator…"
          className="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
        />
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filtrar ação (ex: paid)"
          className="w-48 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
        />
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">Nenhum evento encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-white">
                <span className="font-medium">{ACTION_PT[r.action] ?? r.action}</span>{" "}
                <span className="text-slate-400 text-sm">
                  · {r.entity}
                  {r.entity_id ? ` #${r.entity_id}` : ""}
                </span>
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {r.actor_type}
                {r.actor_id ? ` ${r.actor_id}` : ""} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
