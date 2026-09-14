"use client";

import { motion, useMotionValue, useSpring, animate } from "framer-motion";
import { Users, TrendingUp, Award, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const stats = [
  {
    icon: Users,
    number: 500,
    suffix: "+",
    label: "Clientes Satisfeitos",
    description: "Empresas que cresceram com a gente",
    color: "from-teal-400 to-teal-200",
  },
  {
    icon: TrendingUp,
    number: 10,
    suffix: "M+",
    label: "Visitantes/Mês",
    description: "Tráfego total gerado para clientes",
    color: "from-orange-400 to-orange-200",
  },
  {
    icon: Award,
    number: 150,
    suffix: "+",
    label: "Projetos Entregues",
    description: "Sites, apps e soluções completas",
    color: "from-teal-400 to-teal-200",
  },
  {
    icon: Zap,
    number: 98,
    suffix: "%",
    label: "Taxa de Satisfação",
    description: "Clientes que recomendam nossos serviços",
    color: "from-violet-400 to-violet-200",
  },
];

function AnimatedCounter({
  target,
  suffix,
  color,
  started,
}: {
  target: number;
  suffix: string;
  color: string;
  started: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(false);

  useEffect(() => {
    if (!started || prevRef.current) return;
    prevRef.current = true;

    const controls = animate(0, target, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        setDisplay(Math.round(v));
      },
    });

    return () => controls.stop();
  }, [started, target]);

  return (
    <span className={`text-4xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
      {display}{suffix}
    </span>
  );
}

function StatCard({
  stat,
  index,
}: {
  stat: (typeof stats)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 22 });
  const sry = useSpring(ry, { stiffness: 180, damping: 22 });
  const Icon = stat.icon;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ry.set(((e.clientX - rect.left) / rect.width - 0.5) * 12);
    rx.set((0.5 - (e.clientY - rect.top) / rect.height) * 12);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000, transformStyle: "preserve-3d" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm transition-all duration-300 hover:border-teal-500/25 hover:-translate-y-1 cursor-default"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/[0.05] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative z-10">
        <div className="mb-5 flex justify-center">
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-3">
            <Icon className="h-6 w-6 text-teal-400" />
          </div>
        </div>

        <AnimatedCounter
          target={stat.number}
          suffix={stat.suffix}
          color={stat.color}
          started={isInView}
        />

        <p className="mt-3 text-base font-bold text-white">{stat.label}</p>
        <p className="mt-1 text-sm text-white/50">{stat.description}</p>
      </div>
    </motion.div>
  );
}

export function CompanyStats() {
  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-teal-500/[0.06] blur-[120px] orb-float" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

