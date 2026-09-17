import { SITE_CONFIG } from "./site";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? SITE_CONFIG.url;

/* ── Organization (already in layout, re-exported for composition) ── */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_CONFIG.name,
  url: SITE_URL,
  logo: `${SITE_URL}${SITE_CONFIG.logo}`,
  sameAs: Object.values(SITE_CONFIG.links),
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+55-13-99182-1557",
    contactType: "sales",
    availableLanguage: ["Portuguese", "English", "Spanish"],
  },
};

/* ── LocalBusiness ── */
export const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: SITE_CONFIG.name,
  url: SITE_URL,
  logo: `${SITE_URL}${SITE_CONFIG.logo}`,
  image: `${SITE_URL}${SITE_CONFIG.logo}`,
  telephone: "+55-13-99182-1557",
  email: "comercial@innexar.com.br",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Praia Grande",
    addressRegion: "SP",
    addressCountry: "BR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -24.0058,
    longitude: -46.4028,
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
  priceRange: "$$",
  sameAs: Object.values(SITE_CONFIG.links),
  areaServed: {
    "@type": "Country",
    name: "Brazil",
  },
};

/* ── FAQ ── */
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Quanto custa um site profissional?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "O preço varia conforme a complexidade do projeto. Temos opções desde sites por assinatura (a partir de R$ 299/mês) até projetos customizados. Faça uma consulta para um orçamento personalizado.",
      },
    },
    {
      "@type": "Question",
      name: "Qual é o prazo de entrega?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Prazos variam de 2 semanas para páginas simples até 3-4 meses para aplicações complexas. Durante a proposta, estabelecemos um timeline claro e realista.",
      },
    },
    {
      "@type": "Question",
      name: "Vocês hospedam o site?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim! Oferecemos hospedagem inclusa em nossos planos. Você não precisa se preocupar com infraestrutura técnica. Apenas escolha seu domínio e pronto.",
      },
    },
    {
      "@type": "Question",
      name: "Posso ter suporte após o lançamento?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim. O suporte e a evolução após o lançamento são definidos no escopo do projeto ou em um plano de manutenção contínua.",
      },
    },
    {
      "@type": "Question",
      name: "Como funciona o site por assinatura?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "É simples: você paga uma mensalidade fixa e recebe um site profissional, hospedado, otimizado e com suporte incluso. Sem investimento inicial. Perfeito para pequenos negócios.",
      },
    },
    {
      "@type": "Question",
      name: "Vocês fazem otimização para SEO?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sim! Todos os sites são otimizados desde o início para aparecer melhor no Google. Oferecemos também serviços de marketing digital e estratégia de SEO avançada.",
      },
    },
  ],
};

/* ── Services ── */
export const servicesSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Service",
        name: "Criação de Sites Profissionais",
        description:
          "Landing pages, sites corporativos e e-commerce com design exclusivo, SEO otimizado e alta performance.",
        url: `${SITE_URL}/criacao-de-sites`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Service",
        name: "Site por Assinatura",
        description:
          "Site profissional com manutenção inclusa. Pague mensalmente, sem investimento inicial.",
        url: `${SITE_URL}/planos`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Service",
        name: "Desenvolvimento de Aplicativos Web e Mobile",
        description:
          "Apps sob medida com React, React Native e Next.js. Do protótipo ao deploy.",
        url: `${SITE_URL}/desenvolvimento-de-sistemas`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Service",
        name: "Marketing Digital & Ads",
        description:
          "SEO, Google Ads, Meta Ads e estratégias de crescimento para atrair clientes qualificados.",
        url: `${SITE_URL}/marketing-digital`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
    {
      "@type": "ListItem",
      position: 5,
      item: {
        "@type": "Service",
        name: "Gestão de Redes Sociais",
        description:
          "Estratégia de conteúdo, calendário editorial, design e community management.",
        url: `${SITE_URL}/marketing-digital`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
    {
      "@type": "ListItem",
      position: 6,
      item: {
        "@type": "Service",
        name: "Infraestrutura & Cloud",
        description:
          "AWS, GCP, Azure, Docker, Kubernetes e DevOps com CI/CD automatizado.",
        url: `${SITE_URL}/services/infra`,
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
      },
    },
  ],
};

/* ── Pricing offers for /planos ── */
export const pricingOffersSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Planos Innexar",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Service",
        name: "Site Essencial",
        description: "Site profissional com hospedagem inclusa — até 10 páginas, design responsivo, SEO básico, SSL e suporte técnico.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "299.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Service",
        name: "Site Profissional",
        description: "Site + Sistema de leads + Marketing integrado — até 30 páginas, SEO técnico, CRM leve, Google Analytics.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "499.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Service",
        name: "Máquina de Vendas",
        description: "Site + CRM completo + Automação de marketing — páginas ilimitadas, funil de vendas, BI, suporte VIP 24h.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "799.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Service",
        name: "Ads Essencial",
        description: "Gestão de campanhas Google e Meta Ads + gestão básica de redes sociais.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "399.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 5,
      item: {
        "@type": "Service",
        name: "Ads Premium",
        description: "Gestão completa de marketing digital — campanhas ilimitadas, copywriting, design gráfico, análise de concorrência.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "699.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 6,
      item: {
        "@type": "Service",
        name: "Marketing 360°",
        description: "Marketing total — tudo incluso com produção de vídeo, motion design, funil completo, WhatsApp e e-mail marketing.",
        provider: { "@type": "Organization", name: SITE_CONFIG.name },
        offers: {
          "@type": "Offer",
          price: "1299.00",
          priceCurrency: "BRL",
          url: `${SITE_URL}/planos`,
          unitCode: "MON",
        },
      },
    },
  ],
};

/* ── BreadcrumbList helper ── */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/* ── WebSite schema (for sitelinks search box) ── */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_CONFIG.name,
  url: SITE_URL,
  description: SITE_CONFIG.description,
  publisher: {
    "@type": "Organization",
    name: SITE_CONFIG.name,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}${SITE_CONFIG.logo}`,
    },
  },
};
