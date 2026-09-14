"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";

const testimonials = [
  {
    quote: "A Innexar transformou completamente nossa presença digital. O site ficou profissional, rápido e nossas vendas aumentaram 350% em 6 meses.",
    author: "Carlos Mendes",
    role: "Dono de E-commerce",
    company: "Loja Premium",
    stars: 5,
    color: "from-teal-400 to-teal-600",
  },
  {
    quote: "Trabalhar com a equipe foi excelente. Entregaram no prazo, o design é moderno e o suporte técnico é responsivo. Recomendo!",
    author: "Juliana Costa",
    role: "Gestora de Marketing",
    company: "Agência Digital",
    stars: 5,
    color: "from-orange-400 to-orange-600",
  },
  {
    quote: "O site por assinatura foi perfeito para nosso negócio. Sem investimento inicial e com tudo incluído: hosting, domínio e suporte.",
    author: "Roberto Silva",
    role: "Empreendedor",
    company: "Consultoria Empresarial",
    stars: 5,
    color: "from-teal-400 to-teal-600",
  },
  {
    quote: "Desenvolvemos um app mobile que ficou top. A Innexar entendeu perfeitamente o que precisávamos. Já estamos em mais de 50 mil downloads!",
    author: "Ana Paula",
    role: "Diretora de Produto",
    company: "Startup Tech",
    stars: 5,
    color: "from-violet-400 to-violet-600",
  },
  {
    quote: "SEO e tráfego aumentou significativamente. Passou de 100 visitantes/mês para mais de 5 mil. Investimento que realmente compensa.",
    author: "Marcelo Oliveira",
    role: "Proprietário",
    company: "Corretor Imobiliário",
    stars: 5,
    color: "from-teal-400 to-teal-600",
  },
  {
    quote: "O atendimento é humanizado, profissional e respeitoso. Eles realmente se importam com o sucesso do cliente. Excelente parceria!",
    author: "Fernanda Lima",
    role: "CEO",
    company: "Consultoria",
    stars: 5,
    color: "from-orange-400 to-orange-600",
  },
  {
    quote: "A infraestrutura em cloud que montaram para nós é impecável. Zero downtime em 8 meses, performance excepcional. 10/10!",
    author: "Thiago Ramos",
    role: "CTO",
    company: "Fintech",
    stars: 5,
    color: "from-sky-400 to-sky-600",
  },
  {
    quote: "Equipe incrível! Do briefing ao lançamento foram só 12 dias. Superou todas as expectativas em design e velocidade de carregamento.",
    author: "Beatriz Santos",
    role: "Fundadora",
    company: "Beauty Boutique",
    stars: 5,
    color: "from-pink-400 to-pink-600",
  },
];

function TestimonialCard({ t }: { t: (typeof testimonials)[number] }) {
  return (
    <div className="mx-3 w-80 flex-shrink-0 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-7 backdrop-blur-sm transition-all duration-300 hover:border-teal-500/25 hover:bg-white/[0.07]">
      {/* Stars */}
      <div className="mb-4 flex gap-0.5">
        {Array.from({ length: t.stars }).map((_, i) => (
          <Star key={i} size={13} className="fill-yellow-400 text-yellow-400" />
        ))}
      </div>

      {/* Quote icon */}
      <Quote size={28} className="mb-3 text-teal-500/40" />

      {/* Text */}
      <p className="mb-6 text-sm leading-relaxed text-white/75 italic">
        &ldquo;{t.quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 border-t border-white/[0.08] pt-4">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-black text-white ${t.color}`}
        >
          {t.author.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-bold text-white">{t.author}</p>
          <p className="text-xs text-white/45">{t.role} · {t.company}</p>
        </div>
      </div>
    </div>
  );
}

function MarqueeRow({
  items,
  direction = "left",
  speed = 60,
}: {
  items: (typeof testimonials);
  direction?: "left" | "right";
  speed?: number;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#102238] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#102238] to-transparent" />
      <div
        className="flex hover:[animation-play-state:paused]"
        style={{
          animation: `${direction === "left" ? "marquee" : "marqueeReverse"} ${speed}s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={`${t.author}-${i}`} t={t} />
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  const half = Math.ceil(testimonials.length / 2);
  const row1 = testimonials.slice(0, half);
  const row2 = testimonials.slice(half);

  return (
    <section className="relative bg-[#102238] py-24 md:py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/[0.04] blur-[120px] orb-float" />
        <div className="absolute left-0 bottom-0 h-[400px] w-[400px] rounded-full bg-orange-500/[0.03] blur-[100px] orb-float orb-slow" />
      </div>

      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
            Depoimentos
          </span>
          <AnimatedTitle as="h2" className="text-3xl font-bold text-white md:text-4xl">
            Histórias reais de{" "}
            <span className="bg-gradient-to-r from-teal-400 to-orange-400 bg-clip-text text-transparent">
              sucesso
            </span>
          </AnimatedTitle>
          <p className="mt-4 text-base text-white/50">
            Veja o que nossos clientes conquistaram com nossas soluções
          </p>
        </motion.div>
      </div>

      {/* Marquee rows — full bleed */}
      <div className="space-y-4">
        <MarqueeRow items={row1} direction="left"  speed={55} />
        <MarqueeRow items={row2} direction="right" speed={65} />
      </div>

      {/* Rating summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-12 flex items-center justify-center gap-3"
      >
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={18} className="fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <span className="text-lg font-black text-white">4.9</span>
        <span className="text-sm text-white/45">de 5 — baseado em 200+ avaliações</span>
      </motion.div>
    </section>
  );
}

