"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Server, Globe } from "lucide-react";
import { useHostingService } from "@/hooks/use-hosting";
import { SkeletonCard } from "@/components/ui/Skeleton";

const RUNTIME_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
  suspended: "Suspended",
  unknown: "Unknown",
};

export default function HostingListPage() {
  const locale = useLocale();
  const t = useTranslations("hostingPage");
  const { services, loading, loadServices } = useHostingService(null);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="status" aria-label="Carregando hospedagem">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">{t("pageTitle")}</h1>
        <p className="text-theme-secondary">{t("pageSubtitle")}</p>
      </div>
      {services.length === 0 ? (
        <div className="card-base rounded-2xl p-8 text-center space-y-3">
          <Server className="w-10 h-10 mx-auto text-theme-muted" />
          <p className="text-theme-secondary">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s) => (
            <Link
              key={s.id}
              href={`/${locale}/services/hosting/${s.id}`}
              className="card-base rounded-2xl p-5 space-y-2 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-theme-primary flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {s.primary_domain ?? `#${s.id}`}
                </span>
                <span className={`badge ${s.runtime === "online" ? "ok" : "warn"}`}>
                  {RUNTIME_LABEL[s.runtime] ?? s.runtime}
                </span>
              </div>
              <p className="text-sm text-theme-secondary">
                {s.project ?? "—"} · {s.environment}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
