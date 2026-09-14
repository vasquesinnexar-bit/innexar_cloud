import { createServiceOgImage } from "@/lib/og-helpers";

export const runtime = "edge";
export const alt = "Criação de Sites Profissionais | Innexar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default createServiceOgImage(
  "Sites Profissionais",
  "Landing pages, sites corporativos e e-commerce com design exclusivo",
  "/services/web"
);
