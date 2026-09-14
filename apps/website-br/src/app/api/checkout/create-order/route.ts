import { NextRequest, NextResponse } from "next/server";
import {
  BR_PLAN_PRODUCT_NAME,
  isBrPlanSlug,
} from "@/lib/br-plan-mapping";
import {
  fetchUsaCatalog,
  getPortalClientUrl,
  getSiteUrl,
  getWorkspaceApiUrl,
} from "@/lib/workspace-api";

type CheckoutStartResponse = {
  payment_url?: string | null;
  payment_status?: string | null;
  checkout_token?: string | null;
  existing_customer?: boolean;
  error_message?: string | null;
  detail?: string | { message?: string; reason?: string } | Array<{ msg?: string }>;
};

function mapProviderErrorMessage(status: number, rawError: string): string {
  const text = rawError.toLowerCase();
  if (status === 422) return "Dados invalidos. Confira nome, e-mail e telefone e tente novamente.";
  if (text.includes("both payer and collector must be real or test users")) {
    return "Mercado Pago: use contas do mesmo tipo (ambas teste ou ambas reais).";
  }
  if (text.includes("back_url is required") || text.includes("invalid value for back_url")) {
    return "Configuracao de retorno do checkout invalida. Verifique NEXT_PUBLIC_SITE_URL.";
  }
  if (status === 502) return "Falha de comunicacao com o provedor de pagamento. Tente novamente em instantes.";
  if (status >= 500) return "Servico de pagamento indisponivel no momento. Tente novamente.";
  return "Nao foi possivel gerar o link de pagamento.";
}

function extractErrorMessage(status: number, body: CheckoutStartResponse): string {
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(" | ") || "Dados invalidos.";
  }
  if (detail && typeof detail === "object" && "message" in detail && detail.message) {
    return detail.message;
  }
  return mapProviderErrorMessage(status, JSON.stringify(body));
}

async function resolveProductPlan(planSlug: string): Promise<{
  product_id: number;
  price_plan_id: number;
  planName: string;
}> {
  if (!isBrPlanSlug(planSlug)) {
    throw Object.assign(new Error("Plano invalido"), { statusCode: 400 });
  }

  const productName = BR_PLAN_PRODUCT_NAME[planSlug];
  const catalog = await fetchUsaCatalog();
  const product = catalog.find((item) => item.name === productName);
  if (!product) {
    throw Object.assign(new Error(`Produto '${productName}' nao encontrado no catalogo.`), {
      statusCode: 503,
      reason: "product_not_found",
    });
  }

  const monthlyPlan =
    product.plans.find((plan) => plan.interval === "month") ?? product.plans[0];
  if (!monthlyPlan) {
    throw Object.assign(new Error("Plano de preco nao configurado."), {
      statusCode: 503,
      reason: "price_plan_not_found",
    });
  }

  return {
    product_id: product.id,
    price_plan_id: monthlyPlan.id,
    planName: product.name,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { planId, email, name, phone, firstName, lastName } = await request.json();

    const normalizedName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!planId || !email || !normalizedName) {
      return NextResponse.json({ message: "Dados obrigatorios faltando" }, { status: 400 });
    }

    const { product_id, price_plan_id, planName } = await resolveProductPlan(String(planId));
    const siteUrl = getSiteUrl().replace(/\/$/, "");
    const phoneStr = typeof phone === "string" ? phone.trim() : undefined;

    const successUrl = new URL("/checkout/success", siteUrl);
    successUrl.searchParams.set("plan_slug", String(planId));
    successUrl.searchParams.set("email", String(email).trim());
    successUrl.searchParams.set("name", normalizedName);
    if (phoneStr) successUrl.searchParams.set("phone", phoneStr);

    const cancelUrl = new URL("/checkout/cancel", siteUrl);
    cancelUrl.searchParams.set("plan_slug", String(planId));

    const response = await fetch(`${getWorkspaceApiUrl()}/api/public/checkout/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Org-Id": "innexar-br",
      },
      body: JSON.stringify({
        product_id,
        price_plan_id,
        customer_email: String(email).trim().toLowerCase(),
        customer_name: normalizedName,
        customer_phone: phoneStr || undefined,
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
        locale: "pt",
      }),
    });

    const body = (await response.json().catch(() => ({}))) as CheckoutStartResponse;

    if (response.status === 409) {
      const portalUrl = `${getPortalClientUrl().replace(/\/$/, "")}/pt/login?email=${encodeURIComponent(String(email).trim())}`;
      return NextResponse.json(
        {
          message: "Este e-mail ja possui uma conta. Faca login no portal do cliente.",
          reason: "email_exists",
          portalUrl,
        },
        { status: 409 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message: extractErrorMessage(response.status, body),
          reason: "checkout_provider_error",
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    const paymentUrl = body.payment_url;
    if (!paymentUrl) {
      return NextResponse.json(
        { message: body.error_message || "Link de pagamento nao retornado." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      paymentUrl,
      paymentStatus: body.payment_status ?? "pending",
      planName,
      checkoutToken: body.checkout_token ?? null,
    });
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const reason = (error as { reason?: string }).reason;

    if (typeof statusCode === "number") {
      return NextResponse.json(
        {
          message: (error as Error).message,
          reason: reason ?? "checkout_error",
        },
        { status: statusCode },
      );
    }

    console.error("[create-order] Unexpected error:", error);
    return NextResponse.json(
      { message: "Erro interno ao processar o pedido" },
      { status: 500 },
    );
  }
}
