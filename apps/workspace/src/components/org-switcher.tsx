'use client';

import { useEffect, useState } from 'react';
import { Globe2, ChevronDown } from 'lucide-react';
import {
  ORG_FILTER_CHANGED_EVENT,
  OrgFilterValue,
  getOrgFilter,
  setOrgFilter,
} from '@/lib/org-filter';
import { ORG_FILTER_OPTIONS, orgRegionBadgeClass } from '@/lib/org-labels';

export function OrgSwitcher() {
  const [value, setValue] = useState<OrgFilterValue>('all');

  useEffect(() => {
    setValue(getOrgFilter());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<OrgFilterValue>).detail;
      if (detail) setValue(detail);
      else setValue(getOrgFilter());
    };
    window.addEventListener(ORG_FILTER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORG_FILTER_CHANGED_EVENT, onChange);
  }, []);

  const active = ORG_FILTER_OPTIONS.find((o) => o.value === value) ?? ORG_FILTER_OPTIONS[0];

  return (
    <div
      className={`relative flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl border transition-colors ${
        value === 'all'
          ? 'bg-white/5 border-white/10'
          : `${orgRegionBadgeClass(value)} border`
      }`}
    >
      <Globe2 className="w-4 h-4 shrink-0 opacity-70" />
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as OrgFilterValue;
          setValue(next);
          setOrgFilter(next);
        }}
        className="appearance-none bg-transparent text-sm font-medium outline-none cursor-pointer pr-6 min-w-[130px]"
        aria-label="Filtrar região"
      >
        {ORG_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value || 'all'} className="bg-slate-900">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-2 pointer-events-none opacity-50" />
      <span className="sr-only">Região: {active.label}</span>
    </div>
  );
}
