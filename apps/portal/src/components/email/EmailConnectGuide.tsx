"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, ExternalLink, Server, Smartphone } from "lucide-react";

type Guide = { id: string; title: string; steps: string[] };

function CopyRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("emailPage");
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* clipboard indisponível: sem erro visível */
        }
      }}
      title={t("copy")}
      className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-left hover:border-blue-500/40 transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-xs text-theme-secondary">{label}</span>
        <code className="block truncate text-sm text-theme-primary">{value}</code>
      </span>
      {ok ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-400">
          <Check className="w-4 h-4" /> {t("copied")}
        </span>
      ) : (
        <Copy className="w-4 h-4 shrink-0 text-theme-secondary" />
      )}
    </button>
  );
}

export default function EmailConnectGuide({
  domain,
  exampleAddress,
  webmailUrl,
}: {
  domain: string;
  exampleAddress: string | null;
  webmailUrl: string;
}) {
  const t = useTranslations("emailPage");
  const [open, setOpen] = useState<string | null>("webmail");
  // Host com certificado válido (mesmo servidor; evita aviso de certificado).
  const host = "mail.innexar.com.br";
  const guides = t.raw("connectGuides") as Guide[];

  return (
    <div className="card-base rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Smartphone className="w-5 h-5" /> {t("connectTitle")}
      </h2>
      <p className="text-sm text-theme-secondary">{t("connectSub")}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1">
            <Server className="w-4 h-4" /> {t("imap")}
          </p>
          <CopyRow label="Host" value={host} />
          <CopyRow label="Porta · SSL/TLS" value="993" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1">
            <Server className="w-4 h-4" /> {t("smtp")}
          </p>
          <CopyRow label="Host" value={host} />
          <CopyRow label="465 SSL · 587 STARTTLS" value="587" />
        </div>
      </div>
      <CopyRow label={`${t("user")} (${t("userHint")})`} value={exampleAddress ?? ""} />

      <p className="text-xs text-theme-secondary">
        {t("fallback")} <code>{`mail.${domain}`}</code> {t("fallbackWarn")}
      </p>
      <p className="text-xs text-theme-secondary">{t("imapOnly")}</p>

      <div className="flex flex-wrap gap-2">
        <a href={webmailUrl} target="_blank" rel="noopener" className="btn sm">
          <ExternalLink className="w-4 h-4" /> {t("openWebmailBtn")}
        </a>
      </div>

      <div className="divide-y divide-white/10 rounded-xl border border-white/10">
        {guides.map((g) => {
          const isOpen = open === g.id;
          return (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : g.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-white/5"
              >
                {g.title}
                <span className="text-theme-secondary">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <ol className="space-y-1 px-4 pb-4 text-sm text-theme-secondary list-decimal list-inside">
                  {g.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
