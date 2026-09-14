"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface ContractItem {
  id: number;
  description: string | null;
  quantity: number;
  unit_amount: number | null;
}

interface Contract {
  id: number;
  status: string;
  currency: string | null;
  billing_provider: string | null;
  billing_interval: string | null;
  credit_balance: number;
  items: ContractItem[];
}

interface Invoice {
  id: number;
  status: string;
  total: number;
  currency: string;
  due_date: string;
}

export function ContractsSection({ customerId }: { customerId: string }) {
  const orgFilter = useOrgFilter();
  const apiPath = (p: string) => withOrgQuery(p, orgFilter);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [interval, setInterval] = useState("monthly");
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACTS(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.INVOICES(customerId))),
      ]);
      if (cRes.ok) setContracts(await cRes.json());
      if (iRes.ok) setInvoices(await iRes.json());
    } catch {
      /* sem contratos */
    } finally {
      setLoading(false);
    }
  }, [customerId, apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  const open = invoices.filter((i) => ["pending", "past_due", "failed"].includes(i.status));
  const next = [...open].sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date))[0];
  const openTotal = open.reduce((s, i) => s + Number(i.total), 0);

  const create = async () => {
    setBusy(true);
    try {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACTS()), {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          billing_interval: interval,
          billing_provider: provider || null,
        }),
      });
      if (res.ok) {
        setShowNew(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" /> Contratos & Financeiro
        </h3>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium"
        >
          <Plus className="w-4 h-4" /> Novo contrato
        </button>
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <>
          <p className="text-slate-300 mb-3">
            Abertas: <strong>{open.length}</strong>
            {open.length > 0 && <> · Total: <strong>{openTotal.toFixed(2)}</strong></>}
            {next && (
              <> · Próxima: <strong>{next.currency} {Number(next.total).toFixed(2)}</strong> em{" "}
                {new Date(next.due_date).toLocaleDateString()}</>
            )}
          </p>
          {contracts.length === 0 ? (
            <p className="text-slate-400">Nenhum contrato.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">ID</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Gateway</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Intervalo</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Itens</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b border-white/5">
                      <td className="py-3 px-4">#{c.id}</td>
                      <td className="py-3 px-4">{c.status}</td>
                      <td className="py-3 px-4">{c.billing_provider ?? "auto"}</td>
                      <td className="py-3 px-4">{c.billing_interval ?? "—"}</td>
                      <td className="py-3 px-4">{c.items.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showNew && (
            <div className="grid gap-2 max-w-md mt-4">
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="biannual">Semestral</option>
                <option value="yearly">Anual</option>
                <option value="one_time">Único</option>
              </select>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <option value="">Auto (cliente/moeda)</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="stripe">Stripe</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={create} disabled={busy} className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium">Criar</button>
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-white/10">Fechar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
