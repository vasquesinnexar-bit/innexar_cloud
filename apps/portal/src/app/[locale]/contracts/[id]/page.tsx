"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getIntlLocale } from "@/lib/intl-locale";
import type { Contract } from "@/types/contracts";

export default function ContractDetailPage() {
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const t = useTranslations("contractsPage");
  const params = useParams();
  const id = String((params as Record<string, string | string[]>).id ?? "");
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await workspaceFetch(API_PATHS.CONTRACTS.DETAIL(id), { token });
      if (res.ok) {
        setContract((await res.json()) as Contract);
      } else {
        setError(res.status === 404 ? "not-found" : `HTTP ${res.status}`);
      }
    } catch {
      setError("load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label={t("loading")}>
        <SkeletonCard />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        <Link href="../contracts" className="btn ghost sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("back")}
        </Link>
        <p className="text-theme-secondary" role="alert">
          {error === "not-found" ? t("notFound") : error ? t("loadError") : t("empty")}
        </p>
      </div>
    );
  }

  const money = (v: number | null, cur: string | null) =>
    v === null
      ? "—"
      : v.toLocaleString(intlLocale, {
          style: "currency",
          currency: cur || contract.currency || "USD",
          minimumFractionDigits: 2,
        });

  return (
    <div className="space-y-6">
      <div>
        <Link href="../contracts" className="btn ghost sm inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {t("back")}
        </Link>
        <h1 className="text-3xl font-bold text-theme-primary mt-2">
          {t("contract")} #{contract.id}
        </h1>
        <p className="text-theme-secondary">
          {contract.status}
          {contract.billing_interval ? ` · ${contract.billing_interval}` : ""}
          {contract.currency ? ` · ${contract.currency}` : ""}
        </p>
      </div>
      <div className="card-base rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">{t("items")}</h2>
        {(contract.items ?? []).length === 0 && (
          <p className="text-sm text-theme-secondary">{t("noItems")}</p>
        )}
        {(contract.items ?? []).map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-2 border-t border-white/5 pt-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {i.product_name ?? i.description ?? `#${i.id}`}
              </p>
              <p className="text-xs text-theme-secondary">
                {i.plan_name ?? ""}
                {i.quantity > 1 ? ` · ×${i.quantity}` : ""}
              </p>
            </div>
            <p className="text-sm shrink-0">{money(i.unit_amount, contract.currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
