import type { Metadata } from "next";
import { AboutHeroSection } from "@/components/about/AboutHeroSection";
import { AboutMission } from "@/components/about/AboutMission";
import { AboutValues } from "@/components/about/AboutValues";
import { CTASection } from "@/components/sections/CTASection";

export const metadata: Metadata = {
  title: "Sobre Nós",
  description:
    "Conheça a Innexar — agência digital brasileira especializada em sites, apps e IA. Nossa missão, valores e time.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <AboutHeroSection />
      <AboutMission />
      <AboutValues />
      <CTASection />
    </>
  );
}
