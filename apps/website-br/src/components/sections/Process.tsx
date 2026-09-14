"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  Pencil,
  Zap,
  CheckCircle,
} from "lucide-react";
import { StepCard, SectionHeader } from "@/components/ui/ReusableCards";

const steps = [
  {
    number: 1,
    icon: MessageSquare,
    title: "Conversa Inicial",
    description:
      "Entendemos seus objetivos, visão e desafios. Uma conversa aberta para conhecer melhor seu negócio.",
  },
  {
    number: 2,
    icon: Pencil,
    title: "Planejamento e Proposta",
    description:
      "Desenvolvemos uma estratégia completa com timeline, escopo e investimento transparente.",
  },
  {
    number: 3,
    icon: Zap,
    title: "Execução e Desenvolvimento",
    description:
      "Entregamos seu projeto com qualidade, comunicação constante e transparência total.",
  },
  {
    number: 4,
    icon: CheckCircle,
    title: "Suporte e Evolução",
    description:
      "Após o lançamento, garantimos suporte técnico e atualizações para seu sucesso contínuo.",
  },
];

export function Process() {
  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-teal-500/[0.05] blur-[120px] orb-float orb-slow" />
        <div className="absolute left-0 bottom-0 h-96 w-96 rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <SectionHeader
          badge="Processo"
          title="Como funciona"
          subtitle="Do primeiro contato até o sucesso, seguimos uma metodologia comprovada e transparente."
          highlight="nosso processo"
        />

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <StepCard key={index} {...step} index={index} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="mb-6 text-lg text-white/60">
            Pronto para começar sua jornada digital?
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-8 py-4 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,201,177,0.55)]"
          >
            Solicite um orçamento
          </a>
        </motion.div>
      </div>
    </section>
  );
}
