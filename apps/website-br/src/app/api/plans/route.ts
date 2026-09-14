import { NextResponse } from "next/server";
import {
  BR_PLAN_PRODUCT_NAME,
  type BrPlanSlug,
} from "@/lib/br-plan-mapping";
import { fetchUsaCatalog } from "@/lib/workspace-api";

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  billing_interval: string;
  currency: string;
};

export async function GET() {
  try {
    const catalog = await fetchUsaCatalog();
    const byName = new Map(catalog.map((item) => [item.name, item]));
    const items: CatalogItem[] = [];

    for (const slug of Object.keys(BR_PLAN_PRODUCT_NAME) as BrPlanSlug[]) {
      const productName = BR_PLAN_PRODUCT_NAME[slug];
      const product = byName.get(productName);
      if (!product) continue;

      const monthlyPlan =
        product.plans.find((plan) => plan.interval === "month") ?? product.plans[0];
      if (!monthlyPlan) continue;

      items.push({
        id: String(product.id),
        slug,
        name: product.name,
        description: product.description ?? "",
        price_cents: Math.round(monthlyPlan.amount * 100),
        billing_interval: monthlyPlan.interval,
        currency: monthlyPlan.currency || "BRL",
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch plans catalog", error);
    return NextResponse.json({ message: "Falha ao carregar catálogo" }, { status: 502 });
  }
}

export async function POST() {
  return GET();
}
