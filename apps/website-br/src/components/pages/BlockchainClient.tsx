"use client";

import { Link2, ShieldCheck, Coins, FileCode, Lock, Zap } from "lucide-react";
import { ServicePageLayout } from "@/components/services/ServicePageLayout";
import { CTASection } from "@/components/sections/CTASection";

const features = [
  { icon: FileCode, title: "Smart Contracts", desc: "Desenvolvimento de contratos em Solidity, Rust ou outras linguagens para Ethereum, Solana e L2s." },
  { icon: Coins, title: "Tokenização", desc: "Tokens fungíveis e NFTs para representar ativos, loyalty ou governança." },
  { icon: Link2, title: "Integrações", desc: "APIs e SDKs para conectar seu sistema a blockchains e wallets." },
  { icon: ShieldCheck, title: "Segurança", desc: "Auditorias, testes formais e boas práticas para contratos em produção." },
  { icon: Lock, title: "Custódia", desc: "Soluções de custódia e multi-sig para ativos digitais." },
  { icon: Zap, title: "Layer 2", desc: "Arbitrum, Optimism, Polygon e outras redes para custos reduzidos." },
];

const plans = [
  {
    name: "Consultoria",
    price: "Sob consulta",
    desc: "Avaliação e estratégia Web3",
    features: ["Workshop inicial", "Análise de viabilidade", "Roadmap técnico", "Documento de arquitetura"],
    cta: "/contact",
    highlight: false,
  },
  {
    name: "Desenvolvimento",
    price: "Sob consulta",
    desc: "Smart contracts e integrações",
    features: ["Contratos auditados", "Testes automatizados", "Deploy em mainnet", "Documentação"],
    cta: "/contact",
    highlight: true,
  },
  {
    name: "Produto Completo",
    price: "Sob consulta",
    desc: "Plataforma Web3 de ponta a ponta",
    features: ["Frontend + Backend", "Wallet integration", "Dashboard admin", "Suporte pós-lançamento"],
    cta: "/contact",
    highlight: false,
  },
];

export function BlockchainClient() {
  return (
    <>
      <ServicePageLayout
        badge="Blockchain & Web3"
        icon={Link2}
        title="Soluções descentralizadas"
        subtitle="para sua empresa"
        description="Contratos inteligentes, tokenização de ativos e integrações Web3. Tecnologia blockchain com foco em resultados de negócio."
        gradient="from-amber-500 to-amber-700"
        features={features}
        plans={plans}
      />
      <CTASection />
    </>
  );
}
