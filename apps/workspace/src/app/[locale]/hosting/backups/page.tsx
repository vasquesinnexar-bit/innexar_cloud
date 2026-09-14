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
  const apiPath = (p: string) => withOrgQuery(p, orgFilter);
  const [rows, setRows] = useState<BackupRow[]>([]);

  const load = useCallback(async () => {
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.BACKUPS_RECENT));
    if (res.ok) setRows(await res.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
