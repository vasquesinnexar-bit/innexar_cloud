/** Global org filter for workspace (Brasil / USA / all). */

export const WORKSPACE_ORG_FILTER_KEY = 'workspace_org_filter';
export const ORG_FILTER_CHANGED_EVENT = 'workspace-org-filter-changed';

export type OrgFilterValue = 'all' | 'innexar' | 'innexar-br';

export function getOrgFilter(): OrgFilterValue {
  if (typeof window === 'undefined') return 'all';
  const value = localStorage.getItem(WORKSPACE_ORG_FILTER_KEY);
  if (value === 'innexar' || value === 'innexar-br') return value;
  return 'all';
}

export function setOrgFilter(value: OrgFilterValue): void {
  localStorage.setItem(WORKSPACE_ORG_FILTER_KEY, value);
  window.dispatchEvent(new CustomEvent(ORG_FILTER_CHANGED_EVENT, { detail: value }));
}

export function withOrgQuery(path: string, orgFilter?: OrgFilterValue): string {
  const org = orgFilter ?? getOrgFilter();
  if (org === 'all') return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org_id=${encodeURIComponent(org)}`;
}
