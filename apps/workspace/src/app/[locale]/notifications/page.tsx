"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Notif {
  id: number;
  title: string;
  body: string | null;
  channel: string;
  read_at: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const orgFilter = useOrgFilter();
  const apiPath = useCallback(
    (p: string) => withOrgQuery(p, orgFilter),
    [orgFilter]
  );
  const [rows, setRows] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspaceFetchStaff(
        apiPath(`${WORKSPACE_API_PATHS.NOTIFICATIONS}?limit=100${filter === "unread" ? "&unread_only=true" : ""}`)
      );
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiPath, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6" /> Notificações
        </h1>
        <div className="flex gap-2">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? "bg-blue-500/20 text-blue-300" : "text-slate-400"}`}
            >
              {f === "all" ? "Todas" : "Não lidas"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <CheckCheck className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-slate-300">Nenhuma notificação. Tudo em dia.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li
              key={n.id}
              className={`bg-white/5 border rounded-2xl p-4 ${n.read_at ? "border-white/10" : "border-blue-500/30"}`}
            >
              <p className="text-white font-medium">{n.title}</p>
              {n.body && <p className="text-slate-400 text-sm mt-1">{n.body}</p>}
              <p className="text-slate-500 text-xs mt-1">
                {new Date(n.created_at).toLocaleString()} · {n.channel}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
