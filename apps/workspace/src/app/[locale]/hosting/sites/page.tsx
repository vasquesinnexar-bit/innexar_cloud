"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Link2, RotateCw, Square, Play } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Discovered {
  name: string;
  image: string;
  status: string;
  ports: string;
  project: string | null;
  workdir: string | null;
  service: string | null;
}

interface Svc {
  id: number;
  customer_id: number;
  container_name: string | null;
  primary_domain: string | null;
  status: string;
  root_path: string | null;
}

export default function HostingSitesPage() {
  const orgFilter = useOrgFilter();
  const apiPath = (p: string) => withOrgQuery(p, orgFilter);
  const [disc, setDisc] = useState<Discovered[]>([]);
  const [services, setServices] = useState<Svc[]>([]);
  const [filter, setFilter] = useState("");
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [rootPath, setRootPath] = useState("/app");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [dRes, sRes] = await Promise.all([
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.DISCOVERY)),
      workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.SERVICES())),
    ]);
    if (dRes.ok) setDisc(await dRes.json());
    if (sRes.ok) setServices(await sRes.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const linked = new Set(services.map((s) => s.container_name));
  const rows = disc.filter(
    (d) =>
      !filter ||
      d.name.toLowerCase().includes(filter.toLowerCase()) ||
      (d.project ?? "").toLowerCase().includes(filter.toLowerCase())
  );

  const link = async (name: string) => {
    setBusy(name);
    setError("");
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.SERVICES()), {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          container_name: name,
          root_path: rootPath || "/app",
          path_mode: "container",
          primary_domain: domain || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLinkFor(null);
      setCustomerId("");
      setDomain("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao vincular");
    } finally {
      setBusy(null);
    }
  };

  const power = async (id: number, action: "restart" | "stop" | "start") => {
    setBusy(`${action}-${id}`);
    try {
      const fn =
        action === "restart"
          ? WORKSPACE_API_PATHS.HOSTING.SERVICE_RESTART(id)
          : action === "stop"
            ? WORKSPACE_API_PATHS.HOSTING.SERVICE_STOP(id)
            : WORKSPACE_API_PATHS.HOSTING.SERVICE_START(id);
      await workspaceFetchStaff(apiPath(fn), { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Radar className="w-6 h-6" /> Sites & Descoberta
      </h1>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por nome, projeto…"
        className="w-full max-w-md px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
      />
      {error && <p className="text-red-400">{error}</p>}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-slate-400">Container</th>
              <th className="text-left py-2 px-3 text-slate-400">Imagem</th>
              <th className="text-left py-2 px-3 text-slate-400">Status</th>
              <th className="text-left py-2 px-3 text-slate-400">Projeto</th>
              <th className="text-left py-2 px-3 text-slate-400">Vínculo</th>
              <th className="text-left py-2 px-3 text-slate-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const svc = services.find((s) => s.container_name === d.name);
              return (
                <tr key={d.name} className="border-b border-white/5">
                  <td className="py-2 px-3"><code>{d.name}</code></td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-[220px]">{d.image}</td>
                  <td className="py-2 px-3">{d.status}</td>
                  <td className="py-2 px-3 text-slate-400">{d.project ?? "—"}</td>
                  <td className="py-2 px-3">{svc ? `#${svc.id} · ${svc.status}` : "—"}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      {!svc && (
                        <button
                          type="button"
                          onClick={() => setLinkFor(d.name)}
                          className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" /> Vincular
                        </button>
                      )}
                      {svc && (
                        <>
                          <button
                            type="button"
                            onClick={() => power(svc.id, "restart")}
                            disabled={busy === `restart-${svc.id}`}
                            className="px-2 py-1 rounded-lg bg-white/10 text-xs flex items-center gap-1"
                            title="Restart"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => power(svc.id, "stop")}
                            disabled={busy === `stop-${svc.id}`}
                            className="px-2 py-1 rounded-lg bg-white/10 text-xs"
                            title="Stop"
                          >
                            <Square className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => power(svc.id, "start")}
                            disabled={busy === `start-${svc.id}`}
                            className="px-2 py-1 rounded-lg bg-white/10 text-xs"
                            title="Start"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    {linkFor === d.name && (
                      <div className="grid gap-1 mt-2 min-w-[220px]">
                        <input
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          placeholder="customer_id"
                          inputMode="numeric"
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs"
                        />
                        <input
                          value={rootPath}
                          onChange={(e) => setRootPath(e.target.value)}
                          placeholder="root no container (ex: /app)"
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs"
                        />
                        <input
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          placeholder="domínio primário (opcional)"
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => link(d.name)}
                            disabled={busy === d.name || !customerId}
                            className="px-2 py-1 rounded-lg bg-blue-500 text-xs"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setLinkFor(null)}
                            className="px-2 py-1 rounded-lg bg-white/10 text-xs"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
