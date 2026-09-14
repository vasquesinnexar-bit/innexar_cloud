"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, Plus, KeyRound, Smartphone, ExternalLink, Power, PowerOff } from "lucide-react";
import { useEmailService } from "@/hooks/use-email-service";
import { getIntlLocale } from "@/lib/intl-locale";

const WEBMAIL_URL =
  process.env.NEXT_PUBLIC_WEBMAIL_URL ?? "https://webmail.innexar.com.br";

function money(amount: number | null, currency: string, intl: string) {
  if (amount === null || amount === undefined) return "—";
  return Number(amount).toLocaleString(intl, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

export default function EmailServicePage() {
  const locale = useLocale();
  const t = useTranslations("emailPage");
  const intlLocale = getIntlLocale(locale);
  const { overview, loading, error, actionLoading, load, createMailbox, requestMailbox, changePassword, toggleDisabled } =
    useEmailService();

  const [showNew, setShowNew] = useState(false);
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !overview?.domain) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-theme-primary">{t("pageTitle")}</h1>
        <p className="text-theme-secondary">{t("noService")}</p>
        <button onClick={load} className="btn">{t("retry")}</button>
      </div>
    );
  }

  const ent = overview.entitlement;
  const full = ent.available <= 0;
  const monthly = ent.unit_price !== null ? ent.unit_price * ent.contracted : null;

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setUpgradeMsg(null);
    if (pw1 !== pw2) {
      setFormError(t("pwMismatch"));
      return;
    }
    const input = { local_part: localPart.trim(), display_name: displayName.trim() || undefined, password: pw1 };
    if (!full) {
      const err = await createMailbox(input);
      if (err) setFormError(err);
      else {
        setShowNew(false);
        setLocalPart("");
        setDisplayName("");
        setPw1("");
        setPw2("");
      }
      return;
    }
    const { error: err, data } = await requestMailbox(input);
    if (err) {
      setFormError(err);
      return;
    }
    if (data && (data as { charged?: boolean }).charged) {
      setUpgradeMsg(t("upgradeCreated", { total: money((data as { total: number }).total, ent.currency, intlLocale) }));
    }
    setShowNew(false);
    setLocalPart("");
    setDisplayName("");
    setPw1("");
    setPw2("");
  };

  const submitPassword = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (pw1 !== pw2) {
      setFormError(t("pwMismatch"));
      return;
    }
    const err = await changePassword(id, pw1);
    if (err) setFormError(err);
    else {
      setPwFor(null);
      setPw1("");
      setPw2("");
    }
  };

  const domain = overview.domain!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">{t("pageTitle")}</h1>
        <p className="text-theme-secondary">
          {domain} · {ent.used}/{ent.contracted} · {money(monthly, ent.currency, intlLocale)}
          {t("perMonth")}
        </p>
      </div>

      {upgradeMsg && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm">{upgradeMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base rounded-2xl p-5">
          <p className="text-theme-secondary text-sm">{t("plan")}</p>
          <p className="text-2xl font-bold text-theme-primary">
            {ent.contracted} {t("accounts")}
          </p>
          <p className="text-theme-secondary text-sm">
            {t("inUse")}: {ent.used} · {t("available")}: {ent.available}
          </p>
        </div>
        <div className="card-base rounded-2xl p-5">
          <p className="text-theme-secondary text-sm">{t("billing")}</p>
          <p className="text-2xl font-bold text-theme-primary">
            {money(monthly, ent.currency, intlLocale)}
            {t("perMonth")}
          </p>
          <p className="text-theme-secondary text-sm">
            {ent.unit_price !== null
              ? `${money(ent.unit_price, ent.currency, intlLocale)} ${t("perAccount")}`
              : "—"}
          </p>
        </div>
        <div className="card-base rounded-2xl p-5 flex flex-col gap-2">
          <a href={WEBMAIL_URL} target="_blank" rel="noopener" className="btn flex items-center gap-2 justify-center">
            <ExternalLink className="w-4 h-4" /> {t("openWebmail")}
          </a>
          <button onClick={() => { setShowNew(true); setFormError(null); }} className="btn ghost flex items-center gap-2 justify-center">
            <Plus className="w-4 h-4" /> {full ? t("requestAccount") : t("newAccount")}
          </button>
        </div>
      </div>

      {full && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm">
          {t("limitReached", { contracted: ent.contracted, used: ent.used })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {overview.mailboxes.map((m) => (
          <div key={m.id} className="card-base rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <code className="truncate">{m.address}</code>
              </div>
              <span className={`badge ${m.status === "active" ? "ok" : "warn"}`}>
                {m.status === "active" ? t("active") : t("disabled")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={WEBMAIL_URL} target="_blank" rel="noopener" className="btn ghost sm">
                {t("webmail")}
              </a>
              <button onClick={() => { setPwFor(m.id); setPw1(""); setPw2(""); setFormError(null); }} className="btn ghost sm flex items-center gap-1">
                <KeyRound className="w-4 h-4" /> {t("changePassword")}
              </button>
              <button
                onClick={() => toggleDisabled(m.id, m.status === "active")}
                disabled={actionLoading === `t-${m.id}`}
                className="btn ghost sm flex items-center gap-1"
              >
                {m.status === "active" ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                {m.status === "active" ? t("disable") : t("enable")}
              </button>
            </div>
            {pwFor === m.id && (
              <form onSubmit={(e) => submitPassword(e, m.id)} className="grid gap-2">
                <input
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder={t("newPassword")}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder={t("confirmPassword")}
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
                  autoComplete="new-password"
                />
                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn sm">{t("save")}</button>
                  <button type="button" onClick={() => setPwFor(null)} className="btn ghost sm">
                    {t("cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {showNew && (
        <div className="card-base rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold">{full ? t("requestAccount") : t("newAccount")}</h2>
          {full && <p className="text-sm text-theme-secondary">{t("requestHint")}</p>}
          <form onSubmit={submitNew} className="grid gap-3 max-w-md">
            <input
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
              placeholder={t("addressPlaceholder")}
              required
              className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder={t("newPassword")}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder={t("confirmPassword")}
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            {formError && <p className="text-red-400 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={!!actionLoading} className="btn">
                {full ? t("confirmRequest") : t("create")}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="btn ghost">
                {t("cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-base rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Smartphone className="w-5 h-5" /> {t("howTo")}
        </h2>
        <div className="text-sm text-theme-secondary space-y-1">
          <p><strong>IMAP:</strong> mail.{domain} · 993 · SSL/TLS</p>
          <p><strong>SMTP:</strong> mail.{domain} · 465 SSL · {t("or")} 587 STARTTLS</p>
          <p><strong>{t("username")}:</strong> {t("fullAddress")}</p>
          <p>
            {t("apps")}: Webmail · iPhone · Android · Gmail · Outlook · Apple Mail
          </p>
        </div>
      </div>
    </div>
  );
}
