/** Localized status labels and chip colors for workspace. */

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  aguardando_briefing: 'Aguardando briefing',
  briefing_recebido: 'Briefing recebido',
  design: 'Design',
  desenvolvimento: 'Desenvolvimento',
  revisao: 'Revisão',
  entrega: 'Entrega',
  projeto_concluido: 'Concluído',
  active: 'Ativo',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
  void: 'Anulada',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export const INTERVAL_LABELS: Record<string, string> = {
  month: 'Mensal',
  year: 'Anual',
};

export function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status] ?? status;
}

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUS_LABELS[status] ?? status;
}

export function ticketStatusClass(status: string): string {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'waiting':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    default:
      return 'bg-white/10 text-slate-300 border-white/10';
  }
}

export function intervalLabel(interval: string): string {
  return INTERVAL_LABELS[interval] ?? interval;
}

export function invoiceStatusClass(status: string): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'pending':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'overdue':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'draft':
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    case 'cancelled':
    case 'void':
      return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
    default:
      return 'bg-white/10 text-slate-300 border-white/10';
  }
}

export function projectStatusClass(status: string): string {
  if (status === 'projeto_concluido' || status === 'delivered') {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
  if (status === 'cancelled') {
    return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
  }
  if (status === 'aguardando_briefing') {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }
  return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
}
