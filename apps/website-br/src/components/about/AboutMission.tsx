"use client";

import { motion } from "framer-motion";
import { Target, Zap, Users } from "lucide-react";

const items = [
  {
    icon: Target,
    title: "Missão",
    desc: "Democratizar o acesso a tecnologia de qualidade para empresas de todos os portes, entregando soluções que geram resultados mensuráveis.",
  },
  {
    icon: Zap,
    title: "Visão",
    desc: "Ser referência em transformação digital no Brasil, combinando inovação, design e performance em cada projeto.",
  },
  {
    icon: Users,
    title: "Valores",
    desc: "Transparência, agilidade, foco em resultados e parceria de longo prazo com nossos clientes.",
  },
];

export function AboutMission() {
  return (
    <section className="relative bg-[#081321] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid gap-8 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-white/[.09] bg-white/[.035] p-8 transition-colors hover:border-cyan-300/25 hover:bg-white/[.055]"
            >
              <item.icon className="mb-4 h-12 w-12 text-teal-400" />
              <h3 className="mb-3 text-xl font-bold text-white">{item.title}</h3>
              <p className="text-slate-300">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
