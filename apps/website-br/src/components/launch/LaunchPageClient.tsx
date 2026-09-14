"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Rocket, CheckCircle2, ArrowRight } from "lucide-react";

const features = [
  "Site profissional em até 7 dias",
  "Design moderno e responsivo",
  "SEO otimizado para o Google",
  "Formulário de contato funcional",
  "Integração com WhatsApp",
  "1 ano de hospedagem grátis",
];

const plans = [
  {
    name: "Landing Page",
    price: "R$ 1.497",
    desc: "Ideal para campanhas e negócios iniciando online",
    features: ["1 página completa", "Design exclusivo", "Formulário de contato", "SEO básico", "SSL incluso", "Entrega em 7 dias"],
    cta: "/contact",
    highlight: false,
  },
  {
    name: "Site Profissional",
    price: "R$ 2.997",
    desc: "Para empresas que querem presença digital sólida",
    features: ["Até 6 páginas", "Design exclusivo", "Blog integrado", "SEO completo", "WhatsApp integrado", "Google Analytics", "Entrega em 14 dias"],
    cta: "/contact",
    highlight: true,
  },
  {
    name: "E-commerce",
    price: "Sob consulta",
    desc: "Loja online completa com carrinho e pagamento",
    features: ["Produtos ilimitados", "Checkout completo", "Mercado Pago", "Gestão de estoque", "Relatórios de vendas", "Integração ERP"],
    cta: "/contact",
    highlight: false,
  },
];

export function LaunchPageClient() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-16 text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/20 px-4 py-2 text-sm font-medium text-teal-300">
              <Rocket className="h-4 w-4" />
              Lançamento especial
            </div>

            <h1 className="mb-6 text-4xl font-bold text-white md:text-6xl">
              Seu Site no Ar em{" "}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                7 Dias
              </span>
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-xl text-slate-300">
              Temos tudo que seu negócio precisa para crescer online. Site profissional, rápido e que converte.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
            >
              <h2 className="mb-6 text-xl font-semibold text-white">O que está incluído:</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-400" />
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20"
          >
            <h2 className="mb-12 text-center text-2xl font-bold text-white md:text-3xl">Escolha seu plano</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className={`relative rounded-2xl p-8 ${
                    plan.highlight
                      ? "border-2 border-teal-400/50 bg-teal-500/15"
                      : "border border-white/10 bg-white/5 backdrop-blur-sm"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-slate-900">
                      Recomendado
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-semibold text-teal-400">{plan.price}</p>
                  <p className="mt-2 text-sm text-slate-400">{plan.desc}</p>
                  <ul className="mt-6 space-y-2">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 font-semibold text-white transition-all hover:from-teal-400 hover:to-cyan-400"
                  >
                    Escolher plano
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-slate-400">
              Sem contrato de longo prazo. Cancele quando quiser.
            </p>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
