"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FeatureCard, SectionHeader } from "@/components/ui/ReusableCards";
import {
  Globe,
  Smartphone,
  BarChart3,
} from "lucide-react";

const cases = [
  {
    icon: Globe,
    title: "E-commerce Moda Premium",
    description:
      "Site de vendas online com mais de 500% de aumento em conversões após redesign. Integração com múltiplos gateways de pagamento.",
    badge: "E-commerce",
  },
  {
    icon: BarChart3,
    title: "Agência de Marketing",
    description:
      "Portal completo com automação de leads. Aumentou em 400% o número de clientes captados mensalmente.",
    badge: "SaaS",
  },
  {
    icon: Smartphone,
    title: "App Mobile para Delivery",
    description:
      "Aplicativo web e mobile com GPS em tempo real. Mais de 50 mil downloads com avaliação de 4.8 estrelas.",
    badge: "App",
  },
  {
    icon: Globe,
    title: "Site Corporativo B2B",
    description:
      "Presença online profissional que resultou em 15+ leads qualificados por mês. SEO em primeira página do Google.",
    badge: "Corporativo",
  },
  {
    icon: BarChart3,
    title: "Plataforma Educacional",
    description:
      "Plataforma com mais de 10 mil alunos ativos. Integração com pagamento recorrente e certificados digitais.",
    badge: "Educação",
  },
  {
    icon: Smartphone,
    title: "App de Gestão de Projetos",
    description:
      "Ferramenta completa com colaboração em tempo real. Reduz tempo de gerenciamento em 70% para empresas.",
    badge: "Gestão",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function Portfolio() {
  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-teal-500/[0.05] blur-[120px] orb-float" />
        <div className="absolute left-0 bottom-0 h-96 w-96 rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <SectionHeader
          badge="Portfolio"
          title="Casos de"
          highlight="sucesso"
          subtitle="Conheça alguns dos projetos que transformaram negócios. Histórias reais de empresas que cresceram com a gente."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {cases.map((project, index) => (
            <FeatureCard key={index} {...project} index={index} />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <Link
            href="/projetos"
            className="inline-flex items-center gap-2 rounded-full border border-teal-500/50 bg-teal-500/5 px-8 py-4 text-base font-semibold text-teal-400 transition-all hover:border-teal-400 hover:bg-teal-500/10"
          >
            Ver mais casos
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
