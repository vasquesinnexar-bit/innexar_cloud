'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  User,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import {
  orgRegionBadgeClass,
  orgRegionLabel,
} from '@/lib/org-labels';
import { useOrgFilter } from '@/hooks/use-org-filter';

interface Lead {
  id: number;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  message: string | null;
  status: string;
  extra_data: Record<string, string> | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost', label: 'Perdido' },
];

const STATUS_LABELS: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

export default function WorkspaceLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const orgFilter = useOrgFilter();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (orgFilter !== 'all') params.set('org_id', orgFilter);
    const qs = params.toString();
    workspaceFetch(`/api/workspace/crm/leads${qs ? `?${qs}` : ''}`, { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLeads)
      .catch(() => setError('Falha ao carregar leads'))
      .finally(() => setLoading(false));
  }, [statusFilter, orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (leadId: number, status: string) => {
    const token = getStaffToken();
    if (!token) return;
    setUpdatingId(leadId);
    const res = await workspaceFetch(`/api/workspace/crm/contacts/${leadId}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null);
    if (res.ok) load();
    else setError('Falha ao atualizar status');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 text-sm mt-1">
            Formulários do site, emails inbound e capturas públicas
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
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
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          Nenhum lead encontrado.
        </div>
      ) : (
        <div className="grid gap-4">
          {leads.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-semibold text-lg">
                      {lead.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${orgRegionBadgeClass(lead.org_id)}`}
                    >
                      {orgRegionLabel(lead.org_id)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs">
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                    {lead.source && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-xs">
                        {lead.source}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    {lead.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {lead.email}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {lead.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      #{lead.id} ·{' '}
                      {new Date(lead.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {lead.message && (
                    <p className="text-slate-300 text-sm whitespace-pre-wrap mt-2 bg-black/20 rounded-lg p-3">
                      {lead.message}
                    </p>
                  )}
                  {lead.extra_data && Object.keys(lead.extra_data).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(lead.extra_data).map(([k, v]) =>
                        v ? (
                          <span
                            key={k}
                            className="text-xs px-2 py-1 rounded bg-white/5 text-slate-400"
                          >
                            {k}: {String(v)}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
                <select
                  value={lead.status}
                  disabled={updatingId === lead.id}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
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
