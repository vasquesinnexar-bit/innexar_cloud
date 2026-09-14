import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";

export type ServiceLandingContent = {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  benefits: string[];
  deliverables: { title: string; description: string }[];
  process: string[];
};

export function ServiceLandingPage({ content }: { content: ServiceLandingContent }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#050b16] pb-20 pt-36 md:pb-28 md:pt-44">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute left-[8%] top-0 h-96 w-96 rounded-full bg-cyan-400/[.1] blur-[120px]" />
        <div className="relative mx-auto max-w-[1180px] px-6 xl:px-8">
          <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/[.08] px-4 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-cyan-200">{content.eyebrow}</span>
          <h1 className="mt-7 max-w-4xl font-[family-name:var(--font-syne)] text-4xl font-bold leading-[1.06] tracking-[-.04em] text-white md:text-6xl">
            {content.title} <span className="bg-gradient-to-r from-cyan-200 via-teal-300 to-cyan-400 bg-clip-text text-transparent">{content.highlight}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">{content.description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/criar-site" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-teal-400 px-6 py-3.5 font-bold text-slate-950 transition hover:-translate-y-0.5">Iniciar meu projeto <ArrowRight size={17} /></Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-6 py-3.5 font-semibold text-white transition hover:border-cyan-300/40"><MessageCircle size={17} /> Conversar sobre meu projeto</Link>
          </div>
        </div>
      </section>

      <section className="bg-[#081321] py-20 md:py-28">
        <div className="mx-auto max-w-[1180px] px-6 xl:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {content.deliverables.map((item, index) => <article key={item.title} className="rounded-2xl border border-white/[.09] bg-white/[.035] p-7">
              <p className="font-mono text-xs text-cyan-300">0{index + 1}</p><h2 className="mt-5 text-xl font-bold text-white">{item.title}</h2><p className="mt-3 leading-relaxed text-slate-300/80">{item.description}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="bg-[#050b16] py-20 md:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-6 xl:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">O que orienta cada entrega</p><h2 className="mt-4 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-[-.03em] text-white md:text-4xl">Tecnologia pensada para o seu contexto.</h2></div>
          <ul className="grid gap-4 sm:grid-cols-2">{content.benefits.map((benefit) => <li key={benefit} className="flex gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-4 text-slate-200"><CheckCircle2 className="mt-0.5 shrink-0 text-teal-300" size={18} />{benefit}</li>)}</ul>
        </div>
      </section>

      <section className="border-y border-white/[.07] bg-[#081321] py-20">
        <div className="mx-auto max-w-[1180px] px-6 xl:px-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Como trabalhamos</p><div className="mt-8 grid gap-4 md:grid-cols-4">{content.process.map((step, index) => <div key={step} className="border-l border-cyan-300/30 pl-4"><span className="font-mono text-xs text-cyan-300">0{index + 1}</span><p className="mt-3 font-semibold text-white">{step}</p></div>)}</div></div>
      </section>
    </>
  );
}
