"use client";

import { motion } from "framer-motion";

type LogoItem = {
  name: string;
  color: string;
  glow: string;
};

const aiLogos: LogoItem[] = [
  { name: "OpenAI",        color: "#10a37f", glow: "rgba(16,163,127,0.35)" },
  { name: "Anthropic",     color: "#D08050", glow: "rgba(208,128,80,0.35)" },
  { name: "Google Gemini", color: "#4285F4", glow: "rgba(66,133,244,0.35)" },
  { name: "Meta Llama",    color: "#1877F2", glow: "rgba(24,119,242,0.35)" },
  { name: "Microsoft",     color: "#00A4EF", glow: "rgba(0,164,239,0.35)"  },
  { name: "AWS Bedrock",   color: "#FF9900", glow: "rgba(255,153,0,0.35)"  },
  { name: "Mistral AI",    color: "#FF7000", glow: "rgba(255,112,0,0.35)"  },
  { name: "Groq",          color: "#F55036", glow: "rgba(245,80,54,0.35)"  },
  { name: "Perplexity",    color: "#20B8CD", glow: "rgba(32,184,205,0.35)" },
  { name: "DeepSeek",      color: "#4D90FE", glow: "rgba(77,144,254,0.35)" },
  { name: "Hugging Face",  color: "#FFD21E", glow: "rgba(255,210,30,0.35)" },
  { name: "xAI Grok",     color: "#A78BFA", glow: "rgba(167,139,250,0.35)"},
];

const techLogos: LogoItem[] = [
  { name: "Next.js",        color: "#e2e8f0", glow: "rgba(226,232,240,0.30)" },
  { name: "React",          color: "#61DAFB", glow: "rgba(97,218,251,0.35)"  },
  { name: "TypeScript",     color: "#3178C6", glow: "rgba(49,120,198,0.35)"  },
  { name: "Node.js",        color: "#68A063", glow: "rgba(104,160,99,0.35)"  },
  { name: "Docker",         color: "#2496ED", glow: "rgba(36,150,237,0.35)"  },
  { name: "Kubernetes",     color: "#326CE5", glow: "rgba(50,108,229,0.35)"  },
  { name: "AWS",            color: "#FF9900", glow: "rgba(255,153,0,0.35)"   },
  { name: "Vercel",         color: "#e2e8f0", glow: "rgba(226,232,240,0.30)" },
  { name: "Mercado Pago",   color: "#009EE3", glow: "rgba(0,158,227,0.35)"   },
  { name: "Tailwind CSS",   color: "#06B6D4", glow: "rgba(6,182,212,0.35)"   },
  { name: "PostgreSQL",     color: "#4A90D9", glow: "rgba(74,144,217,0.35)"  },
  { name: "Redis",          color: "#DC382D", glow: "rgba(220,56,45,0.35)"   },
  { name: "Supabase",       color: "#3ECF8E", glow: "rgba(62,207,142,0.35)"  },
  { name: "GitHub Actions", color: "#E6EDF3", glow: "rgba(230,237,243,0.30)" },
];

function LogoChip({ logo }: { logo: LogoItem }) {
  return (
    <div
      className="group mx-3 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/[0.09] cursor-default select-none"
    >
      <div
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{
          background: logo.color,
          boxShadow: `0 0 8px ${logo.glow}`,
        }}
      />
      <span
        className="whitespace-nowrap text-sm font-semibold tracking-wide transition-opacity duration-300"
        style={{ color: logo.color }}
      >
        {logo.name}
      </span>
    </div>
  );
}

function MarqueeRow({
  logos,
  direction = "left",
  speed = 50,
}: {
  logos: LogoItem[];
  direction?: "left" | "right";
  speed?: number;
}) {
  const doubled = [...logos, ...logos];
  return (
    <div className="relative overflow-hidden py-1.5">
      {/* Left fade mask */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-[#0d1b2a] to-transparent" />
      {/* Right fade mask */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-[#0d1b2a] to-transparent" />

      <div
        className="flex hover:[animation-play-state:paused]"
        style={{
          animation: `${direction === "left" ? "marquee" : "marqueeReverse"} ${speed}s linear infinite`,
          width: "max-content",
        }}
      >
        {doubled.map((logo, i) => (
          <LogoChip key={`${logo.name}-${i}`} logo={logo} />
        ))}
      </div>
    </div>
  );
}

export function TechLogos() {
  return (
    <section className="relative overflow-hidden bg-[#0d1b2a] py-20 md:py-28">
      {/* Subtle dot grid */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      {/* Orb glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[350px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/[0.04] blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
            Stack &amp; Ecossistema
          </span>

          <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white md:text-4xl">
            IA aplicada onde realmente gera{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-cyan-200 bg-clip-text text-transparent">
              resultado para sua empresa
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-base text-white/50">
            Atendimento, automação, análise de dados e integrações: escolhemos a tecnologia certa para cada problema, sem prender sua empresa a um único fornecedor.
          </p>
        </motion.div>

        {/* AI logos row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <p className="mb-3 pl-2 text-[10px] font-bold uppercase tracking-[3px] text-white/25">
            Inteligência Artificial
          </p>
          <MarqueeRow logos={aiLogos} direction="left" speed={55} />
        </motion.div>

        {/* Tech stack logos row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-5"
        >
          <p className="mb-3 pl-2 text-[10px] font-bold uppercase tracking-[3px] text-white/25">
            Stack de Desenvolvimento
          </p>
          <MarqueeRow logos={techLogos} direction="right" speed={65} />
        </motion.div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-10 text-center text-xs text-white/30"
        >
          E muito mais — escolhemos a melhor ferramenta para cada necessidade do seu projeto.
        </motion.p>
      </div>
    </section>
  );
}
