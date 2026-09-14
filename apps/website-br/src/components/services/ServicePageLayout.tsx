"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { useRef } from "react";

export type FeatureItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

export type PlanItem = {
  name: string;
  price: string;
  priceNote?: string;
  desc: string;
  features: string[];
  cta: string;
  ctaLabel?: string;
  highlight: boolean;
  badge?: string;
};

type ServicePageLayoutProps = {
  badge: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  accentColor?: string;
  features: FeatureItem[];
  plans: PlanItem[];
};

/* ── 3D tilt feature card ── */
function FeatureCard({ item, index }: { item: FeatureItem; index: number }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 22, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 200, damping: 22, mass: 0.5 });
  const Icon = item.icon;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    ry.set(((e.clientX - rect.left) / rect.width - 0.5) * 14);
    rx.set((0.5 - (e.clientY - rect.top) / rect.height) * 14);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.07, duration: 0.45 }}
      className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm transition-all duration-300 hover:border-teal-500/30 hover:bg-white/[0.07] hover:-translate-y-1 cursor-default"
    >
      {/* Glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(0,201,177,0.07), transparent 70%)" }} />

      <div className="relative z-10">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10"
             style={{ transform: "translateZ(16px)" }}>
          <Icon className="h-6 w-6 text-teal-400" />
        </div>
        <h3 className="mb-2 text-base font-bold text-white">{item.title}</h3>
        <p className="text-sm leading-relaxed text-white/55">{item.desc}</p>
      </div>
    </motion.div>
  );
}

/* ── Pricing card ── */
function PricingCard({ plan, index }: { plan: PlanItem; index: number }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 22, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 180, damping: 22, mass: 0.5 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    ry.set(((e.clientX - rect.left) / rect.width - 0.5) * 10);
    rx.set((0.5 - (e.clientY - rect.top) / rect.height) * 10);
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className={`group relative flex flex-col rounded-2xl p-8 transition-all duration-300 ${
        plan.highlight
          ? "border-2 border-teal-500/55 bg-gradient-to-br from-teal-500/[0.12] to-[#0a1f30] shadow-[0_0_60px_rgba(0,201,177,0.13)] glow-ring"
          : "border border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
      }`}
    >
      {(plan.badge || plan.highlight) && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-teal-500/50 bg-teal-500/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-300">
          {plan.badge ?? "Recomendado"}
        </span>
      )}

      <h3 className="text-xl font-black text-white">{plan.name}</h3>
      <p className="mt-1 text-sm text-white/50">{plan.desc}</p>

      <p className={`mt-5 text-2xl font-black ${plan.highlight ? "text-teal-400" : "text-white"}`}>
        {plan.price}
      </p>
      {plan.priceNote && (
        <p className="mt-1 text-xs text-white/40">{plan.priceNote}</p>
      )}

      <div className="my-6 border-t border-white/[0.07]" />

      <ul className="flex-1 space-y-2.5">
        {plan.features.map((f, j) => (
          <motion.li
            key={j}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: j * 0.04 + index * 0.06, duration: 0.25 }}
            className="flex items-start gap-2.5"
          >
            <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-teal-400" />
            <span className="text-sm text-white/75">{f}</span>
          </motion.li>
        ))}
      </ul>

      <Link
        href={plan.cta}
        className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all duration-300 ${
          plan.highlight
            ? "bg-gradient-to-r from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-500/25 hover:-translate-y-0.5 hover:shadow-teal-500/45"
            : "border border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:bg-white/10"
        }`}
      >
        {plan.ctaLabel ?? "Saiba mais"}
        <ArrowRight size={16} />
      </Link>
    </motion.div>
  );
}

export function ServicePageLayout({
  badge,
  icon: Icon,
  title,
  subtitle,
  description,
  features,
  plans,
}: ServicePageLayoutProps) {
  const whatsappUrl = `https://wa.me/5513991821557?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre " + badge + ".")}`;

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0d1b2a] pt-32 pb-20 md:pb-28">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-25" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-15%] h-[600px] w-[600px] rounded-full bg-teal-500/[0.07] blur-[110px] orb-float" />
          <div className="absolute right-[-5%] bottom-0 h-[400px] w-[400px] rounded-full bg-orange-500/[0.04] blur-[90px] orb-float orb-slow" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="text-center"
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
              <Icon size={13} />
              {badge}
            </span>

            <h1 className="mb-6 text-4xl font-black leading-[1.1] text-white md:text-5xl lg:text-6xl">
              {title}{" "}
              <span className="bg-gradient-to-r from-teal-400 via-teal-300 to-orange-400 bg-clip-text text-transparent">
                {subtitle}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              {description}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-8 py-4 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,201,177,0.55)]"
              >
                Ver planos e preços
                <ArrowRight size={18} />
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-4 text-base font-medium text-white/70 transition-all hover:border-teal-500/40 hover:bg-teal-500/5 hover:text-teal-400"
              >
                <MessageCircle size={18} />
                Fale conosco
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative bg-[#102238] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/[0.04] blur-[100px] orb-float orb-slow" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
            className="mb-14 text-center"
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
              O que oferecemos
            </span>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Tudo que você precisa,{" "}
              <span className="bg-gradient-to-r from-teal-400 to-teal-200 bg-clip-text text-transparent">
                em um só lugar
              </span>
            </h2>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item, i) => (
              <FeatureCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="relative bg-[#0d1b2a] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-teal-500/[0.05] blur-[100px] orb-float" />
          <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-orange-500/[0.04] blur-[80px] orb-float orb-delay" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
            className="mb-14 text-center"
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
              Opções de investimento
            </span>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Escolha o plano{" "}
              <span className="bg-gradient-to-r from-teal-400 to-orange-400 bg-clip-text text-transparent">
                ideal para você
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/50">
              Transparência total de preços. Sem letras miúdas, sem surpresas.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <PricingCard key={plan.name} plan={plan} index={i} />
            ))}
          </div>

          {/* Bottom note */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center"
          >
            <p className="text-sm text-white/45">
              Não encontrou o que precisa?{" "}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-400 underline underline-offset-2 hover:text-teal-300"
              >
                Fale com a gente
              </a>{" "}
              — fazemos propostas 100% personalizadas.
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}

