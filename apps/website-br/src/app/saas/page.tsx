import type { Metadata } from "next";
import { SaasServiceClient } from "@/components/pages/SaasServiceClient";

export const metadata: Metadata = {
  title: "Site por Assinatura",
  description:
    "Site profissional com manutenção inclusa. Pague mensalmente, sem investimento inicial. Design, hospedagem e suporte incluídos.",
  alternates: { canonical: "/saas" },
  robots: { index: false, follow: true },
};

export default function SaasPage() {
  return <SaasServiceClient />;
}
