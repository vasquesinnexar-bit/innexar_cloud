"use client";

import { Globe, Zap, Search, Smartphone, ShieldCheck, PenTool, BarChart3 } from "lucide-react";
import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { CTASection } from "@/components/sections/CTASection";

const features = [
  { icon: PenTool, title: "Design Exclusivo", desc: "Identidade visual única criada do zero para sua marca. Sem templates genéricos." },
  { icon: Zap, title: "Alta Performance", desc: "Google PageSpeed Score 90+. Sites rápidos convertem mais e ranqueiam melhor." },
  { icon: Search, title: "SEO On-Page", desc: "Estrutura técnica perfeita para o Google: schema.org, meta tags, sitemap e Core Web Vitals." },
  { icon: Smartphone, title: "100% Responsivo", desc: "Perfeito em qualquer dispositivo: desktop, tablet e celular." },
  { icon: ShieldCheck, title: "SSL e Segurança", desc: "HTTPS, proteção contra ataques e conformidade com a LGPD incluídos." },
  { icon: BarChart3, title: "Analytics Integrado", desc: "Google Analytics 4, Search Console e Meta Pixel configurados desde o primeiro dia." },
];

const plans = [
  {
    name: "Landing Page",
    price: "R$ 1.497",
    desc: "Ideal para campanhas e negócios iniciando online",
    features: ["1 página completa", "Design exclusivo", "Formulário de contato", "SEO básico", "SSL incluso", "Entrega em 7 dias"],
    cta: "/criar-site",
    highlight: false,
  },
  {
    name: "Site Profissional",
    price: "R$ 2.997",
    desc: "Para empresas que querem presença digital sólida",
    features: ["Até 6 páginas", "Design exclusivo", "Blog integrado", "SEO completo", "WhatsApp integrado", "Google Analytics", "Entrega em 14 dias"],
    cta: "/criar-site",
    highlight: true,
  },
  {
    name: "E-commerce",
    price: "Sob consulta",
    desc: "Loja online completa com carrinho e pagamento",
    features: ["Produtos ilimitados", "Checkout completo", "Mercado Pago", "Gestão de estoque", "Relatórios de vendas", "Integração ERP"],
    cta: "/contact",
    highlight: false,
  },
];

export function WebServiceClient() {
  return (
    <>
      <ServicePageLayout
        badge="Sites Profissionais"
        icon={Globe}
        title="Um site que converte"
        subtitle="e vende por você"
        description="Criamos sites modernos, rápidos e otimizados para o Google que transformam visitantes em clientes. Do design ao deploy, cuidamos de tudo."
        gradient="from-teal-500 to-teal-700"
        features={features}
        plans={plans}
      />
      <CTASection />
    </>
  );
}
