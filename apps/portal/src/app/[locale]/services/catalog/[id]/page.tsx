"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMarketplace, type CatalogProduct, type PurchaseResult } from "@/hooks/use-marketplace";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { getIntlLocale } from "@/lib/intl-locale";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ProductDetailPage() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { loading, error, getCatalog, purchase } = useMarketplace();

  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [planId, setPlanId] = useState("");
  const [qty, setQty] = useState("1");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<PurchaseResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [key] = useState(newKey);

  useEffect(() => {
    getCatalog().then((list) => {
      if (!list) return;
      const found = list.find((p) => String(p.id) === id) ?? null;
      setProduct(found);
      setNotFound(!found);
      if (found && found.plans.length > 0) setPlanId(String(found.plans[0].id));
    });
  }, [getCatalog, id]);

  const plan = useMemo(
    () => product?.plans.find((p) => String(p.id) === planId) ?? null,
    [product, planId]
  );
  const total = plan ? plan.amount * (Number(qty) || 1) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !plan || submitting) return;
    setFormError(null);
    setSubmitting(true);
    const { data, error: err } = await purchase({
      product_id: product.id,
      price_plan_id: plan.id,
      quantity: Number(qty) || 1,
      idempotency_key: key,
    });
    setSubmitting(false);
    if (err || !data) {
      setFormError(err ?? "load");
      return;
    }
    if (data.reused) {
      router.push(`../purchase/success?invoice_id=${data.invoice_id}`);
      return;
    }
    setDone(data);
    setConfirming(false);
  };

  if (loading && !product) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando produto">
        <SkeletonCard />
      </div>
    );
  }

  if (notFound || (!loading && !product)) {
    return (
      <div className="space-y-4">
        <Link href="../catalog" className="btn ghost sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("back")}
        </Link>
        <p className="text-theme-secondary">{t("unavailable")}</p>
      </div>
    );
  }

  if (!product) return null;

  if (done) {
    return (
      <div className="card-base rounded-2xl p-6 space-y-4 max-w-lg">
        <h1 className="text-2xl font-bold text-theme-primary">{t("created")}</h1>
        <p className="text-theme-secondary">
          {product.name} · {formatMoney(done.total, done.currency, intlLocale)}
        </p>
        <div className="flex gap-2">
          <Link href={`../../billing?pay=${done.invoice_id}`} className="btn">
            {t("payNow")}
          </Link>
          <Link href={`../purchase/success?invoice_id=${done.invoice_id}`} className="btn ghost">
            {t("details")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="../catalog" className="btn ghost sm inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> {t("back")}
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">{product.name}</h1>
        {product.description && <p className="text-theme-secondary mt-1">{product.description}</p>}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {product.plans.length === 0 ? (
        <p className="text-theme-secondary">{t("unavailable")}</p>
      ) : (
        <form onSubmit={submit} className="card-base rounded-2xl p-6 space-y-4">
          <div>
            <p className="text-sm text-theme-secondary mb-2">{t("selectPlan")}</p>
            <div className="grid gap-2">
              {product.plans.map((pl) => (
                <label
                  key={pl.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                    String(pl.id) === planId ? "border-blue-500 bg-blue-500/10" : "border-white/10"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="plan"
                      checked={String(pl.id) === planId}
                      onChange={() => setPlanId(String(pl.id))}
                    />
                    <span>
                      {pl.name}
                      <span className="block text-xs text-theme-secondary">
                        {pl.billing_type === "recurring" ? t("perMonth") : t("oneTime")}
                        {pl.unit ? ` · ${pl.unit}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="font-bold">
                    {formatMoney(pl.amount, pl.currency, intlLocale)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-theme-secondary">
              {t("quantity")}
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, "") || "1")}
                inputMode="numeric"
                className="mt-1 w-24 block px-4 py-2 rounded-xl bg-white/5 border border-white/10"
              />
            </label>
          </div>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!plan}
              className="btn"
            >
              {t("review")}
            </button>
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
              <p className="font-bold">
                {product.name} — {plan?.name} × {qty}
              </p>
              <p className="text-2xl font-bold">
                {t("total")}: {plan ? formatMoney(total, plan.currency, intlLocale) : "—"}
              </p>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="btn">
                  {submitting ? t("processing") : t("confirm")}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="btn ghost">
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
