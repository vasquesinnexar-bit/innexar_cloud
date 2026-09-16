"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { workspaceFetch, getCustomerToken, getWorkspaceApiBase } from "@/lib/workspace-api";
import { useBilling } from "@/hooks/use-billing";
import { PaymentBrickModal } from "@/components/PaymentBrickModal";
import { BillingStats } from "@/components/billing/BillingStats";
import { BillingInvoiceTable } from "@/components/billing/BillingInvoiceTable";
import { BillingEmptyState } from "@/components/billing/BillingEmptyState";
import { PixBoletoModal } from "@/components/billing/PixBoletoModal";
import { BillingSummaryCard } from "@/components/billing/BillingSummaryCard";
import { BillingPaymentMethods } from "@/components/billing/BillingPaymentMethods";
import type { Invoice } from "@/types/billing";
import { API_PATHS } from "@/lib/api-paths";

const MP_PUBLIC_KEY =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "")
    : (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "");

export default function BillingPage() {
  const locale = useLocale();
  const t = useTranslations("billingPage");
  const {
    invoices,
    loading,
    isWorkspaceApi,
    statusFilter,
    setStatusFilter,
    filteredInvoices,
    totalPaid,
    totalPending,
    dominantCurrency,
    refresh,
  } = useBilling();
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [pixModalInvoice, setPixModalInvoice] = useState<Invoice | null>(null);
  const searchParams = useSearchParams();
  const [payAutoOpened, setPayAutoOpened] = useState(false);

  // Deep-link ?pay=<id>: abre o pagamento uma única vez (derived state).
  const payId = searchParams.get("pay");
  if (payId && !payAutoOpened && !paymentModalInvoice && invoices.length > 0) {
    const found = invoices.find((i) => String(i.id) === payId);
    setPayAutoOpened(true);
    if (found && found.status !== "paid") setPaymentModalInvoice(found);
  }
  // Moeda dominante das faturas (clientes têm uma moeda; fallback USD legado)

  const handleDownload = useCallback(async (invoice: Invoice) => {
    const token = getCustomerToken();
    if (!token) return;
    try {
      const res = await workspaceFetch(API_PATHS.INVOICES.DOWNLOAD(invoice.id), { token });
      if (!res.ok) return;
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch {
      // ignore
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary mb-2">{t("pageTitle")}</h1>
        <p className="text-theme-secondary">{t("pageSubtitle")}</p>
      </div>
      <BillingSummaryCard locale={locale} />
      <BillingStats
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalInvoices={invoices.length}
        locale={locale}
        currency={dominantCurrency}
      />
      {invoices.length > 0 ? (
        <BillingInvoiceTable
          invoices={filteredInvoices}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          locale={locale}
          isWorkspaceApi={isWorkspaceApi}
          onPay={(inv) => setPaymentModalInvoice(inv)}
          onPayPix={(inv) => setPixModalInvoice(inv)}
          onDownload={handleDownload}
          mpPublicKey={MP_PUBLIC_KEY}
        />
      ) : (
        <BillingEmptyState />
      )}
      <BillingPaymentMethods />
      {pixModalInvoice && (
        <PixBoletoModal invoice={pixModalInvoice} onClose={() => setPixModalInvoice(null)} />
      )}
      {MP_PUBLIC_KEY && (
        <PaymentBrickModal
          open={!!paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          invoice={
            paymentModalInvoice
              ? {
                  id: paymentModalInvoice.id,
                  total: paymentModalInvoice.amount,
                  currency: paymentModalInvoice.currency || "USD",
                }
              : null
          }
          apiBase={getWorkspaceApiBase()}
          getToken={getCustomerToken}
          onSuccess={() => {
            setPaymentModalInvoice(null);
            refresh();
          }}
          mpPublicKey={MP_PUBLIC_KEY}
        />
      )}
    </div>
  );
}
