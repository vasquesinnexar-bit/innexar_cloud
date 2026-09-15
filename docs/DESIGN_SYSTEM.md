# DESIGN SYSTEM — Innexar (Fase 5A)

Tokens (dark premium; light via variáveis quando `data-theme=light`):

- bg: `--page-bg-from/via/to`, `--card-bg`; surface-hover `white/10`
- border: `--border` (+ forte: `white/20`); radius `rounded-xl/2xl`
- text: `--theme-primary/secondary/muted`; status: emerald/amber/red/blue-400/500
- Espaçamento generoso, cards em camadas, sombras leves, sem neon/glow.

Componentes padrão (usar estes, não reinventar):

- Portal: `components/ui/Skeleton.tsx` (Skeleton/SkeletonCard/SkeletonTable),
  `lib/format.ts` (formatMoney/formatDate/formatDateTime/formatBytes/formatUptime),
  `lib/project-status.ts` (status únicos + cores), `lib/intl-locale.ts`.
- Workspace: `status-labels.ts` (status central), `page-header.tsx`,
  `table-skeleton.tsx`, `alert-banner.tsx`, `empty-state.tsx`.
- Badges: `.badge.ok/.warn` (+ danger); botões `.btn/.btn.ghost/.btn.sm/.btn.danger`.
- Confirmação obrigatória (confirm duplo p/ restore) em:
  delete, cancel, suspend, restore (arquivo/backup), refund, mark paid, restart.

Estados: skeletons no carregamento inicial (nunca spinner nu nas páginas novas),
`EmptyState` orientado à ação, erro amigável + retry (nunca loop, nunca stack).

A11y: `role=status/dialog`, `aria-label` em icon-buttons, labels em inputs,
`prefers-reduced-motion` respeitado pelo framer-motion, `sr-only` onde há
só ícone.

Mobile: grids `grid-cols-1 md:…`, tabelas em `overflow-x-auto`, modais
`max-h-[90vh] overflow-y-auto`, editor fullscreen em telas pequenas (Fase 5B).
