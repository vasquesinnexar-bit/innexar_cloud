"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef } from "react";
import {
  Zap,
  Users,
  HeartHandshake,
  TrendingUp,
  Shield,
  Clock,
} from "lucide-react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";

const advantages = [
  {
    icon: Zap,
    title: "Tecnologia de Ponta",
    description:
      "Utilizamos as melhores ferramentas e frameworks do mercado para garantir qualidade e performance excepcionais.",
  },
  {
    icon: Users,
    title: "Equipe Experiente",
    description:
      "Profissionais com anos de experiência em desenvolvimento, design e marketing digital.",
  },
  {
    icon: HeartHandshake,
    title: "Parceria com Propósito",
    description:
      "Você não é apenas um cliente. Somos parceiros no crescimento do seu negócio.",
  },
  {
    icon: TrendingUp,
    title: "Resultados Comprovados",
    description:
      "Nossos clientes aumentam em média 300% nas conversões e 5x no tráfego orgânico com nossas estratégias.",
  },
  {
    icon: Shield,
    title: "Suporte 24h",
    description:
      "Suporte técnico disponível para resolver qualquer dúvida ou problema rapidamente.",
  },
  {
    icon: Clock,
    title: "Entrega Ágil",
    description:
      "Metodologias ágeis garantem projetos entregues no prazo com qualidade garantida.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

function AdvantageCard({
  title,
  description,
  icon: Icon,
  index,
}: {
  title: string;
  description: string;
  icon: typeof Zap;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 180, damping: 20, mass: 0.5 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 180, damping: 20, mass: 0.5 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 10);
    rotateX.set((0.5 - py) * 10);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      key={index}
      variants={itemVariants}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
      }}
      className="group relative rounded-2xl border border-white/20 bg-white/[0.08] p-8 shadow-[0_20px_50px_rgba(8,15,30,0.38)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/45"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-teal-300/8 to-transparent opacity-80" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-teal-300/12 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative z-10" style={{ transform: "translateZ(30px)" }}>
        <div className="mb-4 inline-flex rounded-lg border border-teal-300/35 bg-teal-400/12 p-3">
          <Icon className="h-6 w-6 text-teal-200" />
        </div>

        <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/80">{description}</p>
      </div>
    </motion.div>
  );
}

export function Advantages() {
  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-1/3 h-96 w-96 rounded-full bg-teal-500/[0.05] blur-[120px] orb-float" />
        <div className="absolute right-0 top-2/3 h-96 w-96 rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            Diferenciais
          </span>
          <AnimatedTitle as="h2" className="mb-6 text-3xl font-black leading-tight text-white md:text-4xl lg:text-5xl">
            Por que escolher a{" "}
            <span className="bg-gradient-to-r from-teal-400 to-teal-200 bg-clip-text text-transparent">
              Innexar
            </span>
          </AnimatedTitle>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Entregamos design premium, tecnologia confiável e execução ágil para
            seu negócio parecer grande, transmitir credibilidade e converter mais.
          </p>
        </motion.div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute left-1/2 top-16 z-20 h-56 w-56 -translate-x-1/2 rounded-full border border-teal-200/30 bg-white/12 shadow-[0_0_120px_rgba(45,212,191,0.24)] backdrop-blur-2xl mix-blend-screen"
        />

        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 0.85, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="pointer-events-none absolute left-[42%] top-28 z-20 h-24 w-24 -translate-x-1/2 rounded-full border border-white/25 bg-teal-200/12 shadow-[0_0_70px_rgba(125,211,252,0.2)] backdrop-blur-xl"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative z-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {advantages.map((advantage, index) => {
            return (
              <AdvantageCard
                key={index}
                index={index}
                icon={advantage.icon}
                title={advantage.title}
                description={advantage.description}
              />
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
