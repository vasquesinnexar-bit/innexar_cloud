import type { Metadata } from "next";
import { pricingOffersSchema, breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

export const metadata: Metadata = {
  title: "Planos e Preços",
  description:
    "Compare nossos planos de sites, apps e marketing digital. A partir de R$ 299/mês com hospedagem, suporte e SEO inclusos. Sem investimento inicial.",
  alternates: { canonical: "/planos" },
  openGraph: {
    title: "Planos e Preços | Innexar",
    description:
      "Sites a partir de R$ 299/mês. Marketing digital a partir de R$ 399/mês. Compare e escolha o plano ideal.",
    url: `${SITE_URL}/planos`,
  },
};

export default function PlanosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingOffersSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Início", url: SITE_URL },
              { name: "Planos", url: `${SITE_URL}/planos` },
            ])
          ),
        }}
      />
      {children}
    </>
  );
}
