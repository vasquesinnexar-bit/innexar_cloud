'use client';

import { useEffect, useState } from 'react';
import {
  ORG_FILTER_CHANGED_EVENT,
  OrgFilterValue,
  getOrgFilter,
} from '@/lib/org-filter';

/** Subscribe to global workspace org filter (Brasil / USA / all). */
export function useOrgFilter(): OrgFilterValue {
  const [value, setValue] = useState<OrgFilterValue>('all');

  useEffect(() => {
    setValue(getOrgFilter());
    const onChange = () => setValue(getOrgFilter());
    window.addEventListener(ORG_FILTER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORG_FILTER_CHANGED_EVENT, onChange);
  }, []);

  return value;
}
