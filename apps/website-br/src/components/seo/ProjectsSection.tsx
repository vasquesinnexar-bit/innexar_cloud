import Link from "next/link";
import { ArrowRight, Blocks, BrainCircuit, HeartPulse } from "lucide-react";

const projects = [
  { name: "Heavy Clean", category: "Operação e atendimento", icon: Blocks, description: "Plataforma para apoiar a operação de uma empresa de serviços, com fluxos de atendimento e ferramentas para o time." },
  { name: "Core Pilates", category: "Gestão e agenda", icon: HeartPulse, description: "Solução digital voltada à gestão de agenda e rotinas de uma operação de bem-estar." },
  { name: "ProspectorAI", category: "Prospecção com IA", icon: BrainCircuit, description: "Produto de prospecção que organiza pesquisa de negócios e apoia a identificação de oportunidades." },
];

export function ProjectsSection({ compact = false }: { compact?: boolean }) {
  return <section className="relative overflow-hidden bg-[#081321] py-20 md:py-28"><div aria-hidden className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-cyan-400/[.07] blur-[120px]" /><div className="relative mx-auto max-w-[1180px] px-6 xl:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">Projetos em operação</p><h2 className="mt-4 font-[family-name:var(--font-syne)] text-3xl font-bold tracking-[-.03em] text-white md:text-5xl">Tecnologia construída para resolver contextos reais.</h2><p className="mt-5 leading-relaxed text-slate-300">Cada projeto parte de uma operação, uma necessidade e uma forma própria de gerar valor — não de um template de solução.</p></div><div className="mt-11 grid gap-5 md:grid-cols-3">{projects.map((project, index) => { const Icon = project.icon; return <article key={project.name} className="rounded-2xl border border-white/[.1] bg-[#06111e]/80 p-7"><span className="font-mono text-xs text-cyan-300">0{index + 1}</span><Icon className="mt-8 text-teal-300" size={30}/><p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-slate-400">{project.category}</p><h3 className="mt-2 text-2xl font-bold text-white">{project.name}</h3><p className="mt-3 leading-relaxed text-slate-300/80">{project.description}</p></article>; })}</div>{!compact && <div className="mt-10"><Link className="inline-flex items-center gap-2 font-semibold text-cyan-200 hover:text-cyan-300" href="/contact">Conversar sobre um projeto semelhante <ArrowRight size={17}/></Link></div>}</div></section>;
}
