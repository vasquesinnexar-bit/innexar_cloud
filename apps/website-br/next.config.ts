import type { NextConfig } from "next";

const CRM_ORIGIN = "https://crm.innexar.com.br";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "innexar.com.br",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/crm-embed/widget-sdk/:path*",
        destination: `${CRM_ORIGIN}/widget-sdk/:path*`,
      },
      {
        source: "/crm-embed/:path*",
        destination: `${CRM_ORIGIN}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/services/web", destination: "/criacao-de-sites", permanent: true },
      { source: "/services/apps", destination: "/desenvolvimento-de-sistemas", permanent: true },
      { source: "/services/marketing", destination: "/marketing-digital", permanent: true },
      // Canônico sem www (evita conteúdo duplicado apex × www).
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.innexar.com.br" }],
        destination: "https://innexar.com.br/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
