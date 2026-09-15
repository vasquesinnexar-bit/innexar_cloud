"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Link2, Eye, Server, Globe, ChevronDown } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface StackContainer {
  name: string;
  image: string | null;
  status: string | null;
  ports: string | null;
  service: string | null;
  role: string;
}

interface DiscoveredStack {
  key: string;
  compose_project: string | null;
  name: string;
  workdir: string | null;
  containers_total: number;
  containers_running: number;
  health: "healthy" | "degraded" | "stopped";
  roles: string[];
  domains: string[];
  stack_type: "customer_service" | "platform_infra";
  containers: StackContainer[];
  linked: { stack_id: number; customer_id: number; name: string; status: string } | null;
}

interface CustomerOpt {
  id: number;
  name: string;
  email: string;
}

interface ContractItemOpt {
  id: number;
  description: string | null;
}

interface ContractOpt {
  id: number;
  status: string;
  items: ContractItemOpt[];
}

const ROLE_LABEL: Record<string, string> = {
  web: "Web",
  api: "API",
  database: "Database",
  storage: "Storage",
  cache: "Cache",
  worker: "Worker",
  queue: "Queue",
  proxy: "Proxy",
  other: "Outro",
};

const HEALTH_STYLE: Record<string, string> = {
  healthy: "bg-emerald-500/15 text-emerald-300",
  degraded: "bg-amber-500/15 text-amber-300",
  stopped: "bg-red-500/15 text-red-300",
};

