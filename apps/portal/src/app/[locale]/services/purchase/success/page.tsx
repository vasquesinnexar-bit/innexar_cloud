"use client";

import { useState, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import { useMarketplace, type MyServiceItem } from "@/hooks/use-marketplace";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { useLocale } from "next-intl";
import { getIntlLocale } from "@/lib/intl-locale";

interface InvoiceDetail {
  id: number;
  status: string;
  total: number;
  currency: string;
}

function SuccessContent() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoice_id");
  const { getMyServices } = useMarketplace();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [service, setService] = useState<MyServiceItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([
      workspaceFetch(API_PATHS.INVOICES.DETAIL(invoiceId), { token }),
      getMyServices(),
    ]).then(async ([iRes, items]) => {
      try {
        if (iRes.ok) setInvoice((await iRes.json()) as InvoiceDetail);
        const match = (items ?? []).find((s) => s.invoice_id === Number(invoiceId)) ?? null;
        setService(match);
      } finally {
        setLoading(false);
      }
    });
  }, [invoiceId, getMyServices]);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando resultado">
        <SkeletonCard />
      </div>
    );
  }

  if (!invoiceId || !invoice) {
    return (
      <div className="space-y-4">
        <Link href="../catalog" className="btn ghost sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("back")}
        </Link>
        <p className="text-theme-secondary">{t("unavailable")}</p>
      </div>
    );
  }

  const paid = invoice.status === "paid";

  return (
    <div className="card-base rounded-2xl p-6 space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        {paid ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        ) : (
          <Clock className="w-6 h-6 text-amber-400" />
        )}
        <h1 className="text-2xl font-bold text-theme-primary">
          {paid ? t("created") : t("pendingPayment")}
        </h1>
      </div>
      <p className="text-theme-secondary">
        {service?.product_name ?? ""} · {formatMoney(invoice.total, invoice.currency, intlLocale)}
      </p>

      {!paid && (
        <Link href={`../../billing?pay=${invoice.id}`} className="btn">
          {t("continuePayment")}
        </Link>
      )}

      {paid && service?.fulfillment_step === "briefing" && (
        <div className="space-y-2">
          <p className="text-theme-secondary">{t("projectCreated")}</p>
          <Link href="../../site-briefing" className="btn">
            {t("briefingCta")}
          </Link>
        </div>
      )}

      {paid && service?.fulfillment_step === "domain" && (
        <div className="space-y-2">
          <p className="text-theme-secondary">{t("domainNeeded")}</p>
          <Link href="../email" className="btn">
            {t("emailCta")}
          </Link>
        </div>
      )}

      {paid && service?.fulfillment_status === "active" && (
        <p className="text-emerald-400">{t("serviceActive")}</p>
      )}

      {paid && service?.fulfillment_status === "failed" && (
        <p className="text-amber-300">{t("opFailed")}</p>
      )}

      <div>
        <Link href="../../billing" className="btn ghost sm">
          {t("viewBilling")}
        </Link>
      </div>
    </div>
  );
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
