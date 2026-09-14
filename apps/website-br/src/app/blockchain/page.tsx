import type { Metadata } from "next";
import { BlockchainClient } from "@/components/pages/BlockchainClient";

export const metadata: Metadata = {
  title: "Blockchain & Web3",
  description:
    "Contratos inteligentes, tokenização de ativos e soluções descentralizadas. Web3 para empresas.",
  alternates: { canonical: "/blockchain" },
};

export default function BlockchainPage() {
  return <BlockchainClient />;
}
