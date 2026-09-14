"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckoutFormCard } from "@/components/checkout/CheckoutFormCard";

const CHECKOUT_TOKEN_KEY = "innexar_checkout_auto_login_token";

type CheckoutResponse = {
  paymentUrl: string;
  paymentStatus: string;
  planName: string;
  checkoutToken?: string;
};

type CheckoutErrorResponse = {
  message: string;
  reason?: string;
};

function getFriendlyCheckoutError(status: number, body: CheckoutErrorResponse): string {
  if (status === 422) {
    return body.message || "Dados invalidos. Revise os campos e tente novamente.";
  }
  if (status === 502) {
    return body.message || "Falha ao conectar com o provedor de pagamento. Tente novamente.";
  }
  if (status === 503) {
    return body.message || "Servico de pagamento temporariamente indisponivel.";
  }
  return body.message || "Nao foi possivel iniciar o checkout agora.";
}

const PLAN_LABELS: Record<string, string> = {
  "site-starter": "Site Essencial",
  "site-pro": "Site Profissional",
  "site-enterprise": "Máquina de Vendas",
  "ads-starter": "Ads Essencial",
  "ads-premium": "Ads Premium",
  "ads-full": "Marketing 360°",
};

export default function CheckoutPage() {
  const params = useParams();
  const planId = String(params.planId || "");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);

  const planName = useMemo(() => PLAN_LABELS[planId] ?? planId, [planId]);

  const canSubmit = name.trim().length >= 3 && email.trim().length > 3 && phone.trim().length >= 8;
  const portalLoginUrl = `${(process.env.NEXT_PUBLIC_PORTAL_CLIENT_URL ?? "https://portal.innexar.com.br").replace(/\/$/, "")}/pt/login?email=${encodeURIComponent(email.trim())}`;

  async function handleContinue() {
    if (!canSubmit || loading) return;

    setLoading(true);
    setError(null);
    setEmailExists(false);

    try {
      const response = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const body = await response.json().catch(() => ({}) as CheckoutErrorResponse);

      if (response.status === 409) {
        setEmailExists(true);
        setError((body as CheckoutErrorResponse).message || "Este e-mail já possui uma conta.");
        setLoading(false);
        return;
      }

      if (response.status === 422 || response.status === 502 || response.status === 503) {
        setError(getFriendlyCheckoutError(response.status, body as CheckoutErrorResponse));
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error((body as CheckoutErrorResponse).message || "Não foi possível iniciar o pagamento.");
      }

      const data = body as CheckoutResponse;
      if (data.checkoutToken) {
        sessionStorage.setItem(CHECKOUT_TOKEN_KEY, data.checkoutToken);
      }
      window.location.href = data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 px-6 py-20">
      <div className="mx-auto max-w-xl">
        <CheckoutFormCard
          planName={planName}
          name={name}
          email={email}
          phone={phone}
          loading={loading}
          canSubmit={canSubmit}
          error={error}
          emailExists={emailExists}
          portalLoginUrl={portalLoginUrl}
          onNameChange={setName}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}
          onSubmit={handleContinue}
        />
      </div>
    </div>
  );
}
