import { createServiceOgImage } from "@/lib/og-helpers";

export const runtime = "edge";
export const alt = "Marketing Digital | Innexar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default createServiceOgImage(
  "Marketing Digital",
  "SEO, Google Ads, Meta Ads e estratégias de crescimento",
  "/services/marketing"
);
