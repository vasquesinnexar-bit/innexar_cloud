import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Hero } from "@/components/sections/Hero";
import { TechLogos } from "@/components/sections/TechLogos";
import { Services } from "@/components/sections/Services";
import { NationalCoverage } from "@/components/seo/NationalCoverage";
import { ProjectsSection } from "@/components/seo/ProjectsSection";
import { faqSchema, servicesSchema } from "@/config/schemas";

const LiveBuild = dynamic(
  () => import("@/components/sections/LiveBuild").then((m) => m.LiveBuild)
);
const Advantages = dynamic(
  () => import("@/components/sections/Advantages").then((m) => m.Advantages)
);
const Process = dynamic(
  () => import("@/components/sections/Process").then((m) => m.Process)
);
const FAQ = dynamic(
  () => import("@/components/sections/FAQ").then((m) => m.FAQ)
);
const ContactSection = dynamic(
  () => import("@/components/contact/ContactSection").then((m) => m.ContactSection)
);
const CTASection = dynamic(
  () => import("@/components/sections/CTASection").then((m) => m.CTASection)
);

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
      />
      <Hero />
      <Services />
      <NationalCoverage />
      <ProjectsSection />
      <TechLogos />
      <LiveBuild />
      <Advantages />
      <Process />
      <FAQ />
      <Suspense fallback={null}>
        <ContactSection />
      </Suspense>
      <CTASection />
    </>
  );
}
