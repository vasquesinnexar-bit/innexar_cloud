'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Plus, Loader2, MessageSquare, FolderOpen, Filter } from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';
import { ticketStatusClass, ticketStatusLabel } from '@/lib/status-labels';
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';
import { formatDateTime } from '@/lib/format';

interface Ticket {
  id: number;
  org_id: string;
  customer_id: number;
  subject: string;
  status: string;
  category?: string;
  project_id?: number | null;
  created_at: string;
}

export default function WorkspaceSupportTicketsPage() {
  const locale = useLocale();
  const orgFilter = useOrgFilter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);
    if (filterProjectId.trim()) params.set('project_id', filterProjectId.trim());
    const qs = params.toString();
    const base = withOrgQuery('/api/workspace/support/tickets', orgFilter);
    const url = qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
    workspaceFetch(url, { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTickets)
      .catch(() => setError('Erro ao carregar tickets'))
      .finally(() => setLoading(false));
  }, [filterCategory, filterProjectId, orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setFormSubject('');
    setFormCustomerId('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStaffToken();
    if (!token) return;
    const customerId = parseInt(formCustomerId, 10);
    if (Number.isNaN(customerId)) {
      setError('ID do cliente inválido');
      return;
    }
    setSaving(true);
    setError('');
    const res = await workspaceFetch(withOrgQuery('/api/workspace/support/tickets', orgFilter), {
      token,
      method: 'POST',
      body: JSON.stringify({ subject: formSubject, customer_id: customerId }),
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Suporte – Tickets</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-slate-400 text-sm">
            <Filter className="w-4 h-4" />
            Filtros:
          </span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="">Todas categorias</option>
            <option value="suporte">Suporte</option>
            <option value="suporte_tecnico">Suporte técnico</option>
            <option value="alteracao_site">Alteração site</option>
            <option value="modificacao">Modificação</option>
            <option value="novo_projeto">Novo projeto</option>
            <option value="financeiro">Financeiro</option>
          </select>
          <input
            type="number"
            placeholder="ID do projeto"
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="w-28 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500"
          />
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/15 text-sm"
          >
            Aplicar
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium"
          >
            <Plus className="w-5 h-5" />
            Novo ticket
          </button>
        </div>
      </div>

      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Região</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">ID</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Assunto</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Categoria</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Projeto</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Cliente</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Criado</th>
                  <th className="text-right py-4 px-4 text-slate-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${orgRegionBadgeClass(t.org_id)}`}
                      >
                        {orgRegionLabel(t.org_id)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{t.id}</td>
                    <td className="py-3 px-4 text-slate-300">{t.subject}</td>
                    <td className="py-3 px-4 text-slate-300 text-sm">
                      {t.category ?? '—'}
                    </td>
                    <td className="py-3 px-4">
                      {t.project_id != null ? (
                        <Link
                          href={`/${locale}/projects/${t.project_id}`}
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline text-sm"
                        >
                          <FolderOpen className="w-4 h-4" />
                          #{t.project_id}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{t.customer_id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs border ${ticketStatusClass(t.status)}`}
                      >
                        {ticketStatusLabel(t.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-sm">
                      {formatDateTime(t.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/${locale}/support/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-blue-400 hover:bg-blue-500/10 text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tickets.length === 0 && (
            <p className="py-12 text-center text-slate-400">Nenhum ticket.</p>
          )}
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
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Novo ticket</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Customer ID</label>
                <input
                  type="number"
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Assunto</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  required
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
