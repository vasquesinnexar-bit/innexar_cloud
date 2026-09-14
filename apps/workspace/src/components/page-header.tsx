'use client';

import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  onRefresh,
  refreshLabel = 'Atualizar',
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {description && (
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {refreshLabel}
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
