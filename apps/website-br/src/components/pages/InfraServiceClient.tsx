"use client";

import { Code2, Cloud, Server, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { CTASection } from "@/components/sections/CTASection";

const features = [
  { icon: Cloud, title: "Cloud Multi-Provider", desc: "AWS, Google Cloud e Azure. Escolha o melhor para seu negócio ou híbrido." },
  { icon: Server, title: "VPS Gerenciados", desc: "Servidores dedicados ou compartilhados com monitoramento e backups automáticos." },
  { icon: Code2, title: "CI/CD", desc: "Pipelines automatizados com GitHub Actions, GitLab CI ou Jenkins." },
  { icon: Zap, title: "Docker & Kubernetes", desc: "Contêineres e orquestração para aplicações escaláveis e resilientes." },
  { icon: ShieldCheck, title: "Segurança", desc: "Firewalls, WAF, SSL, backups e políticas de acesso configurados." },
  { icon: RefreshCw, title: "Monitoramento", desc: "Uptime, logs, alertas e dashboards para operação 24/7." },
];

const plans = [
  {
    name: "Setup Inicial",
    price: "Sob consulta",
    desc: "Configuração de ambiente cloud do zero",
    features: ["Arquitetura definida", "Provisionamento", "CI/CD básico", "Documentação"],
    cta: "/contact",
    highlight: false,
  },
  {
    name: "Gestão Contínua",
    price: "Sob consulta",
    desc: "Manutenção e evolução da infraestrutura",
    features: ["Monitoramento 24/7", "Backups automáticos", "Atualizações de segurança", "Suporte prioritário"],
    cta: "/contact",
    highlight: true,
  },
  {
    name: "Equipe DevOps",
    price: "Sob consulta",
    desc: "DevOps alocado no seu projeto",
    features: ["1 dev dedicado", "SRE practices", "Automação completa", "SLA garantido"],
    cta: "/contact",
    highlight: false,
  },
];

export function InfraServiceClient() {
  return (
    <>
      <ServicePageLayout
        badge="Infraestrutura & Cloud"
        icon={Code2}
        title="Infra que escala"
        subtitle="com seu negócio"
        description="AWS, GCP, Azure, Docker e Kubernetes. Infraestrutura escalável, segura e com CI/CD para garantir disponibilidade e performance."
        gradient="from-indigo-600 to-purple-700"
        features={features}
        plans={plans}
      />
      <CTASection />
    </>
  );
}
