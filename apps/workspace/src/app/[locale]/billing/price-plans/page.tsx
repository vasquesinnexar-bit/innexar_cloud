'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2, CreditCard } from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import {
  defaultCurrencyForOrg,
  orgRegionBadgeClass,
  orgRegionLabel,
  ORG_INNEXAR_BR,
} from '@/lib/org-labels';
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';
import { EmptyState } from '@/components/empty-state';
import { formatMoney } from '@/lib/format';
import { intervalLabel } from '@/lib/status-labels';

interface PricePlan {
  id: number;
  product_id: number;
  name: string;
  interval: string;
  amount: number;
  currency: string;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  org_id: string;
}

export default function WorkspaceBillingPricePlansPage() {
  const orgFilter = useOrgFilter();
  const [plans, setPlans] = useState<PricePlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formProductId, setFormProductId] = useState('');
  const [formName, setFormName] = useState('');
  const [formInterval, setFormInterval] = useState('month');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const productOrgById = Object.fromEntries(products.map((p) => [p.id, p.org_id]));
  const productNameById = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    Promise.all([
      workspaceFetch(withOrgQuery('/api/workspace/billing/price-plans', orgFilter), {
        token,
      }).then((r) => (r.ok ? r.json() : [])),
      workspaceFetch(withOrgQuery('/api/workspace/billing/products', orgFilter), { token }).then(
        (r) => (r.ok ? r.json() : [])
      ),
    ])
      .then(([pl, pr]) => {
        setPlans(pl);
        setProducts(pr);
      })
      .catch(() => setError('Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    const filtered =
      orgFilter === 'all'
        ? products
        : products.filter((p) => p.org_id === orgFilter);
    setFormProductId(filtered[0]?.id ? String(filtered[0].id) : '');
    setFormName('');
    setFormInterval('month');
    setFormAmount('');
    setFormCurrency(
      orgFilter === ORG_INNEXAR_BR
        ? 'BRL'
        : orgFilter === 'all'
          ? 'USD'
          : defaultCurrencyForOrg(orgFilter)
    );
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStaffToken();
    if (!token) return;
    const productId = parseInt(formProductId, 10);
    const amount = parseFloat(formAmount);
    if (Number.isNaN(productId) || Number.isNaN(amount)) {
      setError('Produto e valor sao obrigatorios');
      return;
    }
    setSaving(true);
    setError('');
    const res = await workspaceFetch('/api/workspace/billing/price-plans', {
      token,
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        name: formName,
        interval: formInterval,
        amount,
        currency: formCurrency,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === 'string' ? data.detail : 'Erro ao criar');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos de preço"
        description="Valores e periodicidade por produto — Brasil (BRL) e EUA (USD)."
        onRefresh={load}
        actions={
          <button
            onClick={openCreate}
            disabled={products.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Novo plano
          </button>
        }
      />

      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum plano"
          description="Crie produtos primeiro ou altere o filtro de região."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-blue-400 flex-shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{p.name}</p>
                    {productOrgById[p.product_id] && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${orgRegionBadgeClass(productOrgById[p.product_id])}`}
                      >
                        {orgRegionLabel(productOrgById[p.product_id])}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {productNameById[p.product_id] ?? `Produto #${p.product_id}`} ·{' '}
                    {intervalLabel(p.interval)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-lg font-bold text-white">
                {formatMoney(p.amount, p.currency)}
                <span className="text-sm font-normal text-slate-400"> / {intervalLabel(p.interval)}</span>
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Novo plano de preço</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Produto</label>
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                >
                  {(orgFilter === 'all'
                    ? products
                    : products.filter((p) => p.org_id === orgFilter)
                  ).map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({orgRegionLabel(pr.org_id)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Intervalo</label>
                <select
                  value={formInterval}
                  onChange={(e) => setFormInterval(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                >
                  <option value="month">Mensal</option>
                  <option value="year">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Moeda</label>
                <input
                  type="text"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
