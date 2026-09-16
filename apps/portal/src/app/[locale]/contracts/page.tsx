"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { FileText } from "lucide-react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import { SkeletonCard } from "@/components/ui/Skeleton";

import type { Contract } from "@/types/contracts";

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await workspaceFetch(API_PATHS.CONTRACTS.LIST, { token });
      if (!res.ok) {
        setContracts(null);
        setError(`HTTP ${res.status}`);
      } else {
        setContracts((await res.json()) as Contract[]);
      }
    } catch {
      setContracts(null);
      setError("load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { contracts, loading, error, reload: load };
}

export default function ContractsPage() {
  const locale = useLocale();
  const t = useTranslations("contractsPage");
  const { contracts, loading, error, reload } = useContracts();

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label={t("loading")}>
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

      {error && (
        <div className="card-base rounded-2xl p-5 text-center space-y-3" role="alert">
          <p className="text-red-400 text-sm">{t("loadError")}</p>
          <button type="button" className="btn sm" onClick={() => reload()}>
            {t("retry")}
          </button>
        </div>
      )}

      {!error && (contracts ?? []).length === 0 && (
        <div className="card-base rounded-2xl p-8 text-center space-y-3">
          <FileText className="w-10 h-10 mx-auto text-theme-secondary" />
          <p className="text-theme-secondary">{t("empty")}</p>
          <Link href={`/${locale}/services/catalog`} className="btn inline-flex">
            {t("browse")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(contracts ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/contracts/${c.id}`}
            className="card-base rounded-2xl p-5 space-y-2 hover:border-blue-500/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-theme-primary">
                {t("contract")} #{c.id}
              </p>
              <span className={`badge ${c.status === "active" ? "ok" : ""}`}>{c.status}</span>
            </div>
            <p className="text-sm text-theme-secondary">
              {(c.items ?? []).length} {t("items")}
              {c.billing_interval ? ` · ${c.billing_interval}` : ""}
              {c.currency ? ` · ${c.currency}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
