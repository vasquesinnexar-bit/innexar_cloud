import type { Metadata } from "next";
import { LaunchPageClient } from "@/components/launch/LaunchPageClient";

export const metadata: Metadata = {
  title: "Criar meu site",
  description:
    "Site profissional em até 7 dias. Design moderno, SEO otimizado, hospedagem inclusa. Sem mensalidades ocultas.",
  alternates: { canonical: "/criar-site" },
};

export default function CriarSitePage() {
  return <LaunchPageClient />;
}
