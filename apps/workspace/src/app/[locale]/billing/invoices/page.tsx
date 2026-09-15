'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, Link2, Copy, CreditCard, Pencil, Trash2, X, Check } from 'lucide-react';
import { workspaceFetch, getStaffToken, getWorkspaceApiBase } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import { PaymentBrickModal, type InvoiceForPayment } from "@/components/payment-brick-modal";
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';
import { formatMoney, formatDate } from '@/lib/format';
import { invoiceStatusClass, invoiceStatusLabel } from '@/lib/status-labels';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';

const PORTAL_BASE =
  (typeof window !== 'undefined' && (window as unknown as { __PORTAL_URL?: string }).__PORTAL_URL) ||
  process.env.NEXT_PUBLIC_PORTAL_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? '';

interface Invoice {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  org_id?: string | null;
  subscription_id: number | null;
  status: string;
  due_date: string;
  paid_at: string | null;
  total: number;
  currency: string;
}

export default function WorkspaceBillingInvoicesPage() {
  const orgFilter = useOrgFilter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [paymentLinkId, setPaymentLinkId] = useState<number | null>(null);
  const [generateRecurringLoading, setGenerateRecurringLoading] = useState(false);

  const [bricksInvoice, setBricksInvoice] = useState<InvoiceForPayment | null>(null);

  // Edit/delete state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTotal, setEditTotal] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    workspaceFetch(withOrgQuery('/api/workspace/billing/invoices', orgFilter), { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setInvoices)
      .catch(() => setError('Erro ao carregar faturas'))
      .finally(() => setLoading(false));
  }, [orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runProcessOverdue = async () => {
    const token = getStaffToken();
    if (!token) return;
    setProcessingId(-1);
    setError('');
    const res = await workspaceFetch('/api/workspace/billing/process-overdue', {
      token,
      method: 'POST',
    });
    setProcessingId(null);
    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(
        data.processed != null ? `Processados: ${data.processed} inadimplentes` : 'Processamento concluído'
      );
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === 'string' ? data.detail : 'Erro ao executar');
    }
  };

  const runGenerateRecurring = async () => {
    const token = getStaffToken();
    if (!token) return;
    setGenerateRecurringLoading(true);
    setError('');
    const res = await workspaceFetch('/api/workspace/billing/generate-recurring-invoices', {
      token,
      method: 'POST',
    });
    setGenerateRecurringLoading(false);
    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(
        data.generated != null ? `${data.generated} faturas geradas` : 'Geração concluída'
      );
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === 'string' ? data.detail : 'Erro ao gerar faturas');
    }
  };

  const getPaymentLink = async (invoiceId: number) => {
    const token = getStaffToken();
    if (!token || !PORTAL_BASE) return;
    setPaymentLinkId(invoiceId);
    setError('');
    const successUrl = `${PORTAL_BASE}/payment/success`;
    const cancelUrl = `${PORTAL_BASE}/payment/cancel`;
    const url = `/api/workspace/billing/invoices/${invoiceId}/payment-link?success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;
    try {
      const res = await workspaceFetch(url, { token, method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setPaymentLinkId(null);
      if (res.ok && data.payment_url) {
        await navigator.clipboard.writeText(data.payment_url);
        setSuccessMsg('Link de pagamento copiado.');
      } else {
        setError(typeof data.detail === 'string' ? data.detail : 'Erro ao gerar link');
      }
    } catch {
      setPaymentLinkId(null);
      setError('Erro ao gerar link de pagamento');
    }
  };

  const openBricksModal = (inv: Invoice) => {
    setBricksInvoice({ id: inv.id, total: inv.total, currency: inv.currency || 'USD' });
  };

  const closeBricksModal = useCallback(() => {
    setBricksInvoice(null);
    load();
  }, [load]);

  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditTotal(inv.total.toFixed(2));
    setEditStatus(inv.status);
    setEditDueDate(inv.due_date.slice(0, 10));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTotal('');
    setEditStatus('');
    setEditDueDate('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const token = getStaffToken();
    if (!token) return;
    setEditSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      const inv = invoices.find((i) => i.id === editingId);
      if (!inv) return;
      if (parseFloat(editTotal) !== inv.total) body.total = parseFloat(editTotal);
      if (editStatus !== inv.status) body.status = editStatus;
      if (editDueDate !== inv.due_date.slice(0, 10)) body.due_date = new Date(editDueDate + 'T00:00:00Z').toISOString();
      if (Object.keys(body).length === 0) { cancelEdit(); return; }
      const res = await workspaceFetch(withOrgQuery(`/api/workspace/billing/invoices/${editingId}`, orgFilter), {
        token,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        cancelEdit();
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === 'string' ? data.detail : 'Erro ao salvar');
      }
    } catch {
      setError('Erro ao salvar fatura');
    } finally {
      setEditSaving(false);
    }
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (!confirm(`Excluir fatura #${inv.id} (${inv.currency} ${inv.total.toFixed(2)})?`)) return;
    const token = getStaffToken();
    if (!token) return;
    setDeletingId(inv.id);
    setError('');
    try {
      const res = await workspaceFetch(withOrgQuery(`/api/workspace/billing/invoices/${inv.id}`, orgFilter), {
        token,
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === 'string' ? data.detail : 'Erro ao excluir');
      }
    } catch {
      setError('Erro ao excluir fatura');
    } finally {
      setDeletingId(null);
    }
  };

  const refundInvoice = async (inv: Invoice) => {
    const reason = window.prompt(`Motivo do reembolso da fatura #${inv.id}?`);
    if (reason === null) return;
    if (!confirm(`Reembolsar ${inv.currency} ${inv.total.toFixed(2)} via gateway?`)) return;
    const token = getStaffToken();
    if (!token) return;
    setProcessingId(inv.id);
    setError('');
    try {
      const res = await workspaceFetch(withOrgQuery('/api/workspace/billing/refunds', orgFilter), {
        token,
        method: 'POST',
        body: JSON.stringify({ invoice_id: inv.id, reason: reason.trim() || null }),
      });
      if (res.ok) {
        setSuccessMsg(`Reembolso da fatura #${inv.id} registrado`);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? 'Erro ao reembolsar'));
      }
    } catch {
      setError('Erro ao reembolsar');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faturas"
        description="Cobranças, links de pagamento e inadimplência por região."
        onRefresh={load}
        actions={
          <>
            <button
              onClick={runGenerateRecurring}
              disabled={generateRecurringLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50 text-sm"
            >
              {generateRecurringLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              Gerar recorrentes
            </button>
            <button
              onClick={runProcessOverdue}
              disabled={processingId !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 text-sm"
            >
              {processingId !== null ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Inadimplência
            </button>
          </>
        }
      />
      {successMsg && (
        <AlertBanner variant="success" message={successMsg} onDismiss={() => setSuccessMsg('')} />
      )}
      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">ID</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Região</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Cliente</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Vencimento</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Total</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Pago em</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white font-medium">#{inv.id}</td>
                    <td className="py-3 px-4">
                      {inv.org_id ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${orgRegionBadgeClass(inv.org_id)}`}
                        >
                          {orgRegionLabel(inv.org_id)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {inv.customer_name ?? `#${inv.customer_id}`}
                    </td>
                    <td className="py-3 px-4">
                      {editingId === inv.id ? (
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="rounded-lg bg-white/10 border border-white/20 text-white text-sm px-2 py-1"
                        >
                          <option value="draft">Rascunho</option>
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                          <option value="overdue">Vencida</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs border ${invoiceStatusClass(inv.status)}`}
                        >
                          {invoiceStatusLabel(inv.status)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {editingId === inv.id ? (
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="rounded-lg bg-white/10 border border-white/20 text-white text-sm px-2 py-1"
                        />
                      ) : (
                        formatDate(inv.due_date)
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {editingId === inv.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{inv.currency}</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editTotal}
                            onChange={(e) => setEditTotal(e.target.value)}
                            className="w-24 rounded-lg bg-white/10 border border-white/20 text-white text-sm px-2 py-1"
                          />
                        </div>
                      ) : (
                        formatMoney(inv.total, inv.currency)
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {inv.paid_at ? formatDate(inv.paid_at) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {editingId === inv.id ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={editSaving}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium disabled:opacity-50"
                            >
                              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-slate-400 hover:bg-white/20 text-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(inv)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white text-sm"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {inv.status !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => deleteInvoice(inv)}
                                disabled={deletingId === inv.id}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm disabled:opacity-50"
                                title="Excluir"
                              >
                                {deletingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                            {inv.status === 'paid' && (
                              <button
                                type="button"
                                onClick={() => refundInvoice(inv)}
                                disabled={processingId === inv.id}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-sm disabled:opacity-50"
                                title="Reembolsar via gateway"
                              >
                                Reembolsar
                              </button>
                            )}
                            {inv.status !== 'paid' && (
                              <>
                                {MP_PUBLIC_KEY && (
                                  <button
                                    type="button"
                                    onClick={() => openBricksModal(inv)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    Bricks
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => getPaymentLink(inv.id)}
                                  disabled={paymentLinkId !== null}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium disabled:opacity-50"
                                >
                                  {paymentLinkId === inv.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                  Link pgto
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 && (
            <p className="py-12 text-center text-slate-400">Nenhuma fatura.</p>
          )}
        </div>
      )}

      <PaymentBrickModal
        open={!!bricksInvoice}
        onClose={closeBricksModal}
        invoice={bricksInvoice}
        mode="workspace"
        apiBase={getWorkspaceApiBase()}
        getToken={getStaffToken}
        onSuccess={load}
        mpPublicKey={MP_PUBLIC_KEY}
        containerId="mp-brick-container-workspace"
      />
    </div>
  );
}
