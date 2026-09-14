import type { Metadata } from "next";
import { PromoPageClient } from "@/components/promo/PromoPageClient";

export const metadata: Metadata = {
  title: "Promoção Especial",
  description:
    "Oferta exclusiva para criação de sites profissionais com desconto especial.",
  alternates: { canonical: "/promo" },
  robots: { index: false, follow: true },
};

export default function PromoPage() {
  return <PromoPageClient />;
}
