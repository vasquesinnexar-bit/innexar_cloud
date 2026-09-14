"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, AlertCircle } from "lucide-react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import { getIntlLocale } from "@/lib/intl-locale";

interface NextCharge {
  invoice_id: number;
  due_date: string;
  total: number;
  currency: string;
  status: string;
}

interface Summary {
  next_charge: NextCharge | null;
  open_count: number;
  open_total: number;
  recent_payments: {
    id: number;
    invoice_id: number;
    provider: string;
    method: string | null;
    status: string;
    amount: number | null;
    paid_at: string | null;
  }[];
}

export function BillingSummaryCard({ locale }: { locale: string }) {
  const t = useTranslations("billingPage");
  const intlLocale = getIntlLocale(locale);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.INVOICES.SUMMARY, { token });
    if (res.ok) setSummary(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!summary?.next_charge && (summary?.open_count ?? 0) === 0) return null;

  const money = (v: number, cur: string) =>
    v.toLocaleString(intlLocale, { style: "currency", currency: cur, minimumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {summary?.next_charge && (
        <div className="card-base rounded-2xl p-5">
          <p className="text-theme-secondary text-sm flex items-center gap-1">
            <CalendarClock className="w-4 h-4" /> {t("nextCharge")}
          </p>
          <p className="text-2xl font-bold text-theme-primary">
            {money(summary.next_charge.total, summary.next_charge.currency)}
          </p>
          <p className="text-theme-secondary text-sm">
            {t("dueDate")}: {new Date(summary.next_charge.due_date).toLocaleDateString(intlLocale)}
          </p>
        </div>
      )}
      {(summary?.open_count ?? 0) > 0 && (
        <div className="card-base rounded-2xl p-5">
          <p className="text-theme-secondary text-sm flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {t("openInvoices", { count: summary!.open_count })}
          </p>
          {summary?.recent_payments && summary.recent_payments.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {summary.recent_payments.slice(0, 4).map((p) => (
                <li key={p.id} className="text-theme-secondary">
                  #{p.invoice_id} · {p.method ?? p.provider} · {p.status}
                  {p.amount !== null && p.paid_at
                    ? ` · ${new Date(p.paid_at).toLocaleDateString(intlLocale)}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
