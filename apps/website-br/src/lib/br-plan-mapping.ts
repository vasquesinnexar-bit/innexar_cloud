/** Maps BR website plan slugs to unified workspace API products (org innexar-br). */

export type BrPlanSlug =
  | "site-starter"
  | "site-pro"
  | "site-enterprise"
  | "ads-starter"
  | "ads-premium"
  | "ads-full";

/** Product name in billing_products (org_id=innexar). */
export const BR_PLAN_PRODUCT_NAME: Record<BrPlanSlug, string> = {
  "site-starter": "Site Essencial",
  "site-pro": "Site Profissional",
  "site-enterprise": "Máquina de Vendas",
  "ads-starter": "Ads Essencial",
  "ads-premium": "Ads Premium",
  "ads-full": "Marketing 360°",
};

export function isBrPlanSlug(value: string): value is BrPlanSlug {
  return value in BR_PLAN_PRODUCT_NAME;
}
