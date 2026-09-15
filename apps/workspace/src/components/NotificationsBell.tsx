"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

export function NotificationsBell() {
  const orgFilter = useOrgFilter();
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await workspaceFetchStaff(
        withOrgQuery(`${WORKSPACE_API_PATHS.NOTIFICATIONS}?unread_only=true&limit=1`, orgFilter)
      );
      if (res.ok) {
        const data = await res.json();
        setUnread(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      /* silencioso */
    }
  }, [orgFilter]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Link
      href="/notifications"
      className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
      aria-label="Notificações"
    >
      <Bell className="w-5 h-5 text-white" />
      {unread > 0 && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500" />
      )}
    </Link>
  );
}
