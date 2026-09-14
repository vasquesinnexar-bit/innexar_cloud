import type { Metadata } from "next";
import { InfraServiceClient } from "@/components/pages/InfraServiceClient";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

export const metadata: Metadata = {
  title: "Infraestrutura & Cloud",
  description:
    "AWS, GCP, Azure, Docker, Kubernetes e DevOps. Infraestrutura escalável, segura e com CI/CD automatizado.",
  alternates: { canonical: "/services/infra" },
  openGraph: {
    title: "Infraestrutura & Cloud | Innexar",
    description: "AWS, GCP, Azure, Docker, Kubernetes e DevOps com CI/CD automatizado.",
    url: `${SITE_URL}/services/infra`,
  },
};

export default function InfraPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: "Início", url: SITE_URL },
              { name: "Serviços", url: `${SITE_URL}/services/web` },
              { name: "Infraestrutura & Cloud", url: `${SITE_URL}/services/infra` },
            ])
          ),
        }}
      />
      <InfraServiceClient />
    </>
  );
}
