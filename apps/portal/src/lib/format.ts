import { getIntlLocale } from "./intl-locale";

/** Formatação central (Fase 5): nunca formatar moeda/data manualmente nos componentes. */
export function formatMoney(
  value: number | null | undefined,
  currency = "USD",
  locale = "pt"
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString(getIntlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale = "pt"
): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(getIntlLocale(locale));
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale = "pt"
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(getIntlLocale(locale));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
