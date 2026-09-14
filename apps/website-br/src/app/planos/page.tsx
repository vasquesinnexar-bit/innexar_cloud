"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe,
  Megaphone,
  X,
  Star,
  Shield,
  Clock,
  MessageCircle,
} from "lucide-react";

/* ─────────────────────────────── Data ─────────────────────────────── */
type Plan = {
  id: string;
  category: "sites" | "marketing";
  name: string;
  monthlyPrice: number;
  description: string;
  badge?: string;
  badgeVariant?: "popular" | "recommended" | "best";
  features: string[];
  notIncluded?: string[];
  highlight: boolean;
  cta: string;
  ctaVariant?: "primary" | "secondary";
};

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  billing_interval: string;
  currency: string;
};

const plans: Plan[] = [
  /* ── Sites & Apps ── */
  {
    id: "site-starter",
    category: "sites",
    name: "Site Essencial",
    monthlyPrice: 299,
    description: "Site profissional com hospedagem inclusa",
    badge: "Popular",
    badgeVariant: "popular",
    features: [
      "Até 10 páginas",
      "Design responsivo premium",
      "Blog integrado",
      "SEO On-Page básico",
      "SSL incluso",
      "Hospedagem ultra-rápida",
      "E-mail profissional",
      "Suporte técnico",
      "2 alterações/mês",
    ],
    notIncluded: ["CRM", "Automação de funil", "Campanhas de Ads"],
    highlight: false,
    cta: "Escolher plano",
  },
  {
    id: "site-pro",
    category: "sites",
    name: "Site Profissional",
    monthlyPrice: 499,
    description: "Site + Sistema de leads + Marketing integrado",
    badge: "Mais vendido",
    badgeVariant: "recommended",
    features: [
      "Tudo do plano Essencial",
      "Até 30 páginas",
      "Blog avançado com SEO técnico",
      "Sistema de captação de leads",
      "Integração WhatsApp Business",
      "Integração redes sociais",
      "Google Analytics 4 configurado",
      "Formulários avançados + CRM leve",
      "5 alterações/mês",
      "Suporte prioritário",
    ],
    notIncluded: ["Automação completa de funil", "Campanhas de Ads"],
    highlight: true,
    cta: "Escolher plano",
    ctaVariant: "primary",
  },
  {
    id: "site-enterprise",
    category: "sites",
    name: "Máquina de Vendas",
    monthlyPrice: 799,
    description: "Site + CRM + Automação de marketing completa",
    badge: "Full Stack",
    badgeVariant: "best",
    features: [
      "Tudo do plano Profissional",
      "Páginas ilimitadas",
      "CRM integrado completo",
      "Automação de funil de vendas",
      "Integração com gateway de pagamento",
      "Relatórios customizados + BI",
      "Consultoria estratégica mensal",
      "Alterações ilimitadas",
      "Suporte VIP 24h",
      "Gestor de conta dedicado",
    ],
    highlight: false,
    cta: "Solicitar demo",
    ctaVariant: "secondary",
  },

  /* ── Marketing & Ads ── */
  {
    id: "ads-starter",
    category: "marketing",
    name: "Ads Essencial",
    monthlyPrice: 399,
    description: "Gestão de campanhas + básico em redes sociais",
    features: [
      "Gerenciamento Google Ads",
      "Gerenciamento Meta Ads",
      "2 campanhas ativas por plataforma",
      "Relatórios semanais",
      "Otimização de performance",
      "A/B testing automático",
      "Gestão de redes (4 posts/mês)",
      "Planejamento de conteúdo",
      "Community management",
      "Suporte direto",
    ],
    notIncluded: ["Criação de vídeos/motion", "Campanhas ilimitadas"],
    highlight: false,
    cta: "Escolher plano",
  },
  {
    id: "ads-premium",
    category: "marketing",
    name: "Ads Premium",
    monthlyPrice: 699,
    description: "Gestão completa de marketing digital",
    badge: "Mais vendido",
    badgeVariant: "recommended",
    features: [
      "Tudo do plano Essencial",
      "Campanhas ilimitadas",
      "Estratégia de conteúdo completa",
      "Copywriting profissional",
      "Designs gráficos (até 20/mês)",
      "Gestão de 6 redes sociais",
      "20+ posts/mês",
      "Análise de concorrência",
      "Reuniões estratégicas 2x/semana",
    ],
    notIncluded: ["Vídeos para ads"],
    highlight: true,
    cta: "Escolher plano",
    ctaVariant: "primary",
  },
  {
    id: "ads-full",
    category: "marketing",
    name: "Marketing 360°",
    monthlyPrice: 1299,
    description: "Tudo incluso — marketing total com produção de vídeo",
    badge: "Full Package",
    badgeVariant: "best",
    features: [
      "Tudo do plano Premium",
      "Vídeos para ads (até 8/mês)",
      "Motion design e animações",
      "Funil completo de conversão",
      "Landing pages dedicadas",
      "WhatsApp marketing automatizado",
      "E-mail marketing completo",
      "Dashboard em tempo real",
      "Gestor de conta dedicado",
    ],
    highlight: false,
    cta: "Solicitar proposta",
    ctaVariant: "secondary",
  },
];

