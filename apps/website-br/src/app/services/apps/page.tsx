import type { Metadata } from "next";
import { AppsServiceClient } from "@/components/pages/AppsServiceClient";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

export const metadata: Metadata = {
  title: "Desenvolvimento de Aplicativos Web e Mobile",
  description:
    "Desenvolvimento de apps web e mobile sob medida. React, React Native, Next.js. Do protótipo ao deploy.",
  alternates: { canonical: "/services/apps" },
  openGraph: {
    title: "Desenvolvimento de Aplicativos | Innexar",
    description: "Apps web e mobile sob medida com React, React Native e Next.js.",
    url: `${SITE_URL}/services/apps`,
  },
};

export default function AppsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Início", url: SITE_URL },
              { name: "Serviços", url: `${SITE_URL}/services/web` },
              { name: "Aplicativos", url: `${SITE_URL}/services/apps` },
            ])
          ),
        }}
      />
      <AppsServiceClient />
    </>
  );
}
