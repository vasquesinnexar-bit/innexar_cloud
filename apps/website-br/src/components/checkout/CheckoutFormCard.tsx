"use client";

import { motion } from "framer-motion";
import { ArrowRight, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";

type CheckoutFormCardProps = {
  planName: string;
  name: string;
  email: string;
  phone: string;
  loading: boolean;
  canSubmit: boolean;
  error: string | null;
  emailExists: boolean;
  portalLoginUrl: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
};

export function CheckoutFormCard({
  planName,
  name,
  email,
  phone,
  loading,
  canSubmit,
  error,
  emailExists,
  portalLoginUrl,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSubmit,
}: CheckoutFormCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300">
          <ShieldCheck size={14} />
          Checkout Seguro
        </p>
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/70">
          <CreditCard size={14} />
          Mercado Pago
        </p>
      </div>

      <h1 className="text-3xl font-bold text-white">Finalizar assinatura</h1>
      <p className="mt-2 text-white/70">
        Preencha os dados para iniciar o pagamento do plano <span className="font-semibold text-white">{planName}</span>.
      </p>

      <div className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-white/70">Nome completo</span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Seu nome completo"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-white/70">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="voce@empresa.com"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-white/70">Telefone</span>
          <input
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${emailExists ? "border-amber-400/40 bg-amber-500/10 text-amber-200" : "border-red-400/40 bg-red-500/10 text-red-200"}`}
        >
          <p>{error}</p>
          {emailExists && (
            <a href={portalLoginUrl} className="mt-2 inline-block font-semibold underline underline-offset-2">
              Ir para o portal e fazer login →
            </a>
          )}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!canSubmit || loading}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-700 px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Iniciando pagamento...
          </>
        ) : (
          <>
            Continuar para pagamento
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-white/50">
        <Lock size={13} />
        Seus dados trafegam com criptografia e proteção de pagamento.
      </div>
    </motion.div>
  );
}
