"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import Link from "next/link";
import {
  Globe,
  Smartphone,
  BarChart3,
  ArrowRight,
  CreditCard,
  Instagram,
  Server,
} from "lucide-react";
import { useRef } from "react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";

const services = [
  {
    icon: Globe,
    title: "Sites Profissionais",
    desc: "Landing pages e sites corporativos modernos, rápidos e otimizados para o Google.",
    href: "/criacao-de-sites",
    badge: "Mais popular",
    featured: false,
  },
  {
    icon: CreditCard,
    title: "Site por Assinatura",
    desc: "Pague mensalmente, sem investimento inicial. Design, hospedagem e manutenção inclusos.",
    href: "/planos",
    badge: "Melhor custo-benefício",
    featured: true,
  },
  {
    icon: Smartphone,
    title: "Aplicativos Web e Mobile",
    desc: "Apps completos sob medida — do protótipo ao deploy em produção.",
    href: "/desenvolvimento-de-sistemas",
    badge: null,
    featured: false,
  },
  {
    icon: BarChart3,
    title: "IA & Automação",
    desc: "IA aplicada, automações e integrações para processos mais eficientes.",
    href: "/inteligencia-artificial",
    badge: null,
    featured: false,
  },
  {
    icon: Instagram,
    title: "Gestão de Redes Sociais",
    desc: "Conteúdo estratégico, calendário editorial e gerenciamento profissional das suas redes.",
    href: "/planos",
    badge: null,
    featured: false,
  },
  {
    icon: Server,
    title: "Infraestrutura & Cloud",
    desc: "AWS, GCP, Azure, Docker, Kubernetes e DevOps profissional para escalar seu negócio.",
    href: "/integracao-de-sistemas",
    badge: null,
    featured: false,
  },
];

export function Services() {
  return (
    <section className="relative bg-[#102238] py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/[0.04] blur-[100px] orb-float orb-slow" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-80px" }}
          className="mb-16 text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
            Nossos Serviços
          </span>
          <AnimatedTitle as="h2" className="mb-5 text-4xl font-bold text-white md:text-5xl">
            Tudo que seu negócio
            <br />
            precisa para crescer online
          </AnimatedTitle>
          <p className="mx-auto max-w-2xl text-lg text-white/45">
            Da criação ao crescimento — soluções completas de tecnologia para empresas que querem resultados reais.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
          }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((s) => (
            <ServiceCard
              key={s.href + s.title}
              service={s}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ServiceCard({
  service,
}: {
  service: (typeof services)[number];
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 180, damping: 20, mass: 0.6 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 180, damping: 20, mass: 0.6 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 9);
    rotateX.set((0.5 - py) * 9);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={cardRef}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
      }}
    >
      <Link
        href={service.href}
        className={`group relative block rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
          service.featured
            ? "border-teal-300/45 bg-white/[0.10] shadow-[0_0_55px_rgba(0,201,177,0.14)] backdrop-blur-xl hover:border-teal-300/70 hover:shadow-[0_0_90px_rgba(0,201,177,0.22)]"
            : "border-white/[0.16] bg-white/[0.08] backdrop-blur-xl hover:border-teal-300/35 hover:bg-white/[0.11]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-teal-300/8 to-transparent" />
        {service.featured && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/[0.08] to-transparent" />
        )}
        <div className="relative mb-4 flex items-center justify-between" style={{ transform: "translateZ(20px)" }}>
          <div className={`rounded-xl p-2.5 ${service.featured ? "bg-teal-500/25" : "bg-white/[0.12]"}`}>
            <service.icon className={`h-7 w-7 ${service.featured ? "text-teal-200" : "text-teal-300"}`} />
          </div>
          {service.badge && (
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
              service.featured
                ? "border border-teal-300/45 bg-teal-500/35 text-teal-100"
                : "bg-teal-500/20 text-teal-300"
            }`}>
              {service.badge}
            </span>
          )}
        </div>
        <h3 className="relative mb-2 text-lg font-semibold text-white" style={{ transform: "translateZ(26px)" }}>{service.title}</h3>
        <p className="relative mb-4 text-sm text-white/75" style={{ transform: "translateZ(22px)" }}>{service.desc}</p>
        <span className="relative inline-flex items-center gap-2 text-sm font-medium text-teal-300 transition-all group-hover:gap-3" style={{ transform: "translateZ(18px)" }}>
          Saiba mais
          <ArrowRight size={14} />
        </span>
      </Link>
    </motion.div>
  );
}