/* ─────────────────────────────── Helpers ─────────────────────────────── */
function annualPrice(monthly: number) {
  return Math.round(monthly * 0.8);
}

function fmt(n: number) {
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

/* ─────────────────────────────── Components ─────────────────────────────── */
function BadgePill({
  variant,
  label,
}: {
  variant: Plan["badgeVariant"];
  label: string;
}) {
  const styles: Record<NonNullable<Plan["badgeVariant"]>, string> = {
    popular:     "border-teal-500/50 bg-teal-500/15 text-teal-300",
    recommended: "border-orange-500/50 bg-orange-500/15 text-orange-300",
    best:        "border-violet-500/50 bg-violet-500/15 text-violet-300",
  };
  return (
    <span
      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${styles[variant ?? "popular"]}`}
    >
      {label}
    </span>
  );
}

function PlanCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: "monthly" | "annual";
}) {
  const price   = billing === "annual" ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice;
  const savings = plan.monthlyPrice - annualPrice(plan.monthlyPrice);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ duration: 0.35 }}
      className={`group relative flex flex-col rounded-2xl p-8 transition-all duration-300 ${
        plan.highlight
          ? "border-2 border-teal-500/55 bg-gradient-to-br from-teal-500/[0.12] to-teal-700/[0.04] shadow-[0_0_60px_rgba(0,201,177,0.12)] glow-ring"
          : "border border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
      }`}
    >
      {plan.badge && plan.badgeVariant && (
        <BadgePill variant={plan.badgeVariant} label={plan.badge} />
      )}

      {/* Name + desc */}
      <div className="mb-5">
        <h3 className="text-xl font-black text-white">{plan.name}</h3>
        <p className="mt-1 text-sm text-white/55">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-2 flex items-end gap-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${plan.id}-${billing}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className={`text-4xl font-black ${plan.highlight ? "text-teal-400" : "text-white"}`}
          >
            {fmt(price)}
          </motion.span>
        </AnimatePresence>
        <span className="mb-1 text-sm text-white/40">/mês</span>
      </div>

      {/* Annual savings */}
      {billing === "annual" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400"
        >
          <Star size={11} />
          Economize {fmt(savings * 12)}/ano
        </motion.div>
      )}

      <div className="mb-5 mt-3 border-t border-white/[0.08]" />

      {/* Features */}
      <div className="flex-1 space-y-2.5">
        {plan.features.map((feat, i) => (
          <motion.div
            key={feat}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.025, duration: 0.2 }}
            className="flex items-start gap-2.5"
          >
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-teal-400" />
            <span className="text-sm text-white/75">{feat}</span>
          </motion.div>
        ))}
        {plan.notIncluded?.map((feat) => (
          <div key={feat} className="flex items-start gap-2.5 opacity-30">
            <X size={15} className="mt-0.5 flex-shrink-0 text-white/50" />
            <span className="text-sm text-white/50 line-through">{feat}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href={`/checkout/${plan.id}`}
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all duration-300 ${
          plan.ctaVariant === "secondary"
            ? "border border-white/20 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10"
            : plan.highlight
            ? "bg-gradient-to-r from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-500/25 hover:-translate-y-0.5 hover:shadow-teal-500/45"
            : "bg-white/10 text-white hover:bg-white/18"
        }`}
      >
        {plan.cta}
        <ArrowRight size={16} />
      </Link>
    </motion.div>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */
export default function PlansPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [tab, setTab] = useState<"sites" | "marketing">("sites");
  const [catalogMap, setCatalogMap] = useState<
    Record<string, { monthlyPrice: number; name: string; description: string }>
  >({});

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      try {
        const response = await fetch("/api/plans", { method: "GET", cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const catalog = (await response.json()) as CatalogItem[];
        const nextMap: Record<string, { monthlyPrice: number; name: string; description: string }> = {};

        for (const item of catalog) {
          nextMap[item.slug] = {
            monthlyPrice: Math.round(item.price_cents / 100),
            name: item.name,
            description: item.description,
          };
        }

        if (active) {
          setCatalogMap(nextMap);
        }
      } catch {
        // Preserve static fallback plans when backend catalog is temporarily unavailable.
      }
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  const filteredPlans = plans
    .filter((p) => p.category === tab)
    .map((plan) => {
      const fromCatalog = catalogMap[plan.id];
      if (!fromCatalog) {
        return plan;
      }

      return {
        ...plan,
        monthlyPrice: fromCatalog.monthlyPrice,
        name: fromCatalog.name,
        description: fromCatalog.description,
      };
    });

  return (
    <div className="min-h-screen bg-[#0d1b2a]">
      {/* Header */}
      <div className="relative overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-teal-500/[0.08] blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-orange-500/[0.05] blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 text-center md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
              <Zap size={13} />
              Planos &amp; Preços
            </span>

            <h1 className="mb-5 text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Invista no crescimento{" "}
              <br />
              <span className="bg-gradient-to-r from-teal-400 via-teal-300 to-orange-400 bg-clip-text text-transparent">
                do seu negócio
              </span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-white/55">
              Sem contrato longo. Cancele quando quiser. Todos os planos incluem suporte e atualizações.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
              {[
                { icon: Shield, text: "Dados protegidos" },
                { icon: Clock,  text: "Setup em 48h"     },
                { icon: Star,   text: "4.9 / 5 estrelas" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon size={14} className="text-teal-400" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky controls */}
      <div className="sticky top-16 z-30 border-b border-white/[0.08] bg-[#0d1b2a]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 md:px-10">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            {/* Category tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {(["sites", "marketing"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                    tab === t
                      ? "bg-teal-500 text-white shadow-lg shadow-teal-500/30"
                      : "text-white/50 hover:text-white/75"
                  }`}
                >
                  {t === "sites" ? <Globe size={15} /> : <Megaphone size={15} />}
                  {t === "sites" ? "Sites & Apps" : "Marketing & Ads"}
                </button>
              ))}
            </div>

            {/* Billing toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBilling("monthly")}
                className={`text-sm font-semibold transition-colors ${billing === "monthly" ? "text-white" : "text-white/35 hover:text-white/60"}`}
              >
                Mensal
              </button>

              <button
                onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
                className="relative h-6 w-12 rounded-full border border-white/20 bg-white/10 transition-colors"
                aria-label="Toggle billing period"
              >
                <motion.div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-teal-500 shadow"
                  animate={{ left: billing === "annual" ? "calc(100% - 22px)" : "2px" }}
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              </button>

              <button
                onClick={() => setBilling("annual")}
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${billing === "annual" ? "text-white" : "text-white/35 hover:text-white/60"}`}
              >
                Anual
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  −20%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} billing={billing} />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center"
        >
          <p className="text-sm text-white/45">
            Todos os planos incluem{" "}
            <span className="font-semibold text-white/70">domínio grátis no 1º ano</span>,{" "}
            <span className="font-semibold text-white/70">SSL/HTTPS</span> e{" "}
            <span className="font-semibold text-white/70">hospedagem gerenciada</span>. Precisa de algo personalizado?{" "}
            <a
              href={`https://wa.me/5513991821557?text=${encodeURIComponent("Olá! Gostaria de um plano personalizado.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal-400 underline underline-offset-2 hover:text-teal-300"
            >
              Fale com a gente
            </a>
            .
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="relative overflow-hidden border-t border-white/[0.06] py-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 rounded-full bg-teal-500/[0.05] blur-[80px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center md:px-10">
          <h3 className="mb-3 text-2xl font-black text-white">Ainda tem dúvidas?</h3>
          <p className="mb-8 text-white/55">
            Nosso time responde em minutos no WhatsApp. Também fazemos propostas 100% personalizadas.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={`https://wa.me/5513991821557?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre os planos.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-8 py-3.5 font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,201,177,0.5)]"
            >
              <MessageCircle size={18} />
              Falar no WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-3.5 font-semibold text-white/70 transition-all hover:border-teal-500/40 hover:text-teal-400"
            >
              Enviar mensagem
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
