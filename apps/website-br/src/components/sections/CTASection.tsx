"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Rocket, CheckCircle2, MessageCircle } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";

const benefits = [
  "Entrega em até 7 dias úteis",
  "Design exclusivo para sua marca",
  "SEO otimizado desde o primeiro dia",
  "Suporte incluso por 3 meses",
  "Hospedagem profissional",
  "Site 100% responsivo",
];

export function CTASection() {
  const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Olá! Gostaria de agendar uma call e saber mais sobre os serviços da Innexar.")}`;

  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.06] via-transparent to-teal-700/[0.08]" />
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/[0.05] blur-[120px] orb-float orb-slow" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
            Comece hoje
          </span>

          <AnimatedTitle as="h2" className="mb-6 text-4xl font-black leading-tight text-white md:text-6xl">
            Pronto para fazer seu negócio
            <br />
            <span className="bg-gradient-to-r from-teal-400 via-orange-400 to-orange-500 bg-clip-text text-transparent">
              crescer de verdade?
            </span>
          </AnimatedTitle>

          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-white/50">
            Mais de 500 empresas já transformaram sua presença digital com a Innexar. Sua vez é agora.
          </p>

          <div className="mx-auto mb-12 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-white/55">
                <CheckCircle2 size={15} className="shrink-0 text-teal-500" />
                {b}
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/planos"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-10 py-4 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,201,177,0.55)]"
            >
              <Rocket size={20} />
              Ver planos e preços
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-9 py-4 text-base font-medium text-white/70 transition-all hover:border-teal-500/50 hover:bg-teal-500/5 hover:text-teal-400"
            >
              <MessageCircle size={20} />
              Falar no WhatsApp
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
