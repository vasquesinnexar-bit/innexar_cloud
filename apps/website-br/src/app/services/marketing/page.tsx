import type { Metadata } from "next";
import { MarketingServiceClient } from "@/components/pages/MarketingServiceClient";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

export const metadata: Metadata = {
  title: "Marketing Digital",
  description:
    "SEO, Google Ads, Meta Ads e estratégias de crescimento. Apareça no topo do Google e atraia clientes qualificados.",
  alternates: { canonical: "/services/marketing" },
  openGraph: {
    title: "Marketing Digital | Innexar",
    description: "SEO, Google Ads, Meta Ads e estratégias de crescimento para seu negócio.",
    url: `${SITE_URL}/services/marketing`,
  },
};

export default function MarketingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Início", url: SITE_URL },
              { name: "Serviços", url: `${SITE_URL}/services/web` },
              { name: "Marketing Digital", url: `${SITE_URL}/services/marketing` },
            ])
          ),
        }}
      />
      <MarketingServiceClient />
    </>
  );
}
