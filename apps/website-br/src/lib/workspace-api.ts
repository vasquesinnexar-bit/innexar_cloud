const DEFAULT_API_URL = "https://api3.innexar.app";

const ORG_BR = "innexar-br";

export function getWorkspaceApiUrl(): string {
  const configured =
    process.env.WORKSPACE_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_API_URL?.trim();
  if (!configured) return DEFAULT_API_URL;
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

export function getPortalClientUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_PORTAL_CLIENT_URL?.trim() ||
    process.env.PORTAL_CLIENT_URL?.trim();
  return configured || "https://portal.innexar.com.br";
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured || "https://innexar.com.br";
}

export type UsaCatalogProduct = {
  id: number;
  name: string;
  description: string | null;
  plans: Array<{
    id: number;
    name: string;
    amount: number;
    interval: string;
    currency: string;
  }>;
};

export async function fetchUsaCatalog(): Promise<UsaCatalogProduct[]> {
  const response = await fetch(
    `${getWorkspaceApiUrl()}/api/public/products/catalog?interval=month&locale=pt`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Org-Id": ORG_BR,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Catalog fetch failed: ${response.status}`);
  }
  return (await response.json()) as UsaCatalogProduct[];
}
