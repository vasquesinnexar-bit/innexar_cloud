"use client";

import { useTranslations } from "next-intl";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("portal");
  return (
    <div className="card-base rounded-2xl p-8 text-center space-y-3" role="alert">
      <h2 className="text-lg font-bold text-theme-primary">{t("pageError")}</h2>
      <p className="text-sm text-theme-secondary">{t("pageErrorSub")}</p>
      <button type="button" className="btn sm" onClick={() => reset()}>
        {t("retry")}
      </button>
    </div>
  );
}
