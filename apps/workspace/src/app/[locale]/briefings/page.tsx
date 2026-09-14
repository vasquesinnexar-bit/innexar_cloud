'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { FileText, FolderOpen, Download, ExternalLink } from 'lucide-react';
import { workspaceFetch, getStaffToken } from '@/lib/workspace-api';
import { withOrgQuery } from '@/lib/org-filter';
import { useOrgFilter } from '@/hooks/use-org-filter';
import { orgRegionBadgeClass, orgRegionLabel } from '@/lib/org-labels';
import { PageHeader } from '@/components/page-header';
import { AlertBanner } from '@/components/alert-banner';
import { TableSkeleton } from '@/components/table-skeleton';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

interface BriefingItem {
  id: number;
  customer_id: number;
  customer_name: string;
  project_id?: number | null;
  project_name: string;
  project_type: string;
  description: string | null;
  status: string;
  org_id: string;
  created_at: string;
}

export default function WorkspaceBriefingsPage() {
  const locale = useLocale();
  const orgFilter = useOrgFilter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project_id');
  const [briefings, setBriefings] = useState<BriefingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const token = getStaffToken();
    if (!token) return;
    setLoading(true);
    let path = withOrgQuery('/api/workspace/briefings', orgFilter);
    if (projectIdParam) {
      path += `${path.includes('?') ? '&' : '?'}project_id=${encodeURIComponent(projectIdParam)}`;
    }
    workspaceFetch(path, { token })
      .then((r) => (r.ok ? r.json() : []))
      .then(setBriefings)
      .catch(() => setError('Falha ao carregar briefings'))
      .finally(() => setLoading(false));
  }, [orgFilter, projectIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback(
    async (briefingId: number) => {
      const token = getStaffToken();
      if (!token) return;
      const res = await workspaceFetch(
        `/api/workspace/briefings/${briefingId}/download`,
        { token }
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1].trim() : `briefing-${briefingId}.txt`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Briefings"
        description="Solicitações de projeto e dados enviados pelos clientes no portal."
        onRefresh={load}
      />

      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : briefings.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum briefing" description="Ajuste o filtro de região ou aguarde novos envios." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefings.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white truncate">{b.project_name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${orgRegionBadgeClass(b.org_id)}`}
                    >
                      {orgRegionLabel(b.org_id)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    <Link
                      href={`/${locale}/customers/${b.customer_id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {b.customer_name}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{b.project_type}</p>
                </div>
              </div>
              {b.description && (
                <p className="mt-3 text-sm text-slate-400 line-clamp-2">{b.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-1 rounded-lg bg-white/10 text-slate-300 text-xs">
                    {b.status}
                  </span>
                  {b.project_id != null && (
                    <Link
                      href={`/${locale}/projects/${b.project_id}`}
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <FolderOpen className="w-3 h-3" />
                      Projeto #{b.project_id}
                    </Link>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {formatDateTime(b.created_at)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(b.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-slate-300 text-sm hover:bg-white/15 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <Link
                  href={`/${locale}/briefings/${b.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-slate-300 text-sm hover:bg-white/15 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver detalhe
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
