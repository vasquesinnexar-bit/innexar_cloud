'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Briefcase,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  workspaceFetch,
  getStaffToken,
  parseWorkspaceError,
} from '@/lib/workspace-api';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';
import { useOrgFilter } from '@/hooks/use-org-filter';

interface Representative {
  id: number;
  org_id: string;
  user_id: number;
  name: string;
  region: string | null;
  commission_pct: string;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

export default function RepresentativesPage() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const orgFilter = useOrgFilter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    name: '',
    region: '',
    commission_pct: '0',
  });

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (orgFilter !== 'all') params.set('org_id', orgFilter);
    const qs = params.toString();
    workspaceFetch(`/api/workspace/reps${qs ? `?${qs}` : ''}`, { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setReps)
      .catch(() => setError('Falha ao carregar representantes'))
      .finally(() => setLoading(false));
  }, [statusFilter, orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (repId: number, status: string) => {
    const token = getStaffToken();
    if (!token) return;
    const res = await workspaceFetch(`/api/workspace/reps/${repId}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
    else setError('Falha ao atualizar status');
  };

  const createRep = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStaffToken();
    if (!token) return;
    setSaving(true);
    setError('');
    const res = await workspaceFetch('/api/workspace/reps', {
      token,
      method: 'POST',
      body: JSON.stringify({
        user_id: Number(form.user_id),
        name: form.name,
        region: form.region || null,
        commission_pct: form.commission_pct,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ user_id: '', name: '', region: '', commission_pct: '0' });
      setShowForm(false);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(parseWorkspaceError(data));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Representantes Comerciais</h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastro do time de vendas interno da Innexar
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Novo representante
          </button>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={createRep}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">Novo representante</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Informe o ID do usuário de staff já existente que este representante vai usar para logar
            (crie o usuário primeiro na tela de gestão de usuários, se ainda não existir).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="ID do usuário (staff)"
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              required
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <input
              type="text"
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <input
              type="text"
              placeholder="Região (ex: SP, Sudeste)"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <input
              type="number"
              step="0.01"
              placeholder="% de comissão"
              value={form.commission_pct}
              onChange={(e) => setForm({ ...form, commission_pct: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </motion.form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : reps.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          Nenhum representante cadastrado.
        </div>
      ) : (
        <div className="grid gap-4">
          {reps.map((rep, i) => (
            <motion.div
              key={rep.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span className="text-white font-semibold text-lg">
                      {rep.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${orgRegionBadgeClass(rep.org_id)}`}
                    >
                      {orgRegionLabel(rep.org_id)}
                    </span>
                    {rep.region && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-xs">
                        {rep.region}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>Comissão: {rep.commission_pct}%</span>
                    <span>User ID: #{rep.user_id}</span>
                    <span>
                      Desde {new Date(rep.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <select
                  value={rep.status}
                  onChange={(e) => updateStatus(rep.id, e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
