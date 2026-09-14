import type { Metadata } from "next";
import { ChecklistForm } from "@/components/checklist/ChecklistForm";

export const metadata: Metadata = {
  title: "Checklist estratégico",
  description: "Diagnóstico gratuito do seu negócio digital — Innexar Brasil.",
  alternates: { canonical: "/checklist" },
};

export default function ChecklistPage() {
  return <ChecklistForm />;
}
