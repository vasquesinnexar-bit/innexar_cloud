"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Zap,
  Star,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

/* ── Code lines to display in the "editor" ── */
const codeLines: { content: string; color: string }[] = [
  { content: "export default function SeuSite() {",    color: "text-violet-400" },
  { content: "  return (",                             color: "text-white/60"   },
  { content: "    <section className=\"hero\">",       color: "text-sky-400"    },
  { content: "      <Badge>",                          color: "text-orange-400" },
  { content: "        🚀 Powered by Innexar",          color: "text-emerald-300"},
  { content: "      </Badge>",                         color: "text-orange-400" },
  { content: "      <h1 className=\"title\">",         color: "text-sky-400"    },
  { content: "        Seu negócio no topo do Google",  color: "text-emerald-300"},
  { content: "      </h1>",                            color: "text-sky-400"    },
  { content: "      <p className=\"subtitle\">",       color: "text-sky-400"    },
  { content: "        Sites, Apps e IA — tudo aqui",  color: "text-emerald-300"},
  { content: "      </p>",                             color: "text-sky-400"    },
  { content: "      <Button href=\"/contact\">",       color: "text-orange-400" },
  { content: "        Começar agora →",                color: "text-teal-300"   },
  { content: "      </Button>",                        color: "text-orange-400" },
  { content: "    </section>",                         color: "text-sky-400"    },
  { content: "  )",                                    color: "text-white/60"   },
  { content: "}",                                      color: "text-violet-400" },
];

