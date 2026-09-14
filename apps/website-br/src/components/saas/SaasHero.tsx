"use client";

import { motion } from "framer-motion";

export function SaasHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 py-24 md:py-32">
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            Site por Assinatura
          </span>
          <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
            Pague mensalmente.
            <br />
            <span className="text-white/90">Sem investimento inicial.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90">
            Site profissional com design, hospedagem e manutenção inclusos. Cancele quando quiser.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
