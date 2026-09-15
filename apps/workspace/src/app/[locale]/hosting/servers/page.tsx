"use client";

import { useState, useEffect, useCallback } from "react";
import { Server } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface ServerRow {
  id: number;
  name: string;
  hostname: string;
  provider: string;
  region: string;
  environment: string;
  status: string;
}

export default function HostingServersPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [servers, setServers] = useState<ServerRow[]>([]);

  const load = useCallback(async () => {
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.SERVERS));
    if (res.ok) setServers(await res.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Server className="w-6 h-6" /> Servidores
      </h1>
      {servers.length === 0 ? (
        <p className="text-slate-400">
          Nenhum servidor registrado. O host é auto-registrado ao vincular o primeiro serviço.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((s) => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1">
              <p className="font-bold text-white">{s.name}</p>
              <p className="text-sm text-slate-400">{s.hostname}</p>
              <p className="text-sm text-slate-400">
                {s.provider} · {s.region} · {s.environment} · {s.status}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
