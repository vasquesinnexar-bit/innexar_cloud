/**
 * Workspace API paths — single source of truth aligned with backend (main.py + *router_workspace*).
 * Base URL from getWorkspaceApiBase(); paths are relative to that.
 * @see innexar-workspace/backend/app/main.py include_router(..., prefix="/api/workspace")
 */

const PREFIX = "/api/workspace" as const;

export const WORKSPACE_API_PATHS = {
  AUTH: {
    STAFF_LOGIN: `${PREFIX}/auth/staff/login`,
    STAFF_FORGOT_PASSWORD: `${PREFIX}/auth/staff/forgot-password`,
    STAFF_RESET_PASSWORD: `${PREFIX}/auth/staff/reset-password`,
  },
  ME: {
    PROFILE: `${PREFIX}/me`,
    PASSWORD: `${PREFIX}/me/password`,
  },
  DASHBOARD: {
    SUMMARY: `${PREFIX}/dashboard/summary`,
    REVENUE: (periodType: string) =>
      `${PREFIX}/dashboard/revenue?period_type=${encodeURIComponent(periodType)}`,
  },
  CUSTOMERS: {
    LIST: `${PREFIX}/customers`,
    DETAIL: (id: string | number) => `${PREFIX}/customers/${id}`,
    SEND_CREDENTIALS: (id: string | number) =>
      `${PREFIX}/customers/${id}/send-credentials`,
    GENERATE_PASSWORD: (id: string | number) =>
      `${PREFIX}/customers/${id}/generate-password`,
    CLEANUP_TEST: `${PREFIX}/customers/cleanup-test`,
  },
  PROJECTS: {
    LIST: `${PREFIX}/projects`,
    DETAIL: (id: string | number) => `${PREFIX}/projects/${id}`,
    FILES: (id: string | number) => `${PREFIX}/projects/${id}/files`,
    FILE_DOWNLOAD: (projectId: string | number, fileId: string | number) =>
      `${PREFIX}/projects/${projectId}/files/${fileId}/download`,
    MESSAGES: (id: string | number) => `${PREFIX}/projects/${id}/messages`,
    MODIFICATION_REQUESTS: (id: string | number) =>
      `${PREFIX}/projects/${id}/modification-requests`,
  },
  MODIFICATION_REQUESTS: {
    UPDATE: (requestId: string | number) =>
      `${PREFIX}/modification-requests/${requestId}`,
  },
  BRIEFINGS: {
    LIST: (projectId?: string | number) =>
      projectId
        ? `${PREFIX}/briefings?project_id=${encodeURIComponent(String(projectId))}`
        : `${PREFIX}/briefings`,
    DETAIL: (id: string | number) => `${PREFIX}/briefings/${id}`,
    DOWNLOAD: (id: string | number) => `${PREFIX}/briefings/${id}/download`,
  },
  ORDERS: {
    LIST: `${PREFIX}/orders`,
  },
  BILLING: {
    PRODUCTS: (withPlans = false) =>
      `${PREFIX}/billing/products${withPlans ? "?with_plans=true" : ""}`,
    PRODUCT_DETAIL: (id: string | number) =>
      `${PREFIX}/billing/products/${id}`,
    PRICE_PLANS: (productId?: string | number) =>
      productId
        ? `${PREFIX}/billing/price-plans?product_id=${encodeURIComponent(String(productId))}`
        : `${PREFIX}/billing/price-plans`,
    PRICE_PLAN_DETAIL: (id: string | number) =>
      `${PREFIX}/billing/price-plans/${id}`,
    SUBSCRIPTIONS: (customerId?: string | number) =>
      customerId
        ? `${PREFIX}/billing/subscriptions?customer_id=${encodeURIComponent(String(customerId))}`
        : `${PREFIX}/billing/subscriptions`,
    SUBSCRIPTION_CANCEL: (id: string | number) =>
      `${PREFIX}/billing/subscriptions/${id}/cancel`,
    INVOICES: (customerId?: string | number) =>
      customerId
        ? `${PREFIX}/billing/invoices?customer_id=${encodeURIComponent(String(customerId))}`
        : `${PREFIX}/billing/invoices`,
    INVOICE_PAYMENT_LINK: (
      invoiceId: string | number,
      successUrl: string,
      cancelUrl: string
    ) =>
      `${PREFIX}/billing/invoices/${invoiceId}/payment-link?success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`,
    INVOICE_PAY_BRICKS: (invoiceId: string | number) =>
      `${PREFIX}/billing/invoices/${invoiceId}/pay-bricks`,
    INVOICE_MARK_PAID: (invoiceId: string | number) =>
      `${PREFIX}/billing/invoices/${invoiceId}/mark-paid`,
    PROCESS_OVERDUE: `${PREFIX}/billing/process-overdue`,
    GENERATE_RECURRING: `${PREFIX}/billing/generate-recurring-invoices`,
    CONTRACTS: (customerId?: string | number) =>
      customerId
        ? `${PREFIX}/billing/contracts?customer_id=${encodeURIComponent(String(customerId))}`
        : `${PREFIX}/billing/contracts`,
    POLICIES: `${PREFIX}/billing/policies`,
    POLICY_EFFECTIVE: `${PREFIX}/billing/policies/effective`,
    REFUNDS: (invoiceId?: string | number) =>
      invoiceId
        ? `${PREFIX}/billing/refunds?invoice_id=${encodeURIComponent(String(invoiceId))}`
        : `${PREFIX}/billing/refunds`,
  },
  SEARCH: `${PREFIX}/search`,
  AUDIT: `${PREFIX}/audit`,
  NOTIFICATIONS: `${PREFIX}/notifications`,
  FULFILLMENT: {
    LIST: (query?: string) =>
      query ? `${PREFIX}/fulfillments?${query}` : `${PREFIX}/fulfillments`,
    DETAIL: (id: string | number) =>
      `${PREFIX}/fulfillments/${encodeURIComponent(String(id))}`,
    RETRY: (id: string | number) =>
      `${PREFIX}/fulfillments/${encodeURIComponent(String(id))}/retry`,
    RESOLVE: (id: string | number) =>
      `${PREFIX}/fulfillments/${encodeURIComponent(String(id))}/resolve`,
    CANCEL: (id: string | number) =>
      `${PREFIX}/fulfillments/${encodeURIComponent(String(id))}/cancel`,
    AUDIT: (id: string | number) =>
      `${PREFIX}/fulfillments/${encodeURIComponent(String(id))}/audit`,
    CUSTOMER: (customerId: string | number) =>
      `${PREFIX}/customers/${encodeURIComponent(String(customerId))}/fulfillments`,
  },
  HOSTING: {
    SERVERS: `${PREFIX}/hosting/servers`,
    SERVERS_OVERVIEW: `${PREFIX}/hosting/servers/overview`,
    DISCOVERY: `${PREFIX}/hosting/discovery`,
    SERVICES: (customerId?: string | number) =>
      customerId
        ? `${PREFIX}/hosting/services?customer_id=${encodeURIComponent(String(customerId))}`
        : `${PREFIX}/hosting/services`,
    SERVICE_OVERVIEW: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/overview`,
    SERVICE_RESTART: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/restart`,
    SERVICE_STOP: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/stop`,
    SERVICE_START: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/start`,
    SERVICE_JOBS: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/jobs`,
    BACKUPS_RECENT: `${PREFIX}/hosting/backups/recent`,
    BACKUPS: (id: string | number) =>
      `${PREFIX}/hosting/services/${encodeURIComponent(String(id))}/backups`,
    BACKUP_RESTORE: (id: string | number) =>
      `${PREFIX}/hosting/backups/${encodeURIComponent(String(id))}/restore`,
    STACKS_DISCOVERY: `${PREFIX}/hosting/discovery/stacks`,
    STACKS: (customerId?: string | number) =>
      customerId
        ? `${PREFIX}/hosting/stacks?customer_id=${encodeURIComponent(String(customerId))}`
        : `${PREFIX}/hosting/stacks`,
    STACK_DETAIL: (id: string | number) =>
      `${PREFIX}/hosting/stacks/${encodeURIComponent(String(id))}`,
    STACK_LINK: `${PREFIX}/hosting/stacks/link`,
  },
  MAIL: {
    ENTITLEMENT: (customerId: string | number) =>
      `${PREFIX}/mail/customers/${encodeURIComponent(String(customerId))}/entitlement`,
    MAILBOXES: (customerId: string | number) =>
      `${PREFIX}/mail/customers/${encodeURIComponent(String(customerId))}/mailboxes`,
    PASSWORD: (id: string | number, customerId: string | number) =>
      `${PREFIX}/mail/mailboxes/${encodeURIComponent(String(id))}/password?customer_id=${encodeURIComponent(String(customerId))}`,
    DISABLE: (id: string | number, customerId: string | number) =>
      `${PREFIX}/mail/mailboxes/${encodeURIComponent(String(id))}/disable?customer_id=${encodeURIComponent(String(customerId))}`,
    ENABLE: (id: string | number, customerId: string | number) =>
      `${PREFIX}/mail/mailboxes/${encodeURIComponent(String(id))}/enable?customer_id=${encodeURIComponent(String(customerId))}`,
    SYNC: (customerId: string | number) =>
      `${PREFIX}/mail/customers/${encodeURIComponent(String(customerId))}/sync`,
    DELETE: (id: string | number, customerId: string | number) =>
      `${PREFIX}/mail/mailboxes/${encodeURIComponent(String(id))}?customer_id=${encodeURIComponent(String(customerId))}`,
    DOMAINS: (customerId: string | number) =>
      `${PREFIX}/mail/domains?customer_id=${encodeURIComponent(String(customerId))}`,
    DOMAIN_DNS: (domain: string) =>
      `${PREFIX}/mail/domains/${encodeURIComponent(domain)}/dns`,
  },
  SUPPORT: {
    TICKETS: (query?: string) =>
      query ? `${PREFIX}/support/tickets?${query}` : `${PREFIX}/support/tickets`,
    TICKET_DETAIL: (id: string | number) =>
      `${PREFIX}/support/tickets/${id}`,
    TICKET_MESSAGES: (id: string | number) =>
      `${PREFIX}/support/tickets/${id}/messages`,
  },
  CRM: {
    CONTACTS: `${PREFIX}/crm/contacts`,
    CONTACT_DETAIL: (id: string | number) =>
      `${PREFIX}/crm/contacts/${id}`,
  },
  HESTIA: {
    OVERVIEW: `${PREFIX}/hestia/overview`,
    PACKAGES: `${PREFIX}/hestia/packages`,
    USERS: `${PREFIX}/hestia/users`,
    USER_DETAIL: (user: string) => `${PREFIX}/hestia/users/${encodeURIComponent(user)}`,
    USER_DOMAINS: (user: string) =>
      `${PREFIX}/hestia/users/${encodeURIComponent(user)}/domains`,
    USER_DOMAIN_DETAIL: (user: string, domain: string) =>
      `${PREFIX}/hestia/users/${encodeURIComponent(user)}/domains/${encodeURIComponent(domain)}`,
    USER_SUSPEND: (user: string) =>
      `${PREFIX}/hestia/users/${encodeURIComponent(user)}/suspend`,
    USER_UNSUSPEND: (user: string) =>
      `${PREFIX}/hestia/users/${encodeURIComponent(user)}/unsuspend`,
  },
  CONFIG: {
    INTEGRATIONS: `${PREFIX}/config/integrations`,
    INTEGRATION_DETAIL: (id: string | number) =>
      `${PREFIX}/config/integrations/${id}`,
    INTEGRATION_TEST: (id: string | number) =>
      `${PREFIX}/config/integrations/${id}/test`,
    HESTIA_SETTINGS: `${PREFIX}/config/hestia/settings`,
  },
} as const;
