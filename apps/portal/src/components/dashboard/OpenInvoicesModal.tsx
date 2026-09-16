"use client";

import { useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import Modal from "@/components/Modal";
import { getIntlLocale } from "@/lib/intl-locale";

export interface OpenInvoice {
  total: number | null;
  currency: string | null;
  due_date: string | null;
  href: string | null;
}

const SEEN_KEY = "innexar-open-invoices-seen";

function seenThisSession(): boolean {
  try {
    return !!sessionStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

export default function OpenInvoicesModal({
  locale,
  invoices,
  title,
  subtitle,
  payLabel,
  laterLabel,
}: {
  locale: string;
  invoices: OpenInvoice[];
  title: string;
  subtitle: string;
  payLabel: string;
  laterLabel: string;
}) {
  // Derivado no render (sem setState em efeito): funciona mesmo com
  // dados assíncronos e mostra uma vez por sessão.
  const [dismissed, setDismissed] = useState(false);
  const show =
    invoices.length > 0 && !dismissed && (typeof window === "undefined" || !seenThisSession());

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (invoices.length === 0) return null;

  const money = (v: number | null, cur: string | null) =>
    v === null
      ? "—"
      : v.toLocaleString(getIntlLocale(locale), {
          style: "currency",
          currency: cur || "USD",
          minimumFractionDigits: 2,
        });

  return (
    <Modal isOpen={show} onClose={dismiss} title={title} size="sm">
      <div className="space-y-3" role="dialog" aria-label={title}>
        <p className="text-sm">{subtitle}</p>
        {invoices.map((inv, i) => (
          <div
            key={`${inv.href ?? "inv"}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-theme-primary">
              <Receipt className="w-4 h-4 shrink-0" />
              {money(inv.total, inv.currency)}
            </span>
            {inv.href && (
              <Link href={`/${locale}${inv.href}`} onClick={dismiss} className="btn sm shrink-0">
                {payLabel}
              </Link>
            )}
          </div>
        ))}
        <button type="button" onClick={dismiss} className="btn ghost sm w-full">
          {laterLabel}
        </button>
      </div>
    </Modal>
  );
}
