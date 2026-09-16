"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  RotateCw,
  FolderTree,
  Globe,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Server,
} from "lucide-react";
import { useHostingService } from "@/hooks/use-hosting";
import { API_PATHS } from "@/lib/api-paths";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";

import { formatBytes as fmtBytes, formatUptime as fmtUptime } from "@/lib/format";

const TABS = ["overview", "files", "logs", "backups", "domains"] as const;

export default function HostingDetailPage() {
  const t = useTranslations("hostingPage");
  const params = useParams();
  const id = Number(params.id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const [path, setPath] = useState(".");
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDirty, setEditDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const {
    overview,
    files,
    logs,
    backups,
    busy,
    overviewLoading,
    overviewError,
    loadOverview,
    loadFiles,
    loadLogs,
    loadBackups,
    restart,
    saveFile,
    createBackup,
  } = useHostingService(id);

  useEffect(() => {
    if (id) {
      loadOverview(id);
      loadFiles(id, ".");
      loadLogs(id);
      loadBackups(id);
    }
  }, [id, loadOverview, loadFiles, loadLogs, loadBackups]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && editing) {
        e.preventDefault();
        void saveFile(id, editing, editContent).then((err) => {
          if (!err) {
            setEditDirty(false);
            setEditing(null);
            loadFiles(id, path);
          }
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, editContent, id, path, saveFile, loadFiles]);

  if (overviewLoading || (!overview && !overviewError)) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Carregando hospedagem"
      >
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="card-base rounded-2xl p-8 text-center space-y-3" role="alert">
        <Server className="w-10 h-10 mx-auto text-red-400" />
        <p className="text-theme-secondary">
          {overviewError === "not-found" ? t("notFound") : t("loadError")}
        </p>
        <button type="button" className="btn sm" onClick={() => id && loadOverview(id)}>
          {t("retry")}
        </button>
      </div>
    );
  }

  const m = overview.metrics ?? {};
  const ssl = (overview.ssl ?? {}) as Record<string, unknown>;
  const dns = (overview.dns ?? {}) as Record<string, unknown>;
  const deploy = overview.deploy ?? {};
  const logLines = logs
    .split("\n")
    .filter((l) => (logSearch ? l.toLowerCase().includes(logSearch.toLowerCase()) : true));

  const openFile = async (name: string, isDir: boolean) => {
    const next = path === "." ? name : `${path}/${name}`;
    if (isDir) {
      setPath(next);
      await loadFiles(id, next);
      return;
    }
    // Carrega o conteúdo real antes de editar (nunca edita em branco).
    try {
      const token = getCustomerToken();
      if (!token) return;
      const res = await workspaceFetch(API_PATHS.HOSTING.FILE_READ(id, next), { token });
      if (!res.ok) return;
      const data = await res.json();
      if (data.binary) return;
      setEditing(next);
      setEditContent(data.content ?? "");
      setEditDirty(false);
    } catch {
      /* mantém editor fechado em erro */
    }
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logLines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-theme-primary break-all">
            {overview.primary_domain ?? `#${overview.id}`}
          </h1>
          <p className="text-theme-secondary text-sm">
            {overview.project ?? "—"} · {overview.environment} ·{" "}
            <span className={`badge ${overview.runtime === "online" ? "ok" : "warn"}`}>
              {overview.runtime}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {overview.primary_domain && (
            <a
              href={`https://${overview.primary_domain}`}
              target="_blank"
              rel="noopener"
              className="btn ghost sm flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" /> {t("openSite")}
            </a>
          )}
          {!confirmRestart ? (
            <button
              onClick={() => setConfirmRestart(true)}
              className="btn sm flex items-center gap-1"
            >
              <RotateCw className="w-4 h-4" /> {t("restart")}
            </button>
          ) : (
            <>
              <button
                onClick={async () => {
                  await restart(id);
                  setConfirmRestart(false);
                }}
                disabled={busy === "restart"}
                className="btn danger sm"
              >
                {t("confirmRestart")}
              </button>
              <button onClick={() => setConfirmRestart(false)} className="btn ghost sm">
                {t("cancel")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === tb ? "text-theme-primary border-b-2 border-blue-500" : "text-theme-secondary"
            }`}
          >
            {t(`tab_${tb}`)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-base rounded-2xl p-4">
            <p className="text-xs text-theme-secondary">CPU</p>
            <p className="text-xl font-bold">{m.cpu_pct ?? "—"}</p>
          </div>
          <div className="card-base rounded-2xl p-4">
            <p className="text-xs text-theme-secondary">RAM</p>
            <p className="text-xl font-bold">
              {fmtBytes(m.mem_used_bytes)}{" "}
              <span className="text-sm font-normal">/ {fmtBytes(m.mem_limit_bytes)}</span>
            </p>
          </div>
          <div className="card-base rounded-2xl p-4">
            <p className="text-xs text-theme-secondary">{t("uptime")}</p>
            <p className="text-xl font-bold">{fmtUptime(m.uptime_seconds)}</p>
          </div>
          <div className="card-base rounded-2xl p-4">
            <p className="text-xs text-theme-secondary">{t("network")}</p>
            <p className="text-sm font-bold">
              ↓ {fmtBytes(m.net_rx_bytes)} · ↑ {fmtBytes(m.net_tx_bytes)}
            </p>
          </div>
          <div className="card-base rounded-2xl p-4 col-span-2">
            <p className="text-xs text-theme-secondary flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> SSL
            </p>
            <p className="text-sm">
              {ssl.ok
                ? `${t("validUntil")}: ${String(ssl.not_after ?? "—").slice(0, 10)} (${String(
                    ssl.days_remaining ?? "?"
                  )}d)`
                : t("sslUnavailable")}
            </p>
          </div>
          <div className="card-base rounded-2xl p-4 col-span-2">
            <p className="text-xs text-theme-secondary">{t("deploy")}</p>
            <p className="text-sm">
              {deploy.branch ?? "—"} {deploy.commit ? `· ${deploy.commit}` : ""}
            </p>
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="card-base rounded-2xl p-4 space-y-3">
          <p className="text-sm text-theme-secondary break-all">
            <FolderTree className="w-4 h-4 inline mr-1" /> /{path === "." ? "" : path}
          </p>
          {path !== "." && (
            <button
              onClick={() => {
                const up = path.split("/").slice(0, -1).join("/") || ".";
                setPath(up);
                loadFiles(id, up);
              }}
              className="btn ghost sm"
            >
              ← {t("up")}
            </button>
          )}
          <ul className="divide-y divide-white/5">
            {files.map((f) => (
              <li key={f.name}>
                <button
                  onClick={() => openFile(f.name, f.type === "dir")}
                  className="w-full text-left py-2 flex justify-between gap-2 hover:text-blue-400"
                >
                  <span className="truncate">
                    {f.type === "dir" ? "📁" : "📄"} {f.name}
                  </span>
                  <span className="text-xs text-theme-muted flex-shrink-0">
                    {f.type === "file" ? fmtBytes(f.size) : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {editing && (
            <div className="space-y-2">
              <p className="text-sm font-bold break-all">
                {editing} {editDirty && <span className="text-yellow-400">• {t("unsaved")}</span>}
              </p>
              <textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  setEditDirty(true);
                }}
                spellCheck={false}
                rows={16}
                className="w-full font-mono text-sm px-4 py-3 rounded-xl bg-black/40 border border-white/10"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const err = await saveFile(id, editing, editContent);
                    if (!err) {
                      setEditDirty(false);
                      setEditing(null);
                      loadFiles(id, path);
                    }
                  }}
                  disabled={busy === "save"}
                  className="btn sm"
                >
                  {t("save")}
                </button>
                <button onClick={() => setEditing(null)} className="btn ghost sm">
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "logs" && (
        <div className="card-base rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder={t("searchLogs")}
              className="flex-1 min-w-[160px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
            />
            <button onClick={() => loadLogs(id)} className="btn ghost sm">
              {t("refresh")}
            </button>
            <button onClick={copyLogs} className="btn ghost sm flex items-center gap-1">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {t("copy")}
            </button>
          </div>
          <pre className="text-xs font-mono bg-black/40 rounded-xl p-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-all">
            {logLines.slice(-300).join("\n") || t("noLogs")}
          </pre>
        </div>
      )}

      {tab === "backups" && (
        <div className="card-base rounded-2xl p-4 space-y-3">
          <button onClick={() => createBackup(id)} disabled={busy === "backup"} className="btn sm">
            {t("createBackup")}
          </button>
          {backups.length === 0 ? (
            <p className="text-theme-secondary text-sm">{t("noBackups")}</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {backups.map((b) => (
                <li key={b.id} className="py-2 flex justify-between gap-2">
                  <span>
                    #{b.id} · {b.status} · {fmtBytes(b.size_bytes)}
                  </span>
                  <span className="text-theme-muted">
                    {new Date(b.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "domains" && (
        <div className="card-base rounded-2xl p-4 space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <strong>{overview.primary_domain ?? "—"}</strong>
          </p>
          {(overview.domains ?? [])
            .filter((d) => d !== overview.primary_domain)
            .map((d) => (
              <p key={d} className="text-theme-secondary">
                {d}
              </p>
            ))}
          <p className="text-theme-secondary">
            DNS: {JSON.stringify((overview.dns as Record<string, unknown>)?.ips ?? [])}
          </p>
          <p className="text-theme-secondary">
            SSL: {String((overview.ssl as Record<string, unknown>)?.not_after ?? "—").slice(0, 10)}
          </p>
        </div>
      )}
    </div>
  );
}
