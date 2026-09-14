import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceLandingPage } from "@/components/seo/ServiceLandingPage";
import { serviceContent } from "@/components/seo/service-content";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";

const seo: Record<string, { title: string; description: string }> = {
  "criacao-de-sites": { title: "Criação de Sites Profissionais", description: "Criação de sites profissionais, landing pages e e-commerce com estratégia, performance e SEO técnico." },
  "desenvolvimento-de-sistemas": { title: "Desenvolvimento de Sistemas", description: "Desenvolvimento de sistemas sob medida para organizar processos, equipes e dados da sua empresa." },
  "desenvolvimento-de-software": { title: "Desenvolvimento de Software", description: "Software sob medida, MVPs e plataformas digitais para transformar necessidades de negócio em produtos." },
  "desenvolvimento-de-saas": { title: "Desenvolvimento de SaaS", description: "Desenvolvimento de plataformas SaaS, áreas de cliente, backoffice e produtos digitais recorrentes." },
  "inteligencia-artificial": { title: "Inteligência Artificial para Empresas", description: "Soluções de inteligência artificial para atendimento, análise, automação e processos empresariais." },
  "automacao-empresarial": { title: "Automação Empresarial", description: "Automação empresarial para reduzir trabalho manual e conectar atendimento, vendas e operação." },
  "integracao-de-sistemas": { title: "Integração de Sistemas", description: "Integração de sistemas, APIs e dados para uma operação empresarial mais conectada e consistente." },
  "marketing-digital": { title: "Marketing Digital", description: "SEO, estratégia de conteúdo e aquisição digital orientada por dados e conversão." },
};

export function generateStaticParams() { return Object.keys(seo).map((slug) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = seo[slug];
  if (!page) return {};
  return { title: page.title, description: page.description, alternates: { canonical: `/${slug}` }, openGraph: { title: `${page.title} | Innexar`, description: page.description, url: `${SITE_URL}/${slug}` }, twitter: { card: "summary_large_image", title: `${page.title} | Innexar`, description: page.description, images: [`${SITE_URL}/opengraph-image`] } };
}

export default async function SeoServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = serviceContent[slug];
  const page = seo[slug];
  if (!content || !page) notFound();
  const url = `${SITE_URL}/${slug}`;
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema([{ name: "Início", url: SITE_URL }, { name: page.title, url }]), { "@context": "https://schema.org", "@type": "Service", name: page.title, description: page.description, url, areaServed: { "@type": "Country", name: "Brasil" }, provider: { "@type": "Organization", name: "Innexar", url: SITE_URL } }]) }} /><ServiceLandingPage content={content} /></>;
}
