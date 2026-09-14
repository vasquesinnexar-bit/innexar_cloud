import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactHero } from "@/components/contact/ContactHero";
import { ContactSection } from "@/components/contact/ContactSection";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a Innexar. Tire suas dúvidas, solicite um orçamento ou agende uma call gratuita com nossa equipe.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <Suspense fallback={null}>
        <ContactSection />
      </Suspense>
    </>
  );
}
