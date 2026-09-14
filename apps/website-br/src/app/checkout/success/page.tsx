"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, ArrowRight } from "lucide-react";
import { getPortalClientUrl } from "@/lib/workspace-api";

const CHECKOUT_TOKEN_KEY = "innexar_checkout_auto_login_token";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const queryToken = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const name = searchParams.get("name") || "";
  const planSlug = searchParams.get("plan_slug") || "";
  const [countdown, setCountdown] = useState(8);

  const token = useMemo(() => {
    if (queryToken) return queryToken;
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(CHECKOUT_TOKEN_KEY) || "";
  }, [queryToken]);

  const portalBase = getPortalClientUrl().replace(/\/$/, "");

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      sessionStorage.removeItem(CHECKOUT_TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown !== 0) return;
    const target = token
      ? `${portalBase}/pt/login?checkout=success&token=${encodeURIComponent(token)}`
      : `${portalBase}/pt/login?checkout=success`;
    window.location.href = target;
  }, [countdown, portalBase, token]);

  function handleGoNow() {
    const target = token
      ? `${portalBase}/pt/login?checkout=success&token=${encodeURIComponent(token)}`
      : `${portalBase}/pt/login?checkout=success`;
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm"
        >
          <CheckCircle2 className="mx-auto mb-4 text-teal-300" size={46} />
          <h1 className="text-3xl font-bold text-white">Pagamento iniciado com sucesso</h1>
          <p className="mt-2 text-white/70">
            Assim que o pagamento for confirmado, seu acesso ao portal estará disponível.
          </p>

          {(name || email || planSlug) && (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-left">
              {name && (
                <p className="text-sm text-white/70">
                  Cliente: <span className="text-white">{name}</span>
                </p>
              )}
              {email && (
                <p className="text-sm text-white/70">
                  E-mail: <span className="text-white">{email}</span>
                </p>
              )}
              {planSlug && (
                <p className="text-sm text-white/70">
                  Plano: <span className="text-white">{planSlug}</span>
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleGoNow}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-700 px-6 py-3 font-semibold text-white"
          >
            Ir para o portal
            <ArrowRight size={18} />
          </button>

          <p className="mt-4 text-sm text-white/50">
            Redirecionando em {countdown}s...
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
          <Clock3 className="mx-auto mb-4 text-teal-300" size={46} />
          <h1 className="text-3xl font-bold text-white">Carregando...</h1>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
