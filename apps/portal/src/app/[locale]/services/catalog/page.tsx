"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useMarketplace, type CatalogProduct } from "@/hooks/use-marketplace";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { useLocale } from "next-intl";
import { getIntlLocale } from "@/lib/intl-locale";

export default function CatalogPage() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { loading, error, getCatalog } = useMarketplace();
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);

  useEffect(() => {
    getCatalog().then(setProducts);
  }, [getCatalog]);

  if (loading && products === null) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando catálogo">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">{t("title")}</h1>
        <p className="text-theme-secondary">{t("subtitle")}</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!products || products.length === 0 ? (
        <div className="card-base rounded-2xl p-8 text-center space-y-3">
          <ShoppingBag className="w-10 h-10 mx-auto text-theme-secondary" />
          <p className="text-theme-secondary">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const min = Math.min(...p.plans.map((pl) => pl.amount));
            const cur = p.plans[0]?.currency ?? "USD";
            const recurring = p.plans.some((pl) => pl.billing_type === "recurring");
            return (
              <div key={p.id} className="card-base rounded-2xl p-5 space-y-3 flex flex-col">
                <div>
                  <p className="font-bold text-theme-primary text-lg">{p.name}</p>
                  {p.category && (
                    <p className="text-xs text-theme-secondary uppercase">{p.category}</p>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-theme-secondary line-clamp-3">{p.description}</p>
                )}
                <p className="text-xl font-bold text-theme-primary mt-auto">
                  {t("fromPrice")} {formatMoney(min, cur, intlLocale)}
                  <span className="text-sm font-normal text-theme-secondary">
                    {recurring ? t("perMonth") : ` ${t("oneTime")}`}
                  </span>
                </p>
                <Link
                  href={`./catalog/${p.id}`}
                  className="btn flex items-center gap-2 justify-center"
                >
                  {t("hire")} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-sm text-theme-secondary">
        {t("customQuoteText")}{" "}
        <Link href="../../new-project" className="underline">
          {t("customQuoteCta")}
        </Link>
      </p>
    </div>
  );
}
