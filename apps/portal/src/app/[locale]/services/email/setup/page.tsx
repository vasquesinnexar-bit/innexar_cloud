"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";

const WEBMAIL_URL = process.env.NEXT_PUBLIC_WEBMAIL_URL ?? "https://webmail.innexar.com.br";

const STEPS = ["domain", "dns", "mailboxes", "done"] as const;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (key: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      } catch {
        /* clipboard indisponível */
      }
    },
  };
}

export default function EmailSetupPage() {
  const t = useTranslations("onboarding");
  const { session, loading, error, loadActive, submit, verify } = useOnboarding();
  const { copied, copy } = useCopy();

  const [domainInput, setDomainInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discovery, setDiscovery] = useState<Record<string, unknown> | null>(null);
  const [records, setRecords] = useState<Record<string, unknown> | null>(null);
  const [dnsMethod, setDnsMethod] = useState<"manual" | "cloudflare">("manual");
  const [cfToken, setCfToken] = useState("");
  const [cfAccount, setCfAccount] = useState("");
  const [cfConnected, setCfConnected] = useState<boolean | null>(null);
  const [zone, setZone] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [confirmZone, setConfirmZone] = useState(false);
  const [cfDomain, setCfDomain] = useState("");
  const [confirmConflicts, setConfirmConflicts] = useState(false);
  const [mailboxes, setMailboxes] = useState<
    { local: string; password: string; password2: string }[]
  >([{ local: "", password: "", password2: "" }]);
  const [entitlement, setEntitlement] = useState<{
    contracted: number;
    used: number;
  } | null>(null);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    const d = session?.steps.find((s) => s.step_key === "domain")?.data as Record<
      string,
      unknown
    > | null;
    if (d?.domain && typeof d.domain === "string") setDomainInput(d.domain);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const token = getCustomerToken();
    if (!token) return;
    workspaceFetch(API_PATHS.ONBOARDING.DISCOVERY(session.id), { token })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDiscovery)
      .catch(() => null);
    workspaceFetch(API_PATHS.ONBOARDING.RECORDS(session.id), { token })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRecords)
      .catch(() => null);
    workspaceFetch(API_PATHS.ONBOARDING.DNS_STATUS, { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCfConnected(j ? !!j.connected : null))
      .catch(() => setCfConnected(null));
  }, [session?.id]);

  useEffect(() => {
    const token = getCustomerToken();
    if (!token) return;
    workspaceFetch(API_PATHS.EMAIL.OVERVIEW, { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) =>
        setEntitlement(
          j?.entitlement
            ? { contracted: j.entitlement.contracted ?? 0, used: j.entitlement.used ?? 0 }
            : null
        )
      )
      .catch(() => null);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando configuração">
        <SkeletonCard />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-theme-primary">{t("title")}</h1>
        <p className="text-theme-secondary">{t("noSession")}</p>
        <Link href="../email" className="btn">
          {t("goEmail")}
        </Link>
      </div>
    );
  }

  const stepStatus = (key: string) =>
    session.steps.find((s) => s.step_key === key)?.status ?? "pending";
  const stepData = (key: string) =>
    (session.steps.find((s) => s.step_key === key)?.data ?? {}) as Record<string, unknown>;
  const doneIdx =
    session.status === "completed"
      ? STEPS.length
      : stepStatus("mailbox_setup") === "completed"
        ? 3
        : stepStatus("dns_verification") === "completed"
          ? 2
          : stepStatus("domain") === "completed"
            ? 1
            : 0;

  const doSubmit = async (step: string, data: Record<string, unknown>) => {
    setFormError(null);
    setBusy(true);
    try {
      const err = await submit(step, data);
      if (err) setFormError(err);
    } finally {
      setBusy(false);
    }
  };

  const token = getCustomerToken();
  const call = async (path: string, body?: unknown, method = "POST") => {
    if (!token) return null;
    const res = await workspaceFetch(path, {
      token,
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  const refreshAll = async () => {
    await loadActive();
    if (!session) return;
    const [d, r] = await Promise.all([
      call(API_PATHS.ONBOARDING.DISCOVERY(session.id), undefined, "GET"),
      call(API_PATHS.ONBOARDING.RECORDS(session.id), undefined, "GET"),
    ]);
    if (d?.ok) setDiscovery(await d.json());
    if (r?.ok) setRecords(await r.json());
  };

  const domainData = stepData("domain");
  const check = (records as Record<string, unknown> | null)?.live as
    | { checks?: Record<string, { ok: boolean }> }
    | undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">{t("title")}</h1>
        <p className="text-theme-secondary">
          {t("progress", { done: Math.min(doneIdx, 3), total: 3 })}
        </p>
      </div>

      <ol className="flex gap-2" aria-label="Progresso">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`flex-1 h-2 rounded-full ${
              i < doneIdx ? "bg-emerald-500" : i === doneIdx ? "bg-blue-500" : "bg-white/10"
            }`}
          />
        ))}
      </ol>

      {formError && <p className="text-red-400 text-sm">{formError}</p>}

      {/* 1. Domínio */}
      <section className="card-base rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold">1. {t("domainTitle")}</h2>
        <p className="text-sm text-theme-secondary">{t("domainHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="empresa.com.br"
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/5 border border-white/10"
          />
          <button
            disabled={busy}
            onClick={() => doSubmit("domain", { domain: domainInput })}
            className="btn"
          >
            {t("save")}
          </button>
        </div>
        {typeof domainData.ownership === "string" && (
          <p className="text-sm text-theme-secondary">
            {t("ownership")}: {String(domainData.ownership)}
          </p>
        )}
        {typeof domainData.challenge_host === "string" &&
          typeof domainData.challenge_value === "string" && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-sm space-y-1">
              <p>{t("challengeHint")}</p>
              <p>
                <code>{domainData.challenge_host}</code>{" "}
                <code className="break-all">{domainData.challenge_value}</code>
                <button
                  onClick={() => copy("ch", String(domainData.challenge_value))}
                  className="btn ghost sm ml-2"
                >
                  <Copy className="w-3 h-3" /> {copied === "ch" ? "✓" : t("copy")}
                </button>
              </p>
            </div>
          )}
      </section>

      {/* 2. DNS */}
      <section className="card-base rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold">2. {t("dnsTitle")}</h2>
        {discovery ? (
          <div className="text-sm text-theme-secondary space-y-1">
            <p>
              {(discovery.dns_provider as string) ||
                (typeof discovery.nameservers !== "undefined" ? t("unknownProvider") : "")}
              {(discovery.dns_provider as string) &&
                t("detectedProvider", {
                  provider: String(discovery.dns_provider),
                })}
            </p>
            {(discovery.mail_provider as string) && (
              <p>
                {t("currentMail")}: {String(discovery.mail_provider)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-theme-secondary">{t("discovering")}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setDnsMethod("manual")}
            className={`btn sm ${dnsMethod === "manual" ? "" : "ghost"}`}
          >
            {t("manualTab")}
          </button>
          <button
            onClick={() => setDnsMethod("cloudflare")}
            className={`btn sm ${dnsMethod === "cloudflare" ? "" : "ghost"}`}
          >
            Cloudflare
          </button>
        </div>

        {dnsMethod === "manual" && (
          <div className="space-y-2">
            <p className="text-sm text-theme-secondary">{t("manualHint")}</p>
            {(() => {
              const expected = (records as Record<string, unknown> | null)?.expected as
                | { type: string; host: string; value: string }[]
                | undefined;
              if (!expected) return null;
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-2 text-theme-secondary">{t("colType")}</th>
                        <th className="text-left py-2 px-2 text-theme-secondary">{t("colName")}</th>
                        <th className="text-left py-2 px-2 text-theme-secondary">
                          {t("colValue")}
                        </th>
                        <th className="text-left py-2 px-2 text-theme-secondary">
                          {t("colStatus")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expected.map((rec, i) => {
                        const key =
                          rec.type === "MX"
                            ? "mx"
                            : rec.type === "TXT" && rec.value.startsWith("v=spf1")
                              ? "spf"
                              : rec.host.startsWith("mail._domainkey")
                                ? "dkim"
                                : rec.host === "_dmarc"
                                  ? "dmarc"
                                  : "other";
                        const ok =
                          key === "other" ||
                          (check?.checks?.[key] as { ok: boolean } | undefined)?.ok === true;
                        return (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-2 px-2">{rec.type}</td>
                            <td className="py-2 px-2">
                              <code>{rec.host}</code>
                            </td>
                            <td className="py-2 px-2">
                              <code className="break-all">
                                {rec.value.slice(0, 80)}
                                {rec.value.length > 80 ? "…" : ""}
                              </code>
                              <button
                                onClick={() => copy(`rec-${i}`, rec.value)}
                                className="btn ghost sm ml-1"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </td>
                            <td className="py-2 px-2">
                              {ok ? (
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => doSubmit("dns_setup", { method: "manual" })}
                className="btn sm"
              >
                {t("configuredNext")}
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await verify();
                    await refreshAll();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn ghost sm flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" /> {t("verifyNow")}
              </button>
            </div>
          </div>
        )}

        {dnsMethod === "cloudflare" && (
          <CloudflarePanel
            t={t}
            token={token}
            sessionId={session.id}
            cfConnected={cfConnected}
            cfToken={cfToken}
            setCfToken={setCfToken}
            cfAccount={cfAccount}
            setCfAccount={setCfAccount}
            setCfConnected={setCfConnected}
            zone={zone}
            setZone={setZone}
            preview={preview}
            setPreview={setPreview}
            confirmZone={confirmZone}
            setConfirmZone={setConfirmZone}
            cfDomain={cfDomain}
            setCfDomain={setCfDomain}
            confirmConflicts={confirmConflicts}
            setConfirmConflicts={setConfirmConflicts}
            busy={busy}
            setBusy={setBusy}
            setFormError={setFormError}
            submitDnsSetup={(method: string) => doSubmit("dns_setup", { method })}
            call={call}
          />
        )}
      </section>

      {/* 3. Contas */}
      <section className="card-base rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold">3. {t("mailboxesTitle")}</h2>
        {entitlement && (
          <p className="text-sm text-theme-secondary">
            {t("planUsage", {
              used: entitlement.used,
              contracted: entitlement.contracted,
            })}
          </p>
        )}
        {mailboxes.map((m, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-3">
            <input
              value={m.local}
              onChange={(e) => {
                const next = [...mailboxes];
                next[i] = { ...next[i], local: e.target.value };
                setMailboxes(next);
              }}
              placeholder="contato"
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              type="password"
              value={m.password}
              onChange={(e) => {
                const next = [...mailboxes];
                next[i] = { ...next[i], password: e.target.value };
                setMailboxes(next);
              }}
              placeholder={t("passwordPh")}
              autoComplete="new-password"
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
            <input
              type="password"
              value={m.password2}
              onChange={(e) => {
                const next = [...mailboxes];
                next[i] = { ...next[i], password2: e.target.value };
                setMailboxes(next);
              }}
              placeholder={t("passwordPh2")}
              autoComplete="new-password"
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={() => setMailboxes([...mailboxes, { local: "", password: "", password2: "" }])}
            className="btn ghost sm"
          >
            + {t("addAccount")}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              for (const m of mailboxes) {
                if (!m.local.trim() || m.password !== m.password2 || m.password.length < 8) {
                  setFormError(t("mailboxInvalid"));
                  return;
                }
              }
              doSubmit("mailbox_setup", {
                mailboxes: mailboxes
                  .filter((m) => m.local.trim())
                  .map((m) => ({ local_part: m.local.trim(), password: m.password })),
              });
            }}
            className="btn sm"
          >
            {t("createAccounts")}
          </button>
        </div>
      </section>

      {/* 4. Finalização */}
      <section className="card-base rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold">4. {t("finishTitle")}</h2>
        {session.status === "completed" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" /> {t("ready")}
            </p>
            <a
              href={WEBMAIL_URL}
              target="_blank"
              rel="noopener"
              className="btn flex items-center gap-2 w-fit"
            >
              <ExternalLink className="w-4 h-4" /> {t("openWebmail")}
            </a>
          </div>
        ) : (
          <p className="text-sm text-theme-secondary">{t("finishHint")}</p>
        )}
      </section>
    </div>
  );
}

function CloudflarePanel(props: {
  t: (key: string, params?: Record<string, string | number>) => string;
  token: string | null;
  sessionId: number;
  cfConnected: boolean | null;
  cfToken: string;
  setCfToken: (v: string) => void;
  cfAccount: string;
  setCfAccount: (v: string) => void;
  setCfConnected: (v: boolean | null) => void;
  zone: Record<string, unknown> | null;
  setZone: (v: Record<string, unknown> | null) => void;
  preview: Record<string, unknown> | null;
  setPreview: (v: Record<string, unknown> | null) => void;
  confirmZone: boolean;
  setConfirmZone: (v: boolean) => void;
  cfDomain: string;
  setCfDomain: (v: string) => void;
  confirmConflicts: boolean;
  setConfirmConflicts: (v: boolean) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setFormError: (v: string | null) => void;
  submitDnsSetup: (method: string) => Promise<void>;
  call: (path: string, body?: unknown, method?: string) => Promise<Response | null>;
}) {
  const {
    t,
    token,
    sessionId,
    cfConnected,
    cfToken,
    setCfToken,
    cfAccount,
    setCfAccount,
    setCfConnected,
    zone,
    setZone,
    preview,
    setPreview,
    confirmZone,
    setConfirmZone,
    confirmConflicts,
    setConfirmConflicts,
    busy,
    setBusy,
    setFormError,
    submitDnsSetup,
    call,
    cfDomain,
    setCfDomain,
  } = props;

  const run = async (fn: () => Promise<void>) => {
    setFormError(null);
    setBusy(true);
    try {
      await fn();
    } catch {
      setFormError("load");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-theme-secondary">{t("cfHint")}</p>
      {cfConnected !== true && (
        <div className="grid gap-2 max-w-md">
          <input
            type="password"
            value={cfToken}
            onChange={(e) => setCfToken(e.target.value)}
            placeholder={t("cfTokenPh")}
            autoComplete="off"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"
          />
          <input
            value={cfAccount}
            onChange={(e) => setCfAccount(e.target.value)}
            placeholder={t("cfAccountPh")}
            autoComplete="off"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10"
          />
          <button
            disabled={busy || !cfToken}
            onClick={() =>
              run(async () => {
                const res = await call(API_PATHS.ONBOARDING.DNS_CONNECT, {
                  api_token: cfToken,
                  account_id: cfAccount || null,
                });
                if (!res?.ok) {
                  setFormError(t("cfInvalid"));
                  return;
                }
                setCfToken("");
                setCfAccount("");
                setCfConnected(true);
              })
            }
            className="btn sm w-fit"
          >
            {t("cfConnect")}
          </button>
        </div>
      )}
      {cfConnected === true && (
        <div className="space-y-2">
          <p className="text-sm text-emerald-400">{t("cfConnected")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={cfDomain}
              onChange={(e) => setCfDomain(e.target.value)}
              placeholder="empresa.com.br"
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <button
              disabled={busy || !cfDomain}
              onClick={() =>
                run(async () => {
                  const res = await call(
                    `${API_PATHS.ONBOARDING.DNS_ZONES}?domain=${encodeURIComponent(cfDomain)}`
                  );
                  setZone(res?.ok ? await res.json().then((j) => j.zone) : null);
                })
              }
              className="btn sm ghost"
            >
              {t("cfFindZone")}
            </button>
          </div>
          {zone ? (
            <div className="text-sm space-y-2">
              <p>
                {t("cfZone")}: <code>{String(zone.name)}</code>
              </p>
              {(zone.name_servers as string[] | undefined)?.length ? (
                <p>
                  {t("cfNameservers")}: {(zone.name_servers as string[]).join(", ")}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const res = await call(
                        API_PATHS.ONBOARDING.PREVIEW(sessionId),
                        undefined,
                        "GET"
                      );
                      setPreview(res?.ok ? await res.json() : null);
                    })
                  }
                  className="btn sm"
                >
                  {t("cfPreview")}
                </button>
              </div>
              {preview ? (
                <div className="space-y-2">
                  <PreviewTable t={t} preview={preview} />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmConflicts}
                      onChange={(e) => setConfirmConflicts(e.target.checked)}
                    />
                    {t("cfConfirmConflicts")}
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const zid = (preview as Record<string, unknown>).zone as
                          | Record<string, unknown>
                          | undefined;
                        const res = await call(API_PATHS.ONBOARDING.APPLY(sessionId), {
                          zone_id: String(
                            zid && typeof zid === "object" && "id" in zid
                              ? (zid as Record<string, unknown>).id
                              : ((preview as Record<string, unknown>).zone_id ?? "")
                          ),
                          confirmed_conflicts: confirmConflicts,
                        });
                        if (res?.ok) {
                          await submitDnsSetup("cloudflare");
                        } else {
                          setFormError(t("cfApplyFailed"));
                        }
                      })
                    }
                    className="btn sm"
                  >
                    {t("cfApply")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmZone}
                  onChange={(e) => setConfirmZone(e.target.checked)}
                />
                {t("cfCreateZone")}
              </label>
              <button
                disabled={busy || !confirmZone}
                onClick={() =>
                  run(async () => {
                    const res = await call(API_PATHS.ONBOARDING.DNS_ZONES, {
                      domain: cfDomain,
                      confirm: true,
                    });
                    if (res?.ok) {
                      const j = await res.json();
                      setZone(j.zone ?? null);
                    } else {
                      setFormError(t("cfApplyFailed"));
                    }
                  })
                }
                className="btn sm w-fit"
              >
                {t("cfCreateZoneBtn")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewTable(props: { t: (key: string) => string; preview: Record<string, unknown> }) {
  const { t, preview } = props;
  const add = (preview.add ?? []) as { type: string; name: string; content: string }[];
  const keep = (preview.keep ?? []) as { type: string; name: string; content: string }[];
  const conflicts = (preview.conflicts ?? []) as {
    type: string;
    name: string;
    message: string;
  }[];
  return (
    <div className="space-y-2 text-sm">
      {conflicts.map((c, i) => (
        <p key={i} className="text-amber-300">
          ⚠ {c.type} {c.name}: {c.message}
        </p>
      ))}
      {add.map((r, i) => (
        <p key={i} className="text-theme-secondary">
          + {r.type} {r.name} <code className="break-all">{r.content.slice(0, 70)}</code>
        </p>
      ))}
      {keep.map((r, i) => (
        <p key={i} className="text-slate-500">
          = {r.type} {r.name} ({t("cfKeep")})
        </p>
      ))}
    </div>
  );
}
