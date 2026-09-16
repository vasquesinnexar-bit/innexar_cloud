"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Package, ArrowRight, Server, Globe } from "lucide-react";
import { useMarketplace, type MyServiceItem, type ServicesOverview } from "@/hooks/use-marketplace";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getIntlLocale } from "@/lib/intl-locale";

function statusBadge(s: MyServiceItem) {
  if (s.fulfillment_status === "active") return { cls: "badge ok" };
  if (s.fulfillment_status === "failed") return { cls: "badge warn" };
  if (s.invoice_status && s.invoice_status !== "paid") return { cls: "badge warn" };
  return { cls: "badge" };
}

type ServiceGroup = { main: MyServiceItem; setups: MyServiceItem[] };

function groupServices(items: MyServiceItem[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  for (const s of items) {
    const key = s.product_name ?? `#${s.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { main: s, setups: [] };
      groups.set(key, g);
    }
    if (s.is_setup) {
      g.setups.push(s);
    } else if (g.main.is_setup) {
      g.setups.push(g.main);
      g.main = s;
    }
  }
  return [...groups.values()];
}

export default function MyServicesPage() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { loading, error, getServicesOverview } = useMarketplace();
  const [overview, setOverview] = useState<ServicesOverview | null>(null);

  const money = (amount: number | null, currency: string | null) =>
    amount === null
      ? "—"
      : amount.toLocaleString(intlLocale, {
          style: "currency",
          currency: currency || "BRL",
          minimumFractionDigits: 2,
        });

  const load = useCallback(() => {
    getServicesOverview().then(setOverview);
  }, [getServicesOverview]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && overview === null) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando serviços">
        <SkeletonCard />
      </div>
    );
  }

  const items = overview?.items ?? [];
  const groups = groupServices(items);
  const hosting = overview?.hosting_services ?? [];
  const isEmpty = groups.length === 0 && hosting.length === 0;

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

      {error && (
        <div className="card-base rounded-2xl p-5 text-center space-y-3" role="alert">
          <p className="text-red-400 text-sm">{t("loadError")}</p>
          <button type="button" className="btn sm" onClick={load}>
            {t("retry")}
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="card-base rounded-2xl p-8 text-center space-y-3">
          <Package className="w-10 h-10 mx-auto text-theme-secondary" />
          <p className="text-theme-secondary">{t("noServices")}</p>
          <Link href="./catalog" className="btn inline-flex">
            {t("title")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => {
            const s = g.main;
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
                {g.setups
                  .filter((u) => u.invoice_status && u.invoice_status !== "paid")
                  .map((u) => (
                    <p key={u.id} className="text-sm text-amber-700 dark:text-amber-300">
                      {t("setupPending", {
                        amount: money(u.unit_amount, u.currency ?? s.currency ?? null),
                      })}{" "}
                      {u.invoice_id && (
                        <Link
                          href={`../billing?pay=${u.invoice_id}`}
                          className="underline underline-offset-2"
                        >
                          {t("continuePayment")}
                        </Link>
                      )}
                    </p>
                  ))}
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
                    <Link href="./email/setup" className="btn ghost sm">
                      {t("emailCta")}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {hosting.map((h) => (
            <Link
              key={`hosting-${h.id}`}
              href="./hosting"
              className="card-base rounded-2xl p-5 space-y-2 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-theme-primary flex items-center gap-2 truncate">
                  <Server className="w-4 h-4 shrink-0" />
                  {t("hostingTitle")}
                </p>
                <span className={`badge ${h.status === "active" ? "ok" : "warn"}`}>
                  {h.status === "active" ? t("serviceActive") : h.status}
                </span>
              </div>
              <p className="text-sm text-theme-secondary flex items-center gap-1 truncate">
                <Globe className="w-3 h-3" />
                {h.primary_domain ?? `#${h.id}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
