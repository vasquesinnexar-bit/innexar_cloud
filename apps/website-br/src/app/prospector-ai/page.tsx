import type { Metadata } from "next";
import { ProspectorAiClient } from "@/components/pages/ProspectorAiClient";

export const metadata: Metadata = {
  title: "ProspectorAI — Prospecção com IA",
  description:
    "Prospecção inteligente com inteligência artificial. Encontre leads qualificados, automatize o outreach e escale suas vendas.",
  alternates: { canonical: "/prospector-ai" },
};

export default function ProspectorAiPage() {
  return <ProspectorAiClient />;
}
