"use client";

import { useState, useCallback } from "react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import type { EmailOverview, EmailDomainItem } from "@/types/email";

export function useEmailService() {
  const [overview, setOverview] = useState<EmailOverview | null>(null);
  const [domains, setDomains] = useState<EmailDomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async (domain?: string) => {
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [oRes, dRes] = await Promise.all([
        workspaceFetch(
          domain
            ? `${API_PATHS.EMAIL.OVERVIEW}?domain=${encodeURIComponent(domain)}`
            : API_PATHS.EMAIL.OVERVIEW,
          { token }
        ),
        workspaceFetch(API_PATHS.EMAIL.DOMAINS, { token }),
      ]);
      if (!oRes.ok) throw new Error(`HTTP ${oRes.status}`);
      setOverview((await oRes.json()) as EmailOverview);
      if (dRes.ok) setDomains((await dRes.json()) as EmailDomainItem[]);
    } catch {
      setError("load");
    } finally {
      setLoading(false);
    }
  }, []);

  const apiError = async (res: Response): Promise<string> => {
    try {
      const data = await res.json();
      const d = (data?.detail ?? data) as { code?: string; message?: string };
      return d?.code ?? `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  };

  const createMailbox = useCallback(
    async (input: { local_part: string; display_name?: string; password: string }) => {
      const token = getCustomerToken();
      if (!token || !overview?.domain) return "no-domain";
      setActionLoading("create");
      try {
        const res = await workspaceFetch(API_PATHS.EMAIL.MAILBOXES, {
          token,
          method: "POST",
          body: JSON.stringify({ domain: overview.domain, ...input }),
        });
        if (!res.ok) return await apiError(res);
        await load();
        return null;
      } finally {
        setActionLoading(null);
      }
    },
    [overview?.domain, load]
  );

  const requestMailbox = useCallback(
    async (input: { local_part: string; display_name?: string; password: string }) => {
      const token = getCustomerToken();
      if (!token || !overview?.domain) return { error: "no-domain" as string, data: null as null };
      setActionLoading("request");
      try {
        const res = await workspaceFetch(API_PATHS.EMAIL.REQUEST, {
          token,
          method: "POST",
          body: JSON.stringify({ domain: overview.domain, ...input }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { error: await apiError(res), data };
        await load();
        return { error: null as null, data };
      } finally {
        setActionLoading(null);
      }
    },
    [overview?.domain, load]
  );

  const changePassword = useCallback(async (id: number, password: string) => {
    const token = getCustomerToken();
    if (!token) return "no-token";
    setActionLoading(`pw-${id}`);
    try {
      const res = await workspaceFetch(API_PATHS.EMAIL.PASSWORD(id), {
        token,
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) return await apiError(res);
      return null;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const toggleDisabled = useCallback(
    async (id: number, disabled: boolean) => {
      const token = getCustomerToken();
      if (!token) return;
      setActionLoading(`t-${id}`);
      try {
        await workspaceFetch(disabled ? API_PATHS.EMAIL.DISABLE(id) : API_PATHS.EMAIL.ENABLE(id), {
          token,
          method: "POST",
        });
        await load();
      } finally {
        setActionLoading(null);
      }
    },
    [load]
  );

  return {
    overview,
    domains,
    loading,
    error,
    actionLoading,
    load,
    createMailbox,
    requestMailbox,
    changePassword,
    toggleDisabled,
  };
}
