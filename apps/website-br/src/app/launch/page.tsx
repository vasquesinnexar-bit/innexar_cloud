import type { Metadata } from "next";
import { LaunchPageClient } from "@/components/launch/LaunchPageClient";

export const metadata: Metadata = {
  title: "Lançamento especial",
  description:
    "Seu site no ar em 7 dias. Site profissional, rápido e que converte.",
  alternates: { canonical: "/launch" },
  robots: { index: false, follow: true },
};

export default function LaunchPage() {
  return <LaunchPageClient />;
}
