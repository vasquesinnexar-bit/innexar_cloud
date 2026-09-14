import { createServiceOgImage } from "@/lib/og-helpers";

export const runtime = "edge";
export const alt = "Desenvolvimento de Apps | Innexar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default createServiceOgImage(
  "Aplicativos Web & Mobile",
  "React, React Native, Next.js — do protótipo ao deploy",
  "/services/apps"
);
