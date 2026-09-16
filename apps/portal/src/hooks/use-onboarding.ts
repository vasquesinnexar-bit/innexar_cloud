"use client";

import { useState, useCallback } from "react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";

export interface OnboardingStep {
  step_key: string;
  position: number;
  required: boolean;
  status: string;
  data: Record<string, unknown> | null;
  validation_error: string | null;
  completed_at: string | null;
}

export interface OnboardingSession {
  id: number;
  type: string;
  status: string;
  current_step: string | null;
  progress: number;
  last_error: string | null;
  steps: OnboardingStep[];
}

export function useOnboarding() {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const apiError = async (res: Response): Promise<string> => {
    try {
      const data = await res.json();
      const d = (data?.detail ?? data) as { code?: string; message?: string } | string;
      if (typeof d === "string") return d;
      return d?.message ?? d?.code ?? `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  };

  const loadActive = useCallback(async (): Promise<boolean> => {
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const res = await workspaceFetch(API_PATHS.ONBOARDING.ACTIVE, { token });
      if (res.status === 404) {
        setSession(null);
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSession((await res.json()) as OnboardingSession);
      return true;
    } catch {
      setError("load");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const submit = useCallback(
    async (step: string, data: Record<string, unknown>) => {
      const token = getCustomerToken();
      if (!token || !session) return "no-session";
      setActionLoading(true);
      try {
        const res = await workspaceFetch(API_PATHS.ONBOARDING.SUBMIT(session.id, step), {
          token,
          method: "POST",
          body: JSON.stringify({ data }),
        });
        if (!res.ok) return await apiError(res);
        setSession((await res.json()) as OnboardingSession);
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [session]
  );

  const verify = useCallback(async () => {
    const token = getCustomerToken();
    if (!token || !session) return;
    setActionLoading(true);
    try {
      const res = await workspaceFetch(API_PATHS.ONBOARDING.VERIFY(session.id), {
        token,
        method: "POST",
      });
      if (res.ok) setSession((await res.json()) as OnboardingSession);
    } finally {
      setActionLoading(false);
    }
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.ONBOARDING.DETAIL(session.id), {
      token,
    });
    if (res.ok) setSession((await res.json()) as OnboardingSession);
  }, [session]);

  return { session, loading, error, actionLoading, loadActive, submit, verify, refresh };
}
