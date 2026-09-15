"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Trash2, Receipt } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface ContractItem {
  id: number;
  product_id: number | null;
  price_plan_id: number | null;
  subscription_id: number | null;
  description: string | null;
  quantity: number;
  unit_amount: number | null;
  source: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  portal: "Portal",
  workspace: "Administrador",
  migration: "Migração",
};

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

interface PricePlan {
  id: number;
  name: string;
  interval: string;
  amount: number;
  currency: string;
}

interface Product {
  id: number;
  name: string;
  price_plans?: PricePlan[];
}

export function ContractsSection({ customerId }: { customerId: string }) {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [interval, setInterval] = useState("monthly");
  const [provider, setProvider] = useState("");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  // add item
  const [itemProduct, setItemProduct] = useState("");
  const [itemPlan, setItemPlan] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  // edit item
  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  // invoice
  const [invDue, setInvDue] = useState("");
  const [invFor, setInvFor] = useState<number | null>(null);
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, iRes, pRes] = await Promise.all([
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACTS(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.INVOICES(customerId))),
        workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.PRODUCTS(true))),
      ]);
      if (cRes.ok) setContracts(await cRes.json());
      if (iRes.ok) setInvoices(await iRes.json());
      if (pRes.ok) setProducts(await pRes.json());
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

  const productName = (id: number | null) =>
    id == null ? "—" : (products.find((p) => p.id === id)?.name ?? `Produto #${id}`);
  const planOf = (pid: number | null, planId: number | null) =>
    products.find((p) => p.id === pid)?.price_plans?.find((pp) => pp.id === planId);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const errOf = async (res: Response) => {
    const j = await res.json().catch(() => null);
    return j?.detail?.message ?? j?.detail ?? `HTTP ${res.status}`;
  };

  const create = () =>
    act("new", async () => {
      const res = await workspaceFetchStaff(apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACTS()), {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          billing_interval: interval,
          billing_provider: provider || null,
          currency: currency || null,
        }),
      });
      if (!res.ok) throw new Error(await errOf(res));
      setShowNew(false);
    });

  const setStatus = (id: number, status: string) =>
    act(`st-${id}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(`${WORKSPACE_API_PATHS.BILLING.CONTRACTS()}/${id}`),
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      if (!res.ok) throw new Error(await errOf(res));
    });

  const onProduct = (pid: string) => {
    setItemProduct(pid);
    setItemPlan("");
    setItemPrice("");
    const p = products.find((x) => x.id === Number(pid));
    const first = p?.price_plans?.[0];
    if (first) {
      setItemPlan(String(first.id));
      setItemPrice(String(first.amount));
    }
  };

  const addItem = (contractId: number) =>
    act(`add-${contractId}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACT_ITEMS(contractId)),
        {
          method: "POST",
          body: JSON.stringify({
            product_id: itemProduct ? Number(itemProduct) : null,
            price_plan_id: itemPlan ? Number(itemPlan) : null,
            quantity: Number(itemQty) || 1,
            unit_amount: itemPrice === "" ? null : Number(itemPrice),
            description: itemDesc || null,
          }),
        }
      );
      if (!res.ok) throw new Error(await errOf(res));
      setItemProduct("");
      setItemPlan("");
      setItemQty("1");
      setItemPrice("");
      setItemDesc("");
    });

  const saveEdit = (itemId: number) =>
    act(`ed-${itemId}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACT_ITEM(itemId)),
        {
          method: "PATCH",
          body: JSON.stringify({
            quantity: editQty === "" ? null : Number(editQty),
            unit_amount: editPrice === "" ? null : Number(editPrice),
          }),
        }
      );
      if (!res.ok) throw new Error(await errOf(res));
      setEditId(null);
    });

  const removeItem = (itemId: number) =>
    act(`del-${itemId}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACT_ITEM(itemId)),
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await errOf(res));
    });

  const genInvoice = (contractId: number) =>
    act(`inv-${contractId}`, async () => {
      const res = await workspaceFetchStaff(
        apiPath(WORKSPACE_API_PATHS.BILLING.CONTRACT_INVOICE(contractId)),
        {
          method: "POST",
          body: JSON.stringify({ due_date: invDue || null }),
        }
      );
      if (!res.ok) throw new Error(await errOf(res));
      setLastInvoice(await res.json());
      setInvFor(null);
      setInvDue("");
    });

  const itemTotal = (c: Contract) =>
    c.items.reduce((s, i) => s + (i.unit_amount ?? 0) * (i.quantity || 1), 0);

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
          {error && <p className="text-red-400 mb-2">{error}</p>}
          {lastInvoice && (
            <p className="text-emerald-300 mb-2">
              Fatura #{lastInvoice.id} criada: {lastInvoice.currency} {Number(lastInvoice.total).toFixed(2)}.
            </p>
          )}
          {contracts.length === 0 ? (
            <p className="text-slate-400">Nenhum contrato.</p>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-white font-medium">
                      Contrato #{c.id} · {c.status} · {c.billing_provider ?? "auto"} · {c.billing_interval ?? "—"}
                      {c.currency ? ` · ${c.currency}` : ""} · {c.items.length} item(ns) ·{" "}
                      {c.currency ?? ""} {itemTotal(c).toFixed(2)}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        className="px-2 py-1 rounded-lg bg-white/10 text-xs"
                      >
                        {expanded === c.id ? "Ocultar itens" : "Itens"}
                      </button>
                      {(c.status === "pending" || c.status === "suspended") && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "active")}
                          disabled={busy === `st-${c.id}`}
                          className="px-2 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs"
                        >
                          Ativar
                        </button>
                      )}
                      {c.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setStatus(c.id, "suspended")}
                          disabled={busy === `st-${c.id}`}
                          className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs"
                        >
                          Suspender
                        </button>
                      )}
                      {c.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Cancelar contrato #${c.id}?`)) setStatus(c.id, "cancelled");
                          }}
                          disabled={busy === `st-${c.id}`}
                          className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setInvFor(invFor === c.id ? null : c.id)}
                        className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-200 text-xs flex items-center gap-1"
                      >
                        <Receipt className="w-3 h-3" /> Gerar fatura
                      </button>
                    </div>
                  </div>
                  {invFor === c.id && (
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      <input
                        type="date"
                        value={invDue}
                        onChange={(e) => setInvDue(e.target.value)}
                        className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs"
                        aria-label="Vencimento"
                      />
                      <button
                        type="button"
                        onClick={() => genInvoice(c.id)}
                        disabled={busy === `inv-${c.id}`}
                        className="px-2 py-1 rounded-lg bg-blue-500 text-xs"
                      >
                        Criar fatura dos itens
                      </button>
                    </div>
                  )}
                  {expanded === c.id && (
                    <div className="mt-3 space-y-2">
                      {c.items.length === 0 ? (
                        <p className="text-slate-500 text-sm">Sem itens.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-1 px-2 text-slate-400 font-medium">Produto/Descrição</th>
                              <th className="text-left py-1 px-2 text-slate-400 font-medium">Qtd</th>
                              <th className="text-left py-1 px-2 text-slate-400 font-medium"> Unitário</th>
                              <th className="text-left py-1 px-2 text-slate-400 font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.items.map((it) => (
                              <tr key={it.id} className="border-b border-white/5">
                                <td className="py-1 px-2">
                                  {it.description ?? productName(it.product_id)}
                                  <span className="text-slate-500 text-xs block">
                                    {it.product_id ? productName(it.product_id) : ""}
                                    {it.price_plan_id ? ` · ${planOf(it.product_id, it.price_plan_id)?.name ?? `plano #${it.price_plan_id}`}` : ""}
                                    {it.source ? ` · Origem: ${SOURCE_LABEL[it.source] ?? it.source}` : ""}
                                  </span>
                                </td>
                                <td className="py-1 px-2">
                                  {editId === it.id ? (
                                    <input value={editQty} onChange={(e) => setEditQty(e.target.value)} inputMode="numeric" className="w-16 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs" />
                                  ) : (
                                    it.quantity
                                  )}
                                </td>
                                <td className="py-1 px-2">
                                  {editId === it.id ? (
                                    <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} inputMode="decimal" className="w-24 px-1 py-0.5 rounded bg-white/5 border border-white/10 text-xs" />
                                  ) : (
                                    it.unit_amount ?? "—"
                                  )}
                                </td>
                                <td className="py-1 px-2">
                                  {editId === it.id ? (
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => saveEdit(it.id)} disabled={busy === `ed-${it.id}`} className="px-2 py-0.5 rounded bg-blue-500 text-xs">Salvar</button>
                                      <button type="button" onClick={() => setEditId(null)} className="px-2 py-0.5 rounded bg-white/10 text-xs">Fechar</button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => { setEditId(it.id); setEditQty(String(it.quantity)); setEditPrice(it.unit_amount == null ? "" : String(it.unit_amount)); }}
                                        className="px-2 py-0.5 rounded bg-white/10 text-xs"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Remover item #${it.id}?`)) removeItem(it.id);
                                        }}
                                        disabled={busy === `del-${it.id}`}
                                        className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 text-xs"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="grid gap-1 max-w-md pt-1">
                        <p className="text-xs text-slate-400">Adicionar item</p>
                        <select value={itemProduct} onChange={(e) => onProduct(e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white">
                          <option value="">Produto (opcional)</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select value={itemPlan} onChange={(e) => {
                          setItemPlan(e.target.value);
                          const pl = products.find((p) => p.id === Number(itemProduct))?.price_plans?.find((x) => x.id === Number(e.target.value));
                          if (pl) setItemPrice(String(pl.amount));
                        }} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white">
                          <option value="">Plano (opcional)</option>
                          {(products.find((p) => p.id === Number(itemProduct))?.price_plans ?? []).map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.name} — {pl.currency} {pl.amount}</option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <input value={itemQty} onChange={(e) => setItemQty(e.target.value)} inputMode="numeric" placeholder="Qtd" className="w-20 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs" />
                          <input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} inputMode="decimal" placeholder="Preço unit." className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs" />
                        </div>
                        <input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="Descrição (opcional)" className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs" />
                        <button type="button" onClick={() => addItem(c.id)} disabled={busy === `add-${c.id}`} className="px-2 py-1 rounded-lg bg-blue-500 text-xs w-fit">
                          Adicionar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white">
                <option value="">Moeda do cliente</option>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={create} disabled={busy === "new"} className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium">Criar</button>
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-white/10">Fechar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
