import type { Metadata } from "next";
import { WebServiceClient } from "@/components/pages/WebServiceClient";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

export const metadata: Metadata = {
  title: "Criação de Sites Profissionais",
  description:
    "Sites profissionais modernos, rápidos e otimizados para o Google. Landing pages, sites corporativos e e-commerce com design exclusivo.",
  alternates: { canonical: "/services/web" },
  openGraph: {
    title: "Criação de Sites Profissionais | Innexar",
    description: "Sites profissionais modernos, rápidos e otimizados para o Google.",
    url: `${SITE_URL}/services/web`,
  },
};

export default function WebPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbSchema([
              { name: "Início", url: SITE_URL },
              { name: "Serviços", url: `${SITE_URL}/services/web` },
              { name: "Sites Profissionais", url: `${SITE_URL}/services/web` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Service",
              name: "Criação de Sites Profissionais",
              description: "Sites profissionais modernos, rápidos e otimizados para o Google. Landing pages, sites corporativos e e-commerce com design exclusivo.",
              url: `${SITE_URL}/services/web`,
              provider: { "@type": "Organization", name: "Innexar" },
            },
          ]),
        }}
      />
      <WebServiceClient />
    </>
  );
}
