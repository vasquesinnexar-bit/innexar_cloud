/**
 * Portal API paths (see API_PORTAL.md).
 * Base URL is from getWorkspaceApiBase(); paths are relative to that.
 */

export const API_PATHS = {
  AUTH: {
    LOGIN: "/api/public/auth/customer/login",
    CHECKOUT_LOGIN: "/api/public/auth/customer/checkout-login",
    FORGOT_PASSWORD: "/api/public/auth/customer/forgot-password",
    RESET_PASSWORD: "/api/public/auth/customer/reset-password",
  },
  ME: {
    FEATURES: "/api/portal/me/features",
    DASHBOARD: "/api/portal/me/dashboard",
    PROFILE: "/api/portal/me/profile",
    PASSWORD: "/api/portal/me/password",
    SET_PASSWORD: "/api/portal/me/set-password",
    PROJECT_AGUARDANDO_BRIEFING: "/api/portal/me/project-aguardando-briefing",
  },
  PROJECTS: {
    LIST: "/api/portal/projects",
    DETAIL: (id: string | number) => `/api/portal/projects/${id}`,
    FILES: (id: string | number) => `/api/portal/projects/${id}/files`,
    FILE_DOWNLOAD: (projectId: string | number, fileId: string | number) =>
      `/api/portal/projects/${projectId}/files/${fileId}/download`,
    FILE_DELETE: (projectId: string | number, fileId: string | number) =>
      `/api/portal/projects/${projectId}/files/${fileId}`,
    MESSAGES: (id: string | number) => `/api/portal/projects/${id}/messages`,
    MESSAGES_UPLOAD: (id: string | number) => `/api/portal/projects/${id}/messages/upload`,
    MODIFICATION_REQUESTS: (id: string | number) =>
      `/api/portal/projects/${id}/modification-requests`,
  },
  NEW_PROJECT: "/api/portal/new-project",
  SITE_BRIEFING: "/api/portal/site-briefing",
  SITE_BRIEFING_UPLOAD: "/api/portal/site-briefing/upload",
  INVOICES: {
    LIST: "/api/portal/invoices",
    DETAIL: (id: string | number) => `/api/portal/invoices/${id}`,
    PAY: (id: string | number) => `/api/portal/invoices/${id}/pay`,
    DOWNLOAD: (id: string | number) => `/api/portal/invoices/${id}/download`,
    PAY_PIX: (id: string | number) => `/api/portal/invoices/${id}/pay-pix`,
    PAY_BOLETO: (id: string | number) => `/api/portal/invoices/${id}/pay-boleto`,
    PAYMENT_METHODS: (id: string | number) => `/api/portal/invoices/${id}/payment-methods`,
    PAYMENTS: (id: string | number) => `/api/portal/invoices/${id}/payments`,
    SUMMARY: "/api/portal/billing/summary",
  },
  PAYMENT_METHODS: {
    LIST: "/api/portal/payment-methods",
    CREATE: "/api/portal/payment-methods",
    DELETE: (id: string | number) => `/api/portal/payment-methods/${id}`,
    SET_DEFAULT: (id: string | number) => `/api/portal/payment-methods/${id}/default`,
  },
  TICKETS: {
    LIST: "/api/portal/tickets",
    DETAIL: (id: string | number) => `/api/portal/tickets/${id}`,
    MESSAGES: (id: string | number) => `/api/portal/tickets/${id}/messages`,
  },
  MARKETPLACE: {
    CATALOG: "/api/portal/catalog",
    PURCHASES: "/api/portal/purchases",
    SERVICES: "/api/portal/services/overview",
  },
  ONBOARDING: {
    ACTIVE: "/api/portal/onboarding/active",
    DETAIL: (id: string | number) => `/api/portal/onboarding/${id}`,
    SUBMIT: (id: string | number, step: string) => `/api/portal/onboarding/${id}/submit/${step}`,
    VERIFY: (id: string | number) => `/api/portal/onboarding/${id}/verify`,
    DISCOVERY: (id: string | number) => `/api/portal/onboarding/${id}/discovery`,
    RECORDS: (id: string | number) => `/api/portal/onboarding/${id}/dns/records`,
    PREVIEW: (id: string | number) => `/api/portal/onboarding/${id}/dns/preview`,
    APPLY: (id: string | number) => `/api/portal/onboarding/${id}/dns/apply`,
    DNS_STATUS: "/api/portal/dns/connection",
    DNS_CONNECT: "/api/portal/dns/connect",
    DNS_ZONES: "/api/portal/dns/zones",
  },
  EMAIL: {
    OVERVIEW: "/api/portal/services/email",
    DOMAINS: "/api/portal/services/email/domains",
    DOMAIN_DNS: (domain: string) =>
      `/api/portal/services/email/domains/${encodeURIComponent(domain)}/dns`,
    MAILBOXES: "/api/portal/services/email/mailboxes",
    REQUEST: "/api/portal/services/email/mailboxes/request",
    PASSWORD: (id: string | number) => `/api/portal/services/email/mailboxes/${id}/password`,
    DISABLE: (id: string | number) => `/api/portal/services/email/mailboxes/${id}/disable`,
    ENABLE: (id: string | number) => `/api/portal/services/email/mailboxes/${id}/enable`,
    UPGRADE: "/api/portal/services/email/upgrade",
  },
  HOSTING: {
    SERVICES: "/api/portal/hosting/services",
    OVERVIEW: (id: string | number) => `/api/portal/hosting/services/${id}/overview`,
    LOGS: (id: string | number, tail = 200) =>
      `/api/portal/hosting/services/${id}/logs?tail=${tail}`,
    RESTART: (id: string | number) => `/api/portal/hosting/services/${id}/restart`,
    FILES: (id: string | number, path = ".") =>
      `/api/portal/hosting/services/${id}/files?path=${encodeURIComponent(path)}`,
    FILE_READ: (id: string | number, path: string) =>
      `/api/portal/hosting/services/${id}/files/read?path=${encodeURIComponent(path)}`,
    FILE_WRITE: (id: string | number, path: string) =>
      `/api/portal/hosting/services/${id}/files/write?path=${encodeURIComponent(path)}`,
    BACKUPS: (id: string | number) => `/api/portal/hosting/services/${id}/backups`,
  },
  NOTIFICATIONS: {
    LIST: "/api/portal/notifications",
    READ: (id: string | number) => `/api/portal/notifications/${id}/read`,
  },
} as const;
