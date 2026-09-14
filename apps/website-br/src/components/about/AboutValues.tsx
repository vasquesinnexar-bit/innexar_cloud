"use client";

import { motion } from "framer-motion";
import { Award, Users, Globe2, Rocket } from "lucide-react";

const stats = [
  { icon: Users, value: "120+", label: "Clientes ativos" },
  { icon: Award, value: "98%", label: "Satisfação" },
  { icon: Globe2, value: "8+", label: "Anos de mercado" },
  { icon: Rocket, value: "200+", label: "Projetos entregues" },
];

export function AboutValues() {
  return (
    <section className="bg-[#050b16] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <s.icon className="mx-auto mb-3 h-10 w-10 text-teal-400" />
              <p className="text-3xl font-bold text-white md:text-4xl">{s.value}</p>
              <p className="text-sm text-slate-400">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
