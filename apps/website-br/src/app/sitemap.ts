import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://innexar.com.br";

const highPriority = new Set([
  "criar-site",
  "criacao-de-sites",
  "desenvolvimento-de-sistemas",
  "desenvolvimento-de-software",
  "desenvolvimento-de-saas",
  "inteligencia-artificial",
  "automacao-empresarial",
  "integracao-de-sistemas",
  "marketing-digital",
  "projetos",
  "atendimento/sao-paulo",
  "planos",
]);

const pages = [
  "",
  "about",
  "blockchain",
  "contact",
  "criar-site",
  "planos",
  "prospector-ai",
  "criacao-de-sites",
  "desenvolvimento-de-sistemas",
  "desenvolvimento-de-software",
  "desenvolvimento-de-saas",
  "inteligencia-artificial",
  "automacao-empresarial",
  "integracao-de-sistemas",
  "marketing-digital",
  "projetos",
  "atendimento/sao-paulo",
  "services/web",
  "services/apps",
  "services/marketing",
  "services/infra",
  "privacy-policy",
  "terms-of-service",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${SITE_URL}${page ? `/${page}` : ""}`,
    lastModified: new Date("2026-09-13"),
    changeFrequency: page === "" ? "daily" : "weekly" as const,
    priority: page === "" ? 1.0 : highPriority.has(page) ? 0.9 : 0.8,
  }));
}
