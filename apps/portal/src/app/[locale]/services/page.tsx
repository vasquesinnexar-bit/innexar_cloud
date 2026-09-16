"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { useMarketplace, type MyServiceItem } from "@/hooks/use-marketplace";
import { SkeletonCard } from "@/components/ui/Skeleton";

function statusBadge(s: MyServiceItem) {
  if (s.fulfillment_status === "active") return { cls: "badge ok" };
  if (s.fulfillment_status === "failed") return { cls: "badge warn" };
  if (s.invoice_status && s.invoice_status !== "paid") return { cls: "badge warn" };
  return { cls: "badge" };
}

export default function MyServicesPage() {
  const t = useTranslations("marketplace");
  const { loading, error, getMyServices } = useMarketplace();
  const [items, setItems] = useState<MyServiceItem[] | null>(null);

  useEffect(() => {
    getMyServices().then(setItems);
  }, [getMyServices]);

  if (loading && items === null) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando serviços">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-theme-primary">{t("myServices")}</h1>
          <p className="text-theme-secondary">{t("myServicesSub")}</p>
        </div>
        <Link href="./catalog" className="btn">
          {t("title")} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!items || items.length === 0 ? (
        <div className="card-base rounded-2xl p-8 text-center space-y-3">
          <Package className="w-10 h-10 mx-auto text-theme-secondary" />
          <p className="text-theme-secondary">{t("noServices")}</p>
          <Link href="./catalog" className="btn inline-flex">
            {t("title")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => {
            const badge = statusBadge(s);
            const needsPay = s.invoice_id && s.invoice_status !== "paid";
            return (
              <div key={s.id} className="card-base rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-theme-primary truncate">
                    {s.product_name ?? s.description ?? `#${s.id}`}
                  </p>
                  <span className={badge.cls}>
                    {s.fulfillment_status === "active"
                      ? t("serviceActive")
                      : s.fulfillment_status === "failed"
                        ? t("opFailed")
                        : needsPay
                          ? t("pendingPayment")
                          : s.fulfillment_status === "waiting_input"
                            ? t("waitingInfo")
                            : t("preparing")}
                  </span>
                </div>
                {s.description && (
                  <p className="text-sm text-theme-secondary truncate">{s.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {needsPay && (
                    <Link href={`../billing?pay=${s.invoice_id}`} className="btn sm">
                      {t("continuePayment")}
                    </Link>
                  )}
                  {s.fulfillment_step === "briefing" && (
                    <Link href="../site-briefing" className="btn ghost sm">
                      {t("briefingCta")}
                    </Link>
                  )}
                  {s.fulfillment_step === "domain" && (
                    <Link href="./email" className="btn ghost sm">
                      {t("emailCta")}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
