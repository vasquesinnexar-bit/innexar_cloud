/** Labels for multi-tenant org (USA vs Brazil). */

export const ORG_INNEXAR_US = 'innexar';
export const ORG_INNEXAR_BR = 'innexar-br';

export function orgRegionLabel(orgId: string | null | undefined): string {
  if (orgId === ORG_INNEXAR_BR) return 'Brasil';
  if (orgId === ORG_INNEXAR_US) return 'Estados Unidos';
  return orgId ?? '—';
}

export function orgRegionBadgeClass(orgId: string | null | undefined): string {
  if (orgId === ORG_INNEXAR_BR) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
}

export function defaultCurrencyForOrg(orgId: string | null | undefined): 'BRL' | 'USD' {
  return orgId === ORG_INNEXAR_BR ? 'BRL' : 'USD';
}

export const ORG_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas as regiões' },
  { value: ORG_INNEXAR_BR, label: 'Brasil' },
  { value: ORG_INNEXAR_US, label: 'Estados Unidos' },
] as const;
