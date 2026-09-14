"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Rocket, Globe, Smartphone, TrendingUp } from "lucide-react";

export function PromoPageClient() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
      <div className="container mx-auto px-4 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-300">
            Oferta por tempo limitado
          </div>

          <h1 className="mb-6 text-5xl font-bold text-white lg:text-6xl">
            <span className="bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
              50% OFF
            </span>
            <br />
            na Criação do Seu Site
          </h1>

          <p className="mb-10 text-xl text-slate-300">
            Aproveite nossa oferta especial e tenha um site profissional com desconto exclusivo. Por tempo limitado!
          </p>

          <div className="mb-10 grid gap-6 text-left md:grid-cols-3">
            {[
              { icon: Globe, title: "Site Profissional", desc: "Design moderno e responsivo" },
              { icon: Smartphone, title: "Mobile First", desc: "Perfeito em qualquer dispositivo" },
              { icon: TrendingUp, title: "SEO Incluso", desc: "Para aparecer no Google" },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/10 p-5 backdrop-blur"
              >
                <item.icon className="mb-3 h-8 w-8 text-orange-400" />
                <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>

          <Link
            href="/criar-site"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 px-10 py-5 text-lg font-bold text-white shadow-xl shadow-orange-500/30 transition-all duration-300 hover:scale-105 hover:from-orange-400 hover:to-yellow-400"
          >
            <Rocket className="h-6 w-6" />
            Quero meu site com 50% OFF!
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
