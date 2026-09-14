"use client";

import { motion } from "framer-motion";

export function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-[#050b16] pt-32 pb-14 md:pt-40 md:pb-20">
      <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-teal-500/[0.06] blur-[120px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[.08] px-4 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
            Fale conosco
          </span>
          <h1 className="mb-6 font-[family-name:var(--font-syne)] text-4xl font-bold leading-[1.08] tracking-[-.035em] text-white md:text-6xl">
            Vamos conversar sobre
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-teal-200 bg-clip-text text-transparent">
              seu projeto
            </span>
          </h1>
          <p className="text-xl leading-relaxed text-slate-300/80">
            Preencha o formulário ou use um dos canais abaixo. Respondemos em até 24 horas.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