/* ── Mini line-number gutter ── */
function LineNumbers({ count }: { count: number }) {
  return (
    <div className="select-none pr-4 text-right font-mono text-xs leading-6 text-white/20">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

/* ── Static floating stat chip ── */
function StatChip({
  icon: Icon,
  label,
  value,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay }}
      className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 backdrop-blur-md"
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}18` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
        <p className="text-base font-black text-white">{value}</p>
      </div>
    </motion.div>
  );
}

/* ── Browser preview panel ── */
function BrowserPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0a1421] shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.1] bg-white/[0.06] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
        <div className="ml-3 flex h-6 flex-1 items-center rounded-full bg-white/[0.1] px-3">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="text-[11px] text-white/55"
          >
            suaempresa.com.br
          </motion.span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2 }}
          className="ml-2 flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5"
        >
          <CheckCircle2 size={10} className="text-emerald-400" />
          <span className="text-[9px] font-semibold text-emerald-400">Live</span>
        </motion.div>
      </div>

      {/* Page content */}
      <div className="p-5 space-y-5">
        {/* Navbar skeleton → real */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="h-5 w-20 rounded-md bg-teal-500/30" />
          <div className="flex gap-2">
            {["Serviços", "Planos", "Contato"].map((t, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.12 }}
                className="rounded px-2 py-1 text-[9px] font-medium text-white/55 bg-white/5"
              >
                {t}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Hero content */}
        <div className="rounded-xl bg-gradient-to-br from-teal-900/40 to-[#0a1425] p-5">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-teal-400">Agência Digital</span>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            <div className="mb-1 h-4 w-52 rounded bg-white/80" />
            <div className="mb-3 h-4 w-40 rounded bg-gradient-to-r from-teal-400/70 to-teal-300/70" />
          </motion.div>

          {/* Subtext */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.1 }}
            className="space-y-1 mb-4"
          >
            <div className="h-2 w-48 rounded bg-white/25" />
            <div className="h-2 w-36 rounded bg-white/20" />
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.3, duration: 0.4 }}
            className="flex gap-2"
          >
            <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-4 py-1.5 text-[9px] font-bold text-white shadow-lg shadow-teal-500/30">
              Ver planos
            </div>
            <div className="flex items-center gap-1 rounded-full border border-white/20 px-4 py-1.5 text-[9px] font-medium text-white/60">
              Falar conosco
            </div>
          </motion.div>
        </div>

        {/* Analytics bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
        >
          {[
            { label: "Visitas", value: "12.8k", color: "text-white" },
            { label: "Conversões", value: "+348%", color: "text-teal-400" },
            { label: "SEO Score", value: "98/100", color: "text-orange-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[8px] uppercase tracking-wider text-white/40">{label}</p>
              <p className={`text-xs font-black ${color}`}>{value}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ── Main export ── */
export function LiveBuild() {
  return (
    <section className="relative overflow-hidden bg-[#0c1929] py-24 md:py-32">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-teal-500/[0.06] blur-[100px] orb-float" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
            Processo Criativo
          </span>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Seu site sendo{" "}
            <span className="bg-gradient-to-r from-teal-400 to-orange-400 bg-clip-text text-transparent">
              construído ao vivo
            </span>
            , em tempo real
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/50">
            Do primeiro commit ao site no ar — em dias, não meses. Com IA, agilidade e qualidade de agência premium.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 items-start">
          {/* LEFT — Code editor */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            {/* Editor window */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0d1117] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
              {/* Editor title bar */}
              <div className="flex items-center gap-2 border-b border-white/[0.1] bg-[#161b22] px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs font-medium text-white/40">SeuSite.tsx</span>
                <div className="ml-auto flex items-center gap-1.5 rounded-md bg-teal-500/15 px-2 py-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-teal-400">AI generating…</span>
                </div>
              </div>

              {/* Code body */}
              <div className="overflow-x-auto p-4 font-mono text-xs leading-6">
                <div className="flex">
                  <LineNumbers count={codeLines.length} />
                  <div className="flex-1 min-w-0">
                    {codeLines.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.065, duration: 0.3 }}
                        className={`whitespace-pre leading-6 ${line.color}`}
                      >
                        {line.content}
                      </motion.div>
                    ))}
                    {/* Blinking cursor */}
                    <motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: codeLines.length * 0.065 + 0.2 }}
                      className="inline-block w-2 h-4 bg-teal-400 cursor-blink align-middle"
                    />
                  </div>
                </div>
              </div>

              {/* Editor footer */}
              <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#161b22] px-4 py-2">
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  <span>TypeScript</span>
                  <span>·</span>
                  <span>UTF-8</span>
                  <span>·</span>
                  <span className="text-teal-400">✓ No errors</span>
                </div>
                <div className="text-[10px] text-white/30">Ln {codeLines.length}, Col 1</div>
              </div>
            </div>

            {/* Steps below editor */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { step: "01", label: "Design & Prototipagem",  color: "#10a37f" },
                { step: "02", label: "Desenvolvimento com IA", color: "#D08050" },
                { step: "03", label: "Deploy & SEO",            color: "#4285F4" },
              ].map(({ step, label, color }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"
                >
                  <div className="text-xs font-black mb-1" style={{ color }}>{step}</div>
                  <div className="text-[10px] text-white/55 leading-snug">{label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — Browser preview */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <BrowserPreview />

            {/* Floating badge: "Entregue em 7 dias" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.8, duration: 0.4 }}
              className="absolute -left-6 -top-5 z-20 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.1] px-4 py-2.5 shadow-xl backdrop-blur-xl hidden lg:flex"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20">
                <Clock size={14} className="text-teal-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/40">Entrega</p>
                <p className="text-sm font-black text-white">7 dias</p>
              </div>
            </motion.div>

            {/* Floating badge: "Performance A+" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 2.0, duration: 0.4 }}
              className="absolute -right-6 -bottom-5 z-20 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.1] px-4 py-2.5 shadow-xl backdrop-blur-xl hidden lg:flex"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
                <Zap size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/40">Performance</p>
                <p className="text-sm font-black text-orange-400">100 / A+</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom stat chips */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatChip icon={Clock}        label="Prazo médio de entrega" value="7 dias úteis"       color="#10a37f"  delay={0.2} />
          <StatChip icon={Star}         label="Satisfação dos clientes" value="4.9 / 5 estrelas"  color="#FFD21E"  delay={0.3} />
          <StatChip icon={Zap}          label="Aumento médio tráfego"   value="+400% orgânico"    color="#FF9900"  delay={0.4} />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-14 text-center"
        >
          <Link
            href="/planos"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-10 py-4 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,201,177,0.55)]"
          >
            Quero meu site assim
            <ArrowRight size={18} />
          </Link>
          <p className="mt-3 text-xs text-white/35">Sem contrato de longo prazo · Começa em dias</p>
        </motion.div>
      </div>
    </section>
  );
}
