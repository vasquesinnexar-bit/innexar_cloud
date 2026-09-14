"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="mb-6 inline-flex"
        >
          <div className="rounded-full bg-orange-500/20 p-6">
            <AlertCircle className="h-16 w-16 text-orange-400" />
          </div>
        </motion.div>

        <h1 className="mb-4 text-4xl font-bold text-white">
          Pagamento cancelado
        </h1>
        <p className="mb-8 text-lg text-white/60">
          Seu pagamento foi cancelado. Nenhum valor foi debitado.
          <br />
          Você pode tentar novamente ou escolher outro método.
        </p>

        <div className="mb-12 rounded-2xl border border-white/10 bg-white/5 p-8">
          <p className="mb-4 text-white/80">
            Se você tiver dúvidas ou precisar de ajuda, entre em contato com nosso time:
          </p>
          <a
            href="https://wa.me/5513991821557"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 font-semibold"
          >
            Falar no WhatsApp
          </a>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row justify-center">
          <Link
            href="/planos"
            className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-700 px-8 py-3 font-semibold text-white shadow-lg shadow-teal-500/20 transition-all hover:-translate-y-1 hover:shadow-teal-500/40"
          >
            Voltar aos planos
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/20 bg-white/5 px-8 py-3 font-semibold text-white transition-all hover:bg-white/10"
          >
            Ir para início
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
