/** Send lead to Innexar Workspace API (fire-and-forget). */

const WORKSPACE_API_URL =
  process.env.WORKSPACE_API_URL || 'https://api3.innexar.app';

export interface WorkspaceLeadPayload {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  source?: string;
  extra_data?: Record<string, string | undefined>;
}

export async function sendLeadToWorkspace(payload: WorkspaceLeadPayload): Promise<void> {
  const url = `${WORKSPACE_API_URL.replace(/\/$/, '')}/api/public/web-to-lead`;
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    message: payload.message || null,
    source: payload.source || 'website',
    extra_data: payload.extra_data || null,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Workspace web-to-lead failed: ${res.status} ${text}`);
  }
}

export function sendLeadToWorkspaceAsync(payload: WorkspaceLeadPayload): void {
  sendLeadToWorkspace(payload).catch((err) => {
    console.error('[workspace-lead] non-critical error:', err);
  });
}
