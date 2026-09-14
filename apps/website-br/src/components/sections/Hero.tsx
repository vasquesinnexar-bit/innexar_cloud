import Link from "next/link";
import { ArrowUpRight, Check, MessageCircle, Sparkles } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";

export function Hero() {
  const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Olá! Gostaria de agendar uma call com a Innexar.")}`;

  return (
    <section className="relative isolate overflow-hidden bg-[#050b16]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 18%, rgba(34, 211, 238, .18), transparent 30%), radial-gradient(circle at 80% 34%, rgba(20, 184, 166, .16), transparent 27%)",
        }}
      />
      <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto grid min-h-[min(800px,92vh)] max-w-[1440px] items-center gap-14 px-6 pb-20 pt-36 xl:px-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:pt-32">
        <div>
        <span className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-200">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          Tecnologia que gera movimento
        </span>

        <h1 className="max-w-4xl font-[family-name:var(--font-syne)] text-4xl font-bold leading-[1.05] tracking-[-.04em] text-white md:text-6xl lg:text-7xl">
          Tecnologia que transforma negócios em operações mais <span className="bg-gradient-to-r from-cyan-200 via-teal-300 to-cyan-400 bg-clip-text text-transparent">inteligentes.</span>
        </h1>

        <p className="mt-7 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
          Criamos sites, sistemas, automações e soluções com IA para reduzir trabalho manual, conectar processos e acelerar o crescimento da sua empresa.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/criar-site"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-teal-400 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_10px_30px_rgba(0,201,177,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(0,201,177,0.4)]"
          >
            Tirar meu projeto do papel
            <ArrowUpRight size={17} />
          </Link>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-white/90 transition hover:border-cyan-300/40 hover:bg-white/[0.08] hover:text-cyan-100"
          >
            <MessageCircle size={16} />
            Conversar sobre meu projeto
          </a>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300">
          {["Sites e plataformas", "Apps sob medida", "IA aplicada ao negócio"].map((item) => (
            <span key={item} className="inline-flex items-center gap-2"><Check size={15} className="text-teal-300" />{item}</span>
          ))}
        </div>
        </div>

        <div className="relative mx-auto w-full max-w-[540px] lg:mx-0 lg:justify-self-end">
          <div aria-hidden className="absolute -inset-10 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[#0a1728]/85 p-3 shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="flex items-center justify-between rounded-2xl border border-white/[.08] bg-white/[.035] px-4 py-3">
              <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400"/><span className="h-2 w-2 rounded-full bg-amber-300"/><span className="h-2 w-2 rounded-full bg-teal-300"/></div>
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">innexar.systems</span>
              <Sparkles size={15} className="text-cyan-300" />
            </div>
            <div className="mt-3 grid gap-3 rounded-2xl bg-gradient-to-br from-[#0d2035] to-[#07111e] p-5 sm:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-white/[.08] bg-[#06111e] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-300">Crescimento conectado</p>
                <p className="mt-4 font-[family-name:var(--font-syne)] text-2xl font-bold leading-tight text-white">Ideia, produto e resultado em uma mesma direção.</p>
                <div className="mt-7 flex items-end gap-2"><span className="h-10 w-7 rounded-t bg-cyan-400/35"/><span className="h-16 w-7 rounded-t bg-cyan-400/55"/><span className="h-24 w-7 rounded-t bg-gradient-to-t from-teal-500 to-cyan-300"/><span className="h-20 w-7 rounded-t bg-cyan-300/70"/></div>
              </div>
              <div className="space-y-3">
                {["Estratégia", "Design", "Engenharia"].map((item, index) => <div key={item} className="rounded-xl border border-white/[.08] bg-white/[.035] p-3"><span className="font-mono text-[10px] text-cyan-300/80">0{index + 1}</span><p className="mt-1 text-sm font-semibold text-white">{item}</p></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
