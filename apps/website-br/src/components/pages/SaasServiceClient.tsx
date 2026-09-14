"use client";

import { CreditCard, Zap, Building2, CheckCircle2 } from "lucide-react";
import { SaasHero } from "@/components/saas/SaasHero";
import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { CTASection } from "@/components/sections/CTASection";

const features = [
  { icon: Building2, title: "Painel administrativo", desc: "Gerencie conteúdo, páginas e formulários com facilidade." },
  { icon: Zap, title: "Hospedagem rápida e segura", desc: "Infra otimizada com SSL e performance para conversão." },
  { icon: CreditCard, title: "Sem taxa de desenvolvimento", desc: "Comece hoje pagando mensalmente. Sem investimento inicial." },
  { icon: CheckCircle2, title: "Manutenção e suporte contínuo", desc: "Evolução e correções inclusas, com limites por plano." },
];

const plans = [
  {
    name: "Site Iniciante",
    price: "R$ 199/mês",
    priceNote: "R$ 6,60 por dia",
    desc: "Ideal para campanhas e negócios iniciando online",
    features: [
      "Até 10 páginas completas",
      "Design exclusivo",
      "Painel administrativo",
      "Formulário de contato",
      "SEO básico",
      "SSL incluso",
      "Entrega em até 7 dias",
      "Hospedagem inclusa",
      "Manutenção contínua",
      "Suporte técnico",
      "2 alterações por mês",
    ],
    cta: "/contact",
    ctaLabel: "Solicitar orçamento",
    highlight: false,
  },
  {
    name: "Site Profissional",
    price: "R$ 349/mês",
    priceNote: "R$ 11,60 por dia",
    desc: "Ideal para empresas que querem crescer e gerar leads",
    features: [
      "Tudo do plano iniciante",
      "Até 20 páginas",
      "Blog integrado (SEO avançado)",
      "Integração com WhatsApp",
      "Integração com redes sociais",
      "Formulários avançados",
      "Google Analytics + Tag Manager",
      "5 alterações por mês",
    ],
    cta: "/contact",
    ctaLabel: "Solicitar orçamento",
    highlight: true,
    badge: "MAIS POPULAR",
  },
  {
    name: "Site Premium",
    price: "R$ 597/mês",
    priceNote: "R$ 19,90 por dia",
    desc: "Ideal para empresas que querem escalar vendas",
    features: [
      "Tudo do plano profissional",
      "Páginas ilimitadas",
      "Landing pages de alta conversão",
      "Funil de vendas completo",
      "Integração com CRM",
      "Automação de marketing",
      "Alterações ilimitadas",
    ],
    cta: "/contact",
    ctaLabel: "Solicitar orçamento",
    highlight: false,
  },
];

export function SaasServiceClient() {
  return (
    <>
      <SaasHero />
      <ServicePageLayout
        badge="Site por Assinatura"
        icon={CreditCard}
        title="Planos mensais"
        subtitle="prontos para vender"
        description="Todos os planos incluem painel administrativo completo, hospedagem rápida e segura e manutenção/suporte contínuos. Sem taxa de desenvolvimento. Sem contrato longo. Comece hoje mesmo."
        gradient="from-indigo-600 to-purple-700"
        features={features}
        plans={plans}
      />
      <CTASection />
    </>
  );
}
