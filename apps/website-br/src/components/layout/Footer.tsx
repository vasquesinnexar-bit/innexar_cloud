import Link from "next/link";
import Image from "next/image";
import { Globe, Smartphone, BrainCircuit, Link2, BarChart3, Code2, CreditCard, Linkedin, Github, Instagram } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";

const services = [
  { href: "/criacao-de-sites", icon: Globe, label: "Sites Profissionais" },
  { href: "/planos", icon: CreditCard, label: "Site por Assinatura" },
  { href: "/desenvolvimento-de-sistemas", icon: Smartphone, label: "Sistemas sob medida" },
  { href: "/desenvolvimento-de-software", icon: Code2, label: "Software sob medida" },
  { href: "/desenvolvimento-de-saas", icon: Smartphone, label: "Desenvolvimento de SaaS" },
  { href: "/marketing-digital", icon: BarChart3, label: "Marketing Digital" },
  { href: "/inteligencia-artificial", icon: BrainCircuit, label: "Inteligência Artificial" },
  { href: "/automacao-empresarial", icon: BarChart3, label: "Automação empresarial" },
  { href: "/prospector-ai", icon: BrainCircuit, label: "ProspectorAI" },
  { href: "/blockchain", icon: Link2, label: "Blockchain" },
  { href: "/integracao-de-sistemas", icon: Code2, label: "Integração de sistemas" },
  { href: "/services/infra", icon: Globe, label: "Infraestrutura & Cloud" },
];

const company = [
  { href: "/about", label: "Sobre nós" },
  { href: "/contact", label: "Contato" },
  { href: "/criar-site", label: "Criar meu site" },
  { href: "/projetos", label: "Projetos" },
  { href: "/atendimento/sao-paulo", label: "Atendimento em São Paulo" },
  { href: "/privacy-policy", label: "Privacidade" },
  { href: "/terms-of-service", label: "Termos de uso" },
];

const social = [
  { href: SITE_CONFIG.links.linkedin, icon: Linkedin, label: "LinkedIn" },
  { href: SITE_CONFIG.links.github, icon: Github, label: "GitHub" },
  { href: SITE_CONFIG.links.instagram, icon: Instagram, label: "Instagram" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-cyan-300/[0.08] bg-[#050b16]">
      <div aria-hidden className="tech-grid pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="mb-6 block w-fit" aria-label="Página inicial da Innexar">
              <Image src={SITE_CONFIG.logo} alt="Innexar" width={181} height={60} className="h-auto w-44" />
            </Link>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-white/75">
              Agência digital especializada em sites profissionais, apps e inteligência artificial para empresas brasileiras.
            </p>
            <div className="flex gap-3">
              {social.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-white/75 hover:border-teal-500/40 hover:bg-teal-500/12 hover:text-teal-300"
                >
                  <s.icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-white/70">Serviços</h3>
            <ul className="space-y-3">
              {services.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-2 text-sm text-white/80 hover:text-teal-300 transition-colors"
                  >
                    <s.icon size={13} />
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-white/70">Empresa</h3>
            <ul className="space-y-3">
              {company.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="text-sm text-white/80 hover:text-teal-300 transition-colors">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/60">
            © {year} {SITE_CONFIG.name}. Todos os direitos reservados.
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-teal-300/70">Tecnologia para um amanhã mais brilhante</p>
        </div>
      </div>
    </footer>
  );
}
