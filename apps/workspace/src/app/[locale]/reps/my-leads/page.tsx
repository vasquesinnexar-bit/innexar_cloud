'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  User,
  RefreshCw,
  MessageSquarePlus,
} from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';

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

interface Representative {
  id: number;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'closed_won', label: 'Ganho' },
  { value: 'closed_lost', label: 'Perdido' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

export default function MyLeadsPage() {
  const [rep, setRep] = useState<Representative | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [noteOpenFor, setNoteOpenFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    setError('');
    workspaceFetch('/api/workspace/reps/me', { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((repData) => {
        setRep(repData);
        return workspaceFetch('/api/workspace/crm/leads', { token });
      })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLeads)
      .catch(() => setError('Falha ao carregar seus leads'))
      .finally(() => setLoading(false));
  }, []);

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

  const saveNote = async (leadId: number) => {
    const token = getStaffToken();
    if (!token || !noteText.trim()) return;
    setSavingNote(true);
    const res = await workspaceFetch(
      `/api/workspace/crm/contacts/${leadId}/activities`,
      {
        token,
        method: 'POST',
        body: JSON.stringify({ activity_type: 'note', note: noteText }),
      }
    );
    setSavingNote(false);
    if (res.ok) {
      setNoteText('');
      setNoteOpenFor(null);
    } else {
      setError('Falha ao salvar nota');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Leads</h1>
          <p className="text-slate-400 text-sm mt-1">
            {rep
              ? `Leads atribuídos a você, ${rep.name}`
              : 'Você ainda não tem um perfil de representante vinculado - fale com um admin.'}
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
          Nenhum lead atribuído a você ainda.
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

                  {noteOpenFor === lead.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Nota sobre o contato, próximos passos..."
                        rows={2}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveNote(lead.id)}
                          disabled={savingNote}
                          className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          {savingNote ? 'Salvando...' : 'Salvar nota'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteOpenFor(null);
                            setNoteText('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-sm hover:bg-white/10"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteOpenFor(lead.id)}
                      className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Adicionar nota
                    </button>
                  )}
                </div>
                <select
                  value={lead.status}
                  disabled={updatingId === lead.id}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {STATUS_OPTIONS.map((opt) => (
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
