import type { Metadata } from "next";
import { Syne, Source_Sans_3, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import CrmChatWidget from "@/components/layout/CrmChatWidget";
import { SITE_CONFIG } from "@/config/site";
import {
  organizationSchema,
  localBusinessSchema,
  websiteSchema,
} from "@/config/schemas";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? SITE_CONFIG.url;
const METADATA_BASE = new URL(SITE_URL);

export const metadata: Metadata = {
  metadataBase: METADATA_BASE,
  title: {
    default: "Desenvolvimento de Sistemas, Sites e IA | Innexar",
    template: "%s | Innexar",
  },
  description:
    "Desenvolvimento de sistemas, sites, SaaS, automações e inteligência artificial para empresas em todo o Brasil.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Desenvolvimento de Sistemas, Sites e IA | Innexar",
    description:
      "Desenvolvimento de sistemas, sites, SaaS, automações e inteligência artificial para empresas em todo o Brasil.",
    url: METADATA_BASE.toString(),
    type: "website",
    siteName: "Innexar",
    locale: "pt_BR",
    images: [
      {
        url: new URL("/opengraph-image", METADATA_BASE).toString(),
        width: 1200,
        height: 630,
        alt: "Innexar — Agência Digital",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Desenvolvimento de Sistemas, Sites e IA | Innexar",
    description:
      "Desenvolvimento de sistemas, sites, SaaS, automações e inteligência artificial para empresas em todo o Brasil.",
    images: [new URL("/opengraph-image", METADATA_BASE).toString()],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? undefined,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: ["/favicon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${sourceSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              organizationSchema,
              localBusinessSchema,
              websiteSchema,
            ]),
          }}
        />
        <Header />
        <main>{children}</main>
        <Footer />
        <CrmChatWidget />
      </body>
    </html>
  );
}
