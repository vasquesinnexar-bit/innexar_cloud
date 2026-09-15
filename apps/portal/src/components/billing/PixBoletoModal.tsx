"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getIntlLocale } from "@/lib/intl-locale";
import { QrCode, Barcode, Copy, Check, RefreshCw, X } from "lucide-react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import type { Invoice } from "@/types/billing";

interface AttemptView {
  id: number;
  method: string | null;
  provider: string;
  external_id: string | null;
  status: string;
  amount: number | null;
  expires_at: string | null;
  meta: Record<string, string | null>;
}

export function PixBoletoModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const t = useTranslations("billingPage");
  const [methods, setMethods] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadMethods = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.INVOICES.PAYMENT_METHODS(invoice.id), { token });
    if (res.ok) {
      const data = await res.json();
      setMethods(data.methods ?? []);
    }
  }, [invoice.id]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async (kind: "pix" | "boleto") => {
    const token = getCustomerToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const path =
        kind === "pix"
          ? API_PATHS.INVOICES.PAY_PIX(invoice.id)
          : API_PATHS.INVOICES.PAY_BOLETO(invoice.id);
      const res = await workspaceFetch(path, { token, method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const d = (data?.detail ?? {}) as { code?: string; message?: string };
        setError(d.message ?? `HTTP ${res.status}`);
        return;
      }
      setAttempt(data as AttemptView);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  const meta = attempt?.meta ?? {};
  const isPix = attempt?.method === "pix";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="card-base rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-theme-primary">
            {t("payInvoice")} #{invoice.id}
          </h2>
          <button onClick={onClose} className="btn ghost sm" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!attempt && (
          <div className="grid gap-2">
            {methods.includes("pix") && (
              <button
                onClick={() => create("pix")}
                disabled={loading}
                className="btn flex items-center gap-2 justify-center"
              >
                <QrCode className="w-4 h-4" /> {t("payWithPix")}
              </button>
            )}
            {methods.includes("boleto") && (
              <button
                onClick={() => create("boleto")}
                disabled={loading}
                className="btn ghost flex items-center gap-2 justify-center"
              >
                <Barcode className="w-4 h-4" /> {t("payWithBoleto")}
              </button>
            )}
            {methods.length === 0 && (
              <p className="text-theme-secondary text-sm">{t("loading")}…</p>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {attempt && isPix && (
          <div className="space-y-3">
            {meta.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${meta.qr_code_base64}`}
                alt="QR Code PIX"
                className="mx-auto w-52 h-52 bg-white rounded-xl p-2"
              />
            )}
            {meta.copy_paste && (
              <div>
                <p className="text-sm text-theme-secondary mb-1">{t("pixCopyPaste")}</p>
                <p className="text-xs break-all p-3 rounded-xl bg-white/5 border border-white/10 max-h-24 overflow-y-auto">
                  {meta.copy_paste}
                </p>
                <button
                  onClick={() => meta.copy_paste && copy(meta.copy_paste)}
                  className="btn sm mt-2 flex items-center gap-1"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {t("copyCode")}
                </button>
              </div>
            )}
            {attempt.expires_at && (
              <p className="text-xs text-theme-secondary">
                {t("expiresAt")}: {new Date(attempt.expires_at).toLocaleString(intlLocale)}
              </p>
            )}
            <p className="text-xs text-theme-secondary">{t("pixWaiting")}</p>
          </div>
        )}

        {attempt && !isPix && (
          <div className="space-y-3">
            {meta.digitable_line && (
              <div>
                <p className="text-sm text-theme-secondary mb-1">{t("boletoCode")}</p>
                <p className="text-xs break-all p-3 rounded-xl bg-white/5 border border-white/10">
                  {meta.digitable_line}
                </p>
                <button
                  onClick={() => meta.digitable_line && copy(meta.digitable_line)}
                  className="btn sm mt-2 flex items-center gap-1"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {t("copyCode")}
                </button>
              </div>
            )}
            {meta.ticket_url && (
              <a
                href={meta.ticket_url}
                target="_blank"
                rel="noopener"
                className="btn ghost w-full text-center"
              >
                {t("openBoleto")}
              </a>
            )}
            {attempt.expires_at && (
              <p className="text-xs text-theme-secondary">
                {t("expiresAt")}: {new Date(attempt.expires_at).toLocaleString(intlLocale)}
              </p>
            )}
          </div>
        )}

        {attempt && (
          <button onClick={() => setAttempt(null)} className="btn ghost sm flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> {t("newCharge")}
          </button>
        )}
      </div>
    </div>
  );
}
