import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";
const title = "Desenvolvimento de Sistemas e IA em São Paulo";
const description = "Desenvolvimento de sistemas, sites, SaaS, automações e inteligência artificial para empresas em São Paulo. Atendimento remoto em todo o Brasil.";

export const metadata: Metadata = { title, description, alternates: { canonical: "/atendimento/sao-paulo" }, openGraph: { title: `${title} | Innexar`, description, url: `${SITE_URL}/atendimento/sao-paulo` }, twitter: { card: "summary_large_image", title: `${title} | Innexar`, description, images: [`${SITE_URL}/opengraph-image`] } };

const solutions = ["Desenvolvimento de sistemas personalizados", "Software e plataformas SaaS", "Sites profissionais e e-commerce", "Automação de processos e atendimento", "Inteligência artificial para empresas", "Integração de sistemas e APIs"];
const questions = [["A Innexar atende empresas em São Paulo presencialmente?", "O atendimento pode acontecer remotamente, com etapas de descoberta, demonstrações e acompanhamento organizadas para o contexto do seu projeto."], ["Que tipo de empresa pode contratar?", "Atendemos empresas que precisam criar ou evoluir presença digital, sistemas, automações e produtos de tecnologia."], ["O projeto começa por onde?", "Começamos entendendo o problema, os processos envolvidos e o resultado esperado para definir o caminho mais adequado."]];

export default function SaoPauloPage() {
  const url = `${SITE_URL}/atendimento/sao-paulo`;
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema([{ name: "Início", url: SITE_URL }, { name: "Atendimento", url: `${SITE_URL}/atendimento/sao-paulo` }, { name: "São Paulo", url }]), { "@context": "https://schema.org", "@type": "Service", name: title, description, areaServed: { "@type": "City", name: "São Paulo" }, provider: { "@type": "Organization", name: "Innexar", url: SITE_URL } }]) }} />
    <section className="relative isolate overflow-hidden bg-[#050b16] pb-20 pt-36 md:pt-44"><div aria-hidden className="tech-grid pointer-events-none absolute inset-0" /><div className="relative mx-auto max-w-[1180px] px-6 xl:px-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Atendimento em São Paulo</p><h1 className="mt-6 max-w-4xl font-[family-name:var(--font-syne)] text-4xl font-bold leading-[1.06] tracking-[-.04em] text-white md:text-6xl">Tecnologia, sistemas e inteligência artificial para empresas em <span className="text-cyan-300">São Paulo.</span></h1><p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">A Innexar desenvolve sites, plataformas, automações e soluções com IA para empresas que querem organizar processos, atender melhor e crescer com tecnologia.</p><Link href="/contact" className="mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-teal-400 px-6 py-3.5 font-bold text-slate-950">Conversar sobre meu projeto <ArrowRight size={17}/></Link></div></section>
    <section className="bg-[#081321] py-20"><div className="mx-auto max-w-[1180px] px-6 xl:px-8"><h2 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-white">Soluções para empresas que operam em São Paulo e em todo o Brasil</h2><div className="mt-10 grid gap-4 md:grid-cols-2">{solutions.map((solution) => <div key={solution} className="flex gap-3 rounded-xl border border-white/[.08] bg-white/[.035] p-5 text-slate-200"><CheckCircle2 className="shrink-0 text-teal-300" size={19}/>{solution}</div>)}</div></div></section>
    <section className="bg-[#050b16] py-20"><div className="mx-auto max-w-[900px] px-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Perguntas frequentes</p><div className="mt-8 space-y-4">{questions.map(([question, answer]) => <article key={question} className="rounded-2xl border border-white/[.08] bg-white/[.03] p-6"><h2 className="text-lg font-bold text-white">{question}</h2><p className="mt-3 leading-relaxed text-slate-300">{answer}</p></article>)}</div></div></section>
  </>;
}
