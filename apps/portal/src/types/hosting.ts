export interface HostingServiceItem {
  id: number;
  primary_domain: string | null;
  status: string;
  runtime: string;
  project: string | null;
  environment: string;
}

export interface HostingMetrics {
  cpu_pct?: string;
  mem_used_bytes?: number | null;
  mem_limit_bytes?: number | null;
  net_rx_bytes?: number | null;
  net_tx_bytes?: number | null;
  uptime_seconds?: number | null;
  state?: string;
}

export interface HostingOverview {
  id: number;
  status: string;
  runtime: string;
  health: string;
  image: string;
  uptime_seconds: number | null;
  container: string;
  project: string | null;
  primary_domain: string | null;
  domains: string[];
  ssl: Record<string, unknown>;
  dns: Record<string, unknown>;
  metrics: HostingMetrics;
  environment: string;
  deploy?: Record<string, string | null>;
}

export interface HostingFile {
  name: string;
  type: string;
  size: number | null;
  mtime: string | number | null;
  perms: string;
}

export interface HostingBackupItem {
  id: number;
  status: string;
  size_bytes: number | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}
