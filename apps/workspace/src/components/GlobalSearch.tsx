"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { workspaceFetchStaff } from "@/lib/workspace-api";
import { WORKSPACE_API_PATHS } from "@/lib/workspace-api-paths";
import { withOrgQuery } from "@/lib/org-filter";
import { useOrgFilter } from "@/hooks/use-org-filter";

interface Hit {
  type: string;
  id: number;
  label: string;
  href: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const orgFilter = useOrgFilter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Record<string, Hit[]>>({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open ]);

  const search = useCallback(
    async (term: string) => {
      setQ(term);
      if (term.trim().length < 2) {
        setGroups({});
        return;
      }
      setLoading(true);
      try {
        const res = await workspaceFetchStaff(
          withOrgQuery(`${WORKSPACE_API_PATHS.SEARCH}?q=${encodeURIComponent(term)}`, orgFilter)
        );
        if (res.ok) setGroups(await res.json());
      } finally {
        setLoading(false);
      }
    },
    [orgFilter]
  );

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    setGroups({});
    router.push(h.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm min-w-[44px] min-h-[44px]"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="hidden md:inline text-xs border border-white/10 rounded px-1">Ctrl K</kbd>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Busca global"
        >
          <div
            className="max-w-xl mx-auto mt-20 bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder="Cliente, invoice, domínio, e-mail, contrato…"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            />
            {loading && <p className="text-slate-400 text-sm">Buscando…</p>}
            {Object.entries(groups).map(
              ([type, hits]) =>
                hits.length > 0 && (
                  <div key={type}>
                    <p className="text-xs uppercase text-slate-500 mb-1">{type}</p>
                    <ul className="space-y-1">
                      {hits.map((h) => (
                        <li key={`${h.type}-${h.id}`}>
                          <button
                            type="button"
                            onClick={() => go(h)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white"
                          >
                            {h.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </>
  );
}
