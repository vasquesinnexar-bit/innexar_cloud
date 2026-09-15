"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface BackupRow {
  id: number;
  service_id: number;
  domain: string | null;
  customer_id: number | null;
  status: string;
  size_bytes: number | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

export default function HostingBackupsPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.BACKUPS_RECENT));
    if (res.ok) setRows(await res.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (id: number) => {
    if (!confirm(`RESTAURAR backup #${id}? Isso SOBRESCREVE os arquivos atuais.`)) return;
    if (window.prompt("Digite RESTAURAR para confirmar:") !== "RESTAURAR") return;
    setBusy(true);
    try {
      await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.BACKUP_RESTORE(id)), {
        method: "POST",
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Archive className="w-6 h-6" /> Backups
      </h1>
      {rows.length === 0 ? (
        <p className="text-slate-400">Sem backups. Crie o primeiro pela página do serviço no Portal ou via API.</p>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-slate-400">ID</th>
                <th className="text-left py-2 px-3 text-slate-400">Domínio</th>
                <th className="text-left py-2 px-3 text-slate-400">Status</th>
                <th className="text-left py-2 px-3 text-slate-400">Tamanho</th>
                <th className="text-left py-2 px-3 text-slate-400">Criado em</th>
                <th className="text-left py-2 px-3 text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-white/5">
                  <td className="py-2 px-3">#{b.id}</td>
                  <td className="py-2 px-3">{b.domain ?? `serviço ${b.service_id}`}</td>
                  <td className="py-2 px-3">{b.status}</td>
                  <td className="py-2 px-3">
                    {b.size_bytes !== null ? `${(b.size_bytes / 1024 ** 2).toFixed(1)} MB` : "—"}
                  </td>
                  <td className="py-2 px-3">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="py-2 px-3">
                    {b.status === "completed" && (
                      <button
                        type="button"
                        onClick={() => restore(b.id)}
                        disabled={busy}
                        className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs"
                      >
                        Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
