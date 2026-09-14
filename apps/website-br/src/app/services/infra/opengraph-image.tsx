import { createServiceOgImage } from "@/lib/og-helpers";

export const runtime = "edge";
export const alt = "Infraestrutura & Cloud | Innexar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default createServiceOgImage(
  "Infraestrutura & Cloud",
  "AWS, GCP, Azure, Docker, Kubernetes e DevOps",
  "/services/infra"
);
