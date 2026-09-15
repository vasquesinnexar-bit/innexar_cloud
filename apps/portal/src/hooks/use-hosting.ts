"use client";

import { useState, useCallback } from "react";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";
import { API_PATHS } from "@/lib/api-paths";
import type {
  HostingBackupItem,
  HostingFile,
  HostingOverview,
  HostingServiceItem,
} from "@/types/hosting";

export function useHostingService(id: number | null) {
  const [services, setServices] = useState<HostingServiceItem[]>([]);
  const [overview, setOverview] = useState<HostingOverview | null>(null);
  const [files, setFiles] = useState<HostingFile[]>([]);
  const [cwd, setCwd] = useState(".");
  const [logs, setLogs] = useState("");
  const [backups, setBackups] = useState<HostingBackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    const token = getCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await workspaceFetch(API_PATHS.HOSTING.SERVICES, { token });
      if (res.ok) setServices(await res.json());
    } catch {
      setError("load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async (sid: number) => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.HOSTING.OVERVIEW(sid), { token });
    if (res.ok) setOverview(await res.json());
  }, []);

  const loadFiles = useCallback(async (sid: number, path: string) => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.HOSTING.FILES(sid, path), { token });
    if (res.ok) {
      setFiles(await res.json());
      setCwd(path);
    }
  }, []);

  const loadLogs = useCallback(async (sid: number) => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.HOSTING.LOGS(sid), { token });
    if (res.ok) setLogs(((await res.json()) as { logs: string }).logs ?? "");
  }, []);

  const loadBackups = useCallback(async (sid: number) => {
    const token = getCustomerToken();
    if (!token) return;
    const res = await workspaceFetch(API_PATHS.HOSTING.BACKUPS(sid), { token });
    if (res.ok) setBackups(await res.json());
  }, []);

  const restart = useCallback(
    async (sid: number) => {
      const token = getCustomerToken();
      if (!token) return "no-token";
      setBusy("restart");
      try {
        const res = await workspaceFetch(API_PATHS.HOSTING.RESTART(sid), {
          token,
          method: "POST",
        });
        if (!res.ok) return `HTTP ${res.status}`;
        await loadOverview(sid);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [loadOverview]
  );

  const saveFile = useCallback(async (sid: number, path: string, content: string) => {
    const token = getCustomerToken();
    if (!token) return "no-token";
    setBusy("save");
    try {
      const res = await workspaceFetch(API_PATHS.HOSTING.FILE_WRITE(sid, path), {
        token,
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return `HTTP ${res.status}`;
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const createBackup = useCallback(
    async (sid: number) => {
      const token = getCustomerToken();
      if (!token) return;
      setBusy("backup");
      try {
        await workspaceFetch(API_PATHS.HOSTING.BACKUPS(sid), {
          token,
          method: "POST",
          body: JSON.stringify({ retention: 5 }),
        });
        await loadBackups(sid);
      } finally {
        setBusy(null);
      }
    },
    [loadBackups]
  );

  return {
    services,
    overview,
    files,
    cwd,
    logs,
    backups,
    loading,
    error,
    busy,
    loadServices,
    loadOverview,
    loadFiles,
    loadLogs,
    loadBackups,
    restart,
    saveFile,
    createBackup,
  };
}
