"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Server, Globe, AlertTriangle } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Overview {
  containers_running: number | null;
  containers_total: number | null;
  images: number | null;
  docker_version: string;
  disk_total: number;
  disk_used: number;
  disk_free: number;
  services_total: number;
  services_suspended: number;
}

interface Svc {
  id: number;
  customer_id: number;
  container_name: string | null;
  primary_domain: string | null;
  status: string;
}

function fmtGB(v: number) {
  return `${(v / 1024 ** 3).toFixed(1)} GB`;
}

export default function HostingOverviewPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [ov, setOv] = useState<Overview | null>(null);
  const [services, setServices] = useState<Svc[]>([]);

  const load = useCallback(async () => {
    const [oRes, sRes] = await Promise.all([
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.SERVERS_OVERVIEW)),
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.SERVICES())),
    ]);
    if (oRes.ok) setOv(await oRes.json());
    if (sRes.ok) setServices(await sRes.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const suspended = services.filter((s) => s.status === "suspended");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Server className="w-6 h-6" /> Innexar Cloud
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Containers</p>
          <p className="text-2xl font-bold text-white">
            {ov?.containers_running ?? "—"}
            <span className="text-sm font-normal text-slate-400"> / {ov?.containers_total ?? "—"}</span>
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Serviços vinculados</p>
          <p className="text-2xl font-bold text-white">{ov?.services_total ?? services.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Suspensos</p>
          <p className="text-2xl font-bold text-white">{ov?.services_suspended ?? suspended.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-slate-400 text-sm">Disco livre</p>
          <p className="text-2xl font-bold text-white">{ov ? fmtGB(ov.disk_free) : "—"}</p>
        </div>
      </div>
      {suspended.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-2 text-yellow-300">
          <AlertTriangle className="w-5 h-5" />
          {suspended.length} serviço(s) suspenso(s) por inadimplência.
        </div>
      )}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Globe className="w-5 h-5" /> Sites vinculados
        </h3>
        {services.length === 0 ? (
          <p className="text-slate-400">
            Nenhum serviço vinculado. Use Sites → Descoberta para vincular infraestrutura a clientes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Domínio</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Container</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="py-2 px-3">
                      <Link href={`/hosting/sites?service=${s.id}`} className="text-blue-400 hover:underline">
                        {s.primary_domain ?? `#${s.id}`}
                      </Link>
                    </td>
                    <td className="py-2 px-3"><code className="text-sm">{s.container_name}</code></td>
                    <td className="py-2 px-3">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
