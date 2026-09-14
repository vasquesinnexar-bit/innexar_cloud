import type { Metadata } from "next";
import { ProjectsSection } from "@/components/seo/ProjectsSection";
import { breadcrumbSchema } from "@/config/schemas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://innexar.com.br";
export const metadata: Metadata = { title: "Projetos de Tecnologia", description: "Conheça projetos digitais da Innexar em operações, gestão e prospecção com inteligência artificial.", alternates: { canonical: "/projetos" } };
export default function ProjectsPage() { return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([{ name: "Início", url: SITE_URL }, { name: "Projetos", url: `${SITE_URL}/projetos` }])) }} /><ProjectsSection compact /></>; }
