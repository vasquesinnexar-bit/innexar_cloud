"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Globe,
  Smartphone,
  BarChart3,
  ChevronDown,
  ArrowUpRight,
  Headphones,
  CreditCard,
  Instagram,
  Server,
} from "lucide-react";
import { SITE_CONFIG } from "@/config/site";

const services = [
  { href: "/criacao-de-sites", icon: Globe, label: "Sites Profissionais", desc: "Landing pages e sites corporativos" },
  { href: "/planos", icon: CreditCard, label: "Site por Assinatura", desc: "Pague mensalmente, sem investimento inicial" },
  { href: "/desenvolvimento-de-sistemas", icon: Smartphone, label: "Sistemas sob medida", desc: "Plataformas e operações digitais" },
  { href: "/inteligencia-artificial", icon: BarChart3, label: "IA & Automação", desc: "Processos e atendimento inteligentes" },
  { href: "/planos", icon: Instagram, label: "Gestao de Redes", desc: "Conteudo e gerenciamento profissional" },
  { href: "/integracao-de-sistemas", icon: Server, label: "Integrações", desc: "APIs e sistemas conectados" },
];

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/planos", label: "Planos" },
  { href: "/about", label: "Sobre" },
  { href: "/contact", label: "Contato" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre os servicos da Innexar.")}`;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-teal-500/[0.16] bg-[#060e1d]/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
          : "border-white/[0.08] bg-[#060e1d]/82 backdrop-blur-xl"
      }`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent" />

      <div className="mx-auto flex h-[88px] max-w-[1440px] items-center justify-between px-6 xl:px-10">
        <Link href="/" className="flex items-center transition-opacity hover:opacity-90" aria-label="Página inicial da Innexar">
          <Image
            src={SITE_CONFIG.logo}
            alt={`${SITE_CONFIG.name} logo`}
            width={260}
            height={87}
            priority
            className="h-auto w-[174px] sm:w-[205px] lg:w-[230px]"
          />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2.5 text-base font-semibold text-white/85 transition-colors hover:bg-white/[.045] hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-base font-semibold text-white/85 transition-colors hover:bg-white/[.045] hover:text-white"
              aria-expanded={servicesOpen}
            >
              Servicos
              <ChevronDown size={14} className={`transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>

            {servicesOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar menu de servicos"
                  onClick={() => setServicesOpen(false)}
                  className="fixed inset-0 z-10"
                />
                <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-white/15 bg-[#11263d]/95 p-2 shadow-xl backdrop-blur-xl">
                  {services.map((s) => (
                    <Link
                      key={`${s.href}-${s.label}`}
                      href={s.href}
                      onClick={() => setServicesOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/80 transition-colors hover:bg-white/10 hover:text-teal-300"
                    >
                      <s.icon size={16} className="text-teal-300" />
                      <div>
                        <p className="text-sm font-semibold">{s.label}</p>
                        <p className="text-xs text-white/60">{s.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full px-3 py-2 text-base font-medium text-white/80 transition-colors hover:text-teal-300"
          >
            <Headphones size={15} />
            Suporte
          </a>
          <Link
            href="/criar-site"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 px-6 py-3 text-base font-bold text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(45,212,191,.25)]"
          >
            Iniciar projeto
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/15 bg-[#0D1B2A]/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-6 py-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}

            <div className="px-4 py-2">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/60">Servicos</p>
              {services.map((s) => (
                <Link
                  key={`${s.href}-${s.label}-mobile`}
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 py-2.5 text-white/80 transition-colors hover:text-teal-300"
                >
                  <s.icon size={16} />
                  <span className="text-sm font-medium">{s.label}</span>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Link
                href="/criar-site"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-6 py-3 text-sm font-semibold text-white"
              >
                <ArrowUpRight size={15} />
                Criar meu site
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:text-teal-300"
              >
                <Headphones size={15} />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
