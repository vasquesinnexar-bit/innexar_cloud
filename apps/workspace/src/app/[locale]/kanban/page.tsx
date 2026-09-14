'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';
import { projectStatusLabel, PROJECT_STATUS_LABELS } from '@/lib/status-labels';
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';

interface Project {
  id: number;
  org_id: string;
  customer_id: number;
  name: string;
  status: string;
  subscription_id?: number | null;
  expected_delivery_at?: string | null;
  created_at: string;
}

const STATUS_COLUMNS = Object.keys(PROJECT_STATUS_LABELS);

function statusLabel(s: string): string {
  return projectStatusLabel(s);
}

export default function WorkspaceKanbanPage() {
  const locale = useLocale();
  const orgFilter = useOrgFilter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    workspaceFetch(withOrgQuery('/api/workspace/projects', orgFilter), { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects)
      .catch(() => setError('Falha ao carregar projetos'))
      .finally(() => setLoading(false));
  }, [orgFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const byStatus = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const s of STATUS_COLUMNS) map[s] = [];
    for (const p of projects) {
      const key = STATUS_COLUMNS.includes(p.status) ? p.status : 'active';
      map[key].push(p);
    }
    return map;
  }, [projects]);

  const columnsToShow = useMemo(() => {
    const used = new Set(projects.map((p) => p.status));
    return STATUS_COLUMNS.filter(
      (s) => used.has(s) || s === 'aguardando_briefing' || s === 'active'
    );
  }, [projects]);

  const updateProjectStatus = useCallback(
    async (projectId: number, newStatus: string) => {
      const token = getStaffToken();
      if (!token) return;
      const res = await workspaceFetch(`/api/workspace/projects/${projectId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
    },
    []
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kanban – Produção" description="Projetos agrupados por status." />
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban – Produção"
        description="Projetos agrupados por status. Arraste mentalmente — clique para abrir."
        onRefresh={load}
      />
      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {(columnsToShow.length ? columnsToShow : ['active']).map((status) => (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-shrink-0 w-72 bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              {statusLabel(status)} ({byStatus[status]?.length ?? 0})
            </h3>
            <div className="space-y-2 min-h-[120px]">
              {(byStatus[status] || []).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors group"
                >
                  <Link
                    href={`/${locale}/projects/${p.id}`}
                    className="block"
                  >
                    <div className="flex items-start gap-2">
                      <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white text-sm truncate">{p.name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="text-xs text-slate-500">Cliente #{p.customer_id}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0 rounded-full border ${orgRegionBadgeClass(p.org_id)}`}
                          >
                            {orgRegionLabel(p.org_id)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <label className="sr-only" htmlFor={`status-${p.id}`}>
                      Alterar status
                    </label>
                    <select
                      id={`status-${p.id}`}
                      value={p.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateProjectStatus(p.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs rounded bg-white/10 text-slate-300 border border-white/10 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {STATUS_COLUMNS.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      {projects.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto text-slate-600 mb-2" />
          <p>Nenhum projeto.</p>
        </div>
      )}
    </div>
  );
}
