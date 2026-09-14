"use client";

import { Smartphone, Code2, Database, Zap, ShieldCheck, RefreshCw } from "lucide-react";
import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { CTASection } from "@/components/sections/CTASection";

const features = [
  { icon: Code2, title: "Full Stack", desc: "React, Next.js, Node.js, Python — stack moderno e escalável para qualquer demanda." },
  { icon: Smartphone, title: "Mobile Nativo", desc: "React Native para iOS e Android com performance próxima ao nativo e código único." },
  { icon: Database, title: "APIs e Integrações", desc: "Integramos com qualquer sistema: ERPs, CRMs, gateways de pagamento e APIs externas." },
  { icon: Zap, title: "Alta Performance", desc: "Arquitetura otimizada para escalar de 10 a 10 mil usuários sem dores de cabeça." },
  { icon: ShieldCheck, title: "Segurança", desc: "JWT, OAuth2, criptografia end-to-end e auditoria de segurança em cada release." },
  { icon: RefreshCw, title: "Manutenção Ativa", desc: "Suporte contínuo, atualizações e monitoramento 24/7 pós-lançamento." },
];

const plans = [
  {
    name: "MVP",
    price: "A partir de R$ 4.997",
    desc: "Valide sua ideia rapidamente com o mínimo viável",
    features: ["Definição de escopo", "Design UX/UI", "Desenvolvimento MVP", "Deploy em cloud", "30 dias de suporte"],
    cta: "/contact",
    highlight: false,
  },
  {
    name: "Produto Completo",
    price: "Sob consulta",
    desc: "App completo com todas as funcionalidades",
    features: ["Escopo completo", "Design system", "Frontend + Backend", "API REST/GraphQL", "CI/CD automático", "SLA de suporte"],
    cta: "/contact",
    highlight: true,
  },
  {
    name: "Equipe Alocada",
    price: "Sob consulta",
    desc: "Desenvolvedores da Innexar integrados ao seu time",
    features: ["1 a 5 devs", "Onboarding ágil", "Reportes semanais", "Code reviews", "Gestão inclusa"],
    cta: "/contact",
    highlight: false,
  },
];

export function AppsServiceClient() {
  return (
    <>
      <ServicePageLayout
        badge="Aplicativos"
        icon={Smartphone}
        title="Apps que escalam"
        subtitle="com seu negócio"
        description="Desenvolvemos aplicativos web e mobile completos, do protótipo ao deploy em produção, com arquitetura sólida e UX pensado para conversão."
        gradient="from-teal-600 to-teal-800"
        features={features}
        plans={plans}
      />
      <CTASection />
    </>
  );
}