export default function HostingSitesPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [stacks, setStacks] = useState<DiscoveredStack[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showInfra, setShowInfra] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  // wizard de vínculo
  const [linkKey, setLinkKey] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [contracts, setContracts] = useState<ContractOpt[]>([]);
  const [contractItemId, setContractItemId] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.STACKS_DISCOVERY));
    if (res.ok) setStacks(await res.json());
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const openWizard = async (s: DiscoveredStack) => {
    setLinkKey(s.key);
    setCustomerId("");
    setContracts([]);
    setContractItemId("");
    setFriendlyName(s.name);
    setDomain(s.domains[0] ?? "");
    setError("");
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.CUSTOMERS.LIST));
    if (res.ok) setCustomers(await res.json());
  };

  const onCustomer = async (id: string) => {
    setCustomerId(id);
    setContractItemId("");
    setContracts([]);
    if (!id) return;
    const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACTS(Number(id))));
    if (res.ok) setContracts(await res.json());
  };

  const link = async (s: DiscoveredStack) => {
    setBusy(true);
    setError("");
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.HOSTING.STACK_LINK), {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          compose_project: s.compose_project,
          container_names: s.containers.map((c) => c.name),
          contract_item_id: contractItemId ? Number(contractItemId) : null,
          name: friendlyName || s.name,
          primary_domain: domain || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.detail?.message ?? `HTTP ${res.status}`);
      }
      setLinkKey(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao vincular stack");
    } finally {
      setBusy(false);
    }
  };

  const rows = stacks.filter(
    (s) =>
      !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.domains.some((d) => d.toLowerCase().includes(filter.toLowerCase()))
  );
  const customerStacks = rows.filter((s) => s.stack_type === "customer_service");
  const infraStacks = rows.filter((s) => s.stack_type === "platform_infra");

  const card = (s: DiscoveredStack) => (
    <div key={s.key} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{s.name}</h3>
          <p className="text-xs text-slate-400">
            {s.compose_project ? `compose: ${s.compose_project}` : "standalone"} ·{" "}
            {s.containers_total} container{s.containers_total === 1 ? "" : "s"} ·{" "}
            {s.containers_running} rodando
          </p>
        </div>
        <span className={`px-2 py-1 rounded-lg text-xs ${HEALTH_STYLE[s.health]}`}>
          {s.health === "healthy" ? "Healthy" : s.health === "degraded" ? "Degradado" : "Parado"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {s.roles.map((r) => (
          <span key={r} className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 text-xs">
            {ROLE_LABEL[r] ?? r}
          </span>
        ))}
      </div>
      {s.domains.length > 0 && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Globe className="w-3 h-3" /> {s.domains.join(", ")}
        </p>
      )}
      {s.linked ? (
        <p className="text-xs text-emerald-300">
          Vinculada: {s.linked.name} (cliente #{s.linked.customer_id})
        </p>
      ) : (
        s.stack_type === "customer_service" && (
          <p className="text-xs text-slate-500">Cliente: não vinculado</p>
        )
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setExpanded(expanded === s.key ? null : s.key)}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
        >
          <Eye className="w-4 h-4" /> Visualizar
        </button>
        {!s.linked && s.stack_type === "customer_service" && (
          <button
            type="button"
            onClick={() => openWizard(s)}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-sm flex items-center gap-1"
          >
            <Link2 className="w-4 h-4" /> Vincular cliente
          </button>
        )}
      </div>
      {expanded === s.key && (
        <div className="pt-2 space-y-1 border-t border-white/10">
          {s.containers.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white truncate">
                    {ROLE_LABEL[c.role] ?? c.role}{" "}
                    <code className="text-slate-400 text-xs">{c.name}</code>
                  </p>
                  <p className="text-xs text-slate-500 truncate">{c.image ?? "—"}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{c.status ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
      {linkKey === s.key && (
        <div className="pt-3 space-y-2 border-t border-white/10" role="dialog" aria-label="Vincular stack">
          <p className="text-sm font-medium text-white">Vincular stack — {s.name}</p>
          <label className="block text-xs text-slate-400">
            1. Cliente
            <select
              value={customerId}
              onChange={(e) => onCustomer(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            >
              <option value="">Selecionar…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            2. Contrato/Serviço (opcional)
            <select
              value={contractItemId}
              onChange={(e) => setContractItemId(e.target.value)}
              disabled={!customerId}
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white disabled:opacity-50"
            >
              <option value="">Nenhum</option>
              {contracts.flatMap((ct) =>
                ct.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    Contrato #{ct.id} · {it.description ?? `item #${it.id}`}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            3. Nome amigável
            <input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            4. Domínio principal (opcional)
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="ex: cliente.com.br"
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            />
          </label>
          <p className="text-xs text-slate-500">
            5. Confirmar vincula a stack inteira ({s.containers_total} container
            {s.containers_total === 1 ? "" : "s"} vão juntos, automaticamente).
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => link(s)}
              disabled={busy || !customerId}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm disabled:opacity-50"
            >
              {busy ? "Vinculando…" : "Confirmar vínculo"}
            </button>
            <button
              type="button"
              onClick={() => setLinkKey(null)}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Radar className="w-6 h-6" /> Sites & Descoberta
      </h1>
      <div className="flex gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por stack, domínio…"
          className="w-full max-w-md px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
        />
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
        >
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">{customerStacks.map(card)}</div>
      {customerStacks.length === 0 && (
        <p className="text-slate-400">Nenhuma stack de cliente encontrada.</p>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl">
        <button
          type="button"
          onClick={() => setShowInfra(!showInfra)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-slate-300"
          aria-expanded={showInfra}
        >
          Infra da plataforma ({infraStacks.length}) — não vinculável
          <ChevronDown className={`w-4 h-4 transition-transform ${showInfra ? "rotate-180" : ""}`} />
        </button>
        {showInfra && (
          <div className="px-5 pb-4 grid gap-3 md:grid-cols-2">
            {infraStacks.map(card)}
          </div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl">
        <button
          type="button"
          onClick={() => setShowTechnical(!showTechnical)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-slate-300"
          aria-expanded={showTechnical}
        >
          Visão técnica (containers)
          <ChevronDown className={`w-4 h-4 transition-transform ${showTechnical ? "rotate-180" : ""}`} />
        </button>
        {showTechnical && (
          <div className="px-5 pb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-slate-400">Container</th>
                  <th className="text-left py-2 px-3 text-slate-400">Stack</th>
                  <th className="text-left py-2 px-3 text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.flatMap((s) =>
                  s.containers.map((c) => (
                    <tr key={c.name} className="border-b border-white/5">
                      <td className="py-2 px-3"><code>{c.name}</code></td>
                      <td className="py-2 px-3 text-slate-400">{s.name}</td>
                      <td className="py-2 px-3">{c.status ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
