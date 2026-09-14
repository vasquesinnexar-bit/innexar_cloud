export interface EmailEntitlement {
  contracted: number;
  used: number;
  available: number;
  currency: string;
  unit_price: number | null;
  provider_fallback: string;
}

export interface EmailMailboxItem {
  id: number;
  address: string;
  display_name: string | null;
  quota: string | null;
  status: string;
  created_at: string;
}

export interface EmailOverview {
  domain: string | null;
  status: string;
  entitlement: EmailEntitlement;
  mailboxes: EmailMailboxItem[];
}

export interface EmailApiError {
  code: string;
  message: string;
  extra?: Record<string, unknown>;
}
