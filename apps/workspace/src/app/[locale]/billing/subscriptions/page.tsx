'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Ban, Receipt } from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';
import { EmptyState } from '@/components/empty-state';
import { formatMoney, formatDate } from '@/lib/format';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';

interface Subscription {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  org_id?: string | null;
  product_id: number;
  product_name?: string | null;
  price_plan_id: number;
  plan_amount?: number | null;
  plan_currency?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  next_due_date: string | null;
  created_at: string;
}

function subscriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Ativa',
    canceled: 'Cancelada',
    cancelled: 'Cancelada',
    suspended: 'Suspensa',
    pending: 'Pendente',
    past_due: 'Inadimplente',
  };
  return labels[status.toLowerCase()] || status;
}

function subscriptionStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (s === 'suspended' || s === 'past_due') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  if (s === 'canceled' || s === 'cancelled') return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
}

export default function WorkspaceBillingSubscriptionsPage() {
  const orgFilter = useOrgFilter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    workspaceFetch(withOrgQuery('/api/workspace/billing/subscriptions', orgFilter), { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSubscriptions)
      .catch(() => setError('Erro ao carregar assinaturas'))
      .finally(() => setLoading(false));
  }, [orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelSubscription = async (sub: Subscription) => {
    if (sub.status === 'canceled' || sub.status === 'cancelled') return;
    if (!confirm(`Cancelar assinatura #${sub.id} de ${sub.customer_name || 'cliente'}?`)) return;
    const token = getStaffToken();
    if (!token) return;
    setCancelingId(sub.id);
    setError('');
    const res = await workspaceFetch(
      withOrgQuery(`/api/workspace/billing/subscriptions/${sub.id}/cancel`, orgFilter),
      { token, method: 'POST' }
    );
    setCancelingId(null);
    if (res.ok) {
      setSuccessMsg(`Assinatura #${sub.id} cancelada`);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === 'string' ? data.detail : 'Erro ao cancelar');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Planos recorrentes por cliente e região"
      />
      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />}
      {successMsg && (
        <AlertBanner variant="success" message={successMsg} onDismiss={() => setSuccessMsg('')} />
      )}
      {loading ? (
        <TableSkeleton cols={7} rows={6} />
      ) : subscriptions.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma assinatura" description="Não há assinaturas para o filtro selecionado." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Região</th>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Próx. venc.</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white">#{sub.id}</td>
                  <td className="px-4 py-3 text-slate-200">
                    {sub.customer_name || `#${sub.customer_id}`}
                  </td>
                  <td className="px-4 py-3">
                    {sub.org_id && (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${orgRegionBadgeClass(sub.org_id)}`}
                      >
                        {orgRegionLabel(sub.org_id)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sub.product_name || `#${sub.product_id}`}</td>
                  <td className="px-4 py-3 text-slate-200">
                    {sub.plan_amount != null && sub.plan_currency
                      ? formatMoney(sub.plan_amount, sub.plan_currency)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${subscriptionStatusClass(sub.status)}`}
                    >
                      {subscriptionStatusLabel(sub.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {sub.next_due_date ? formatDate(sub.next_due_date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {sub.status !== 'canceled' && sub.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => cancelSubscription(sub)}
                        disabled={cancelingId === sub.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {cancelingId === sub.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        Cancelar
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
