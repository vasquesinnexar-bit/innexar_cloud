"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface FulfillmentRow {
  id: number;
  product_name: string | null;
  handler_key: string;
  status: string;
  current_step: string | null;
  last_error: string | null;
}

const STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  provisioning: "bg-blue-500/15 text-blue-300",
  failed: "bg-red-500/15 text-red-300",
  waiting_input: "bg-amber-500/15 text-amber-300",
  manual_review: "bg-purple-500/15 text-purple-300",
  suspended: "bg-slate-500/15 text-slate-300",
  queued: "bg-cyan-500/15 text-cyan-300",
};

export function FulfillmentSection({ customerId }: { customerId: string }) {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<FulfillmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.FULFILLMENT.CUSTOMER(customerId))
      );
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [customerId, apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <PackageCheck className="w-5 h-5" /> Provisionamentos
        </h3>
        <Link href="/provisioning" className="text-sm text-blue-300 hover:underline">
          Central →
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">Nenhum provisionamento para este cliente.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 text-sm">
              <div className="min-w-0">
                <p className="text-white truncate">{r.product_name ?? r.handler_key}</p>
                <p className="text-xs text-slate-500">
                  {r.current_step ?? r.status}
                  {r.last_error ? ` — ${r.last_error.slice(0, 120)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-xs ${STYLE[r.status] ?? "bg-white/10"}`}>
                  {r.status}
                </span>
                {(r.status === "failed" || r.status === "waiting_input") && (
                  <Link href={`/provisioning/${r.id}`} className="text-blue-300 hover:underline text-xs">
                    Ver detalhes
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
