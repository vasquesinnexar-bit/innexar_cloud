"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { useWorkspaceApi, workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";

interface NotificationItem {
  id: number;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)]";

type NotificationDropdownProps = {
  unreadCount: number;
  locale: string;
};

export function NotificationDropdown({ unreadCount, locale }: NotificationDropdownProps) {
  const t = useTranslations("notificationsPage");
  const isWorkspaceApi = useWorkspaceApi();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isWorkspaceApi) return;
    const token = getCustomerToken();
    if (!token) return;
    setLoading(true);
    workspaceFetch(API_PATHS.NOTIFICATIONS.LIST, { token })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: NotificationItem[]) => {
        setList(Array.isArray(data) ? data.slice(0, 5) : []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open, isWorkspaceApi]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: number) => {
    const token = getCustomerToken();
    if (!token) return;
    setMarkingId(id);
    try {
      await workspaceFetch(API_PATHS.NOTIFICATIONS.READ(id), {
        token,
        method: "PATCH",
      });
      setList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${FOCUS_RING}`}
        style={{ background: "var(--card-bg)", color: "var(--text-secondary)" }}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 w-80 rounded-2xl border shadow-xl z-50 overflow-hidden"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-semibold text-theme-primary">{t("title")}</span>
            <Link
              href={`/${locale}/notifications`}
              onClick={() => setOpen(false)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {t("title")}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-theme-muted mx-auto mb-2" />
                <p className="text-sm text-theme-secondary">{t("emptyTitle")}</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {list.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 ${
                      n.read_at ? "" : "bg-blue-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm truncate ${
                            n.read_at
                              ? "text-theme-secondary"
                              : "text-theme-primary font-medium"
                          }`}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-theme-muted mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="text-xs text-theme-muted mt-1">
                          {new Date(n.created_at).toLocaleDateString(locale)}
                        </p>
                      </div>
                      {!n.read_at && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          disabled={markingId !== null}
                          className="p-1 rounded-lg text-theme-muted hover:text-blue-400 hover:bg-blue-500/10 shrink-0 disabled:opacity-50"
                          title="Mark as read"
                        >
                          {markingId === n.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/${locale}/notifications`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-medium text-blue-400 hover:text-blue-300 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {t("title")}
          </Link>
        </div>
      )}
    </div>
  );
}
