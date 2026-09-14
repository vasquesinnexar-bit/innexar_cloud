import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StructurOneHero from '@/components/saas/StructurOneHero'
import StructurOneSection from '@/components/saas/StructurOneSection'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params

  const titles = {
    en: 'StructurOne | Construction & Real Estate Software Development USA',
    pt: 'StructurOne | Software para Construcao e Mercado Imobiliario',
    es: 'StructurOne | Software para Construccion e Inmobiliario',
  }

  const descriptions = {
    en: 'Construction software development and real estate software solutions by Innexar. Property management system development, contractor workflows, and business automation software for growing companies in Florida and USA.',
    pt: 'Plataforma StructurOne para construcao e imobiliario, com automacao de processos, gestao de empreendimentos e operacao comercial.',
    es: 'Plataforma StructurOne para construccion e sector inmobiliario con automatizacion de procesos, gestion de proyectos y operacion comercial.',
  }

  const keywords = {
    en: 'construction software development Florida, contractor management software USA, real estate software development Florida, property management system development USA, business process automation software, custom CRM for small business USA',
    pt: 'software para construcao, software imobiliario, automacao de processos, gestao de empreendimentos',
    es: 'software para construccion, software inmobiliario, automatizacion de procesos, gestion de proyectos',
  }

  return {
    title: titles[locale as keyof typeof titles] || titles.en,
    description: descriptions[locale as keyof typeof descriptions] || descriptions.en,
    keywords: (keywords[locale as keyof typeof keywords] || keywords.en).split(',').map((k) => k.trim()),
    openGraph: {
      type: 'website',
      title: titles[locale as keyof typeof titles] || titles.en,
      description: descriptions[locale as keyof typeof descriptions] || descriptions.en,
    },
    twitter: {
      card: 'summary_large_image',
      title: titles[locale as keyof typeof titles] || titles.en,
      description: descriptions[locale as keyof typeof descriptions] || descriptions.en,
    },
  }
}

export default function StructurOneSaasPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <StructurOneHero />
      <StructurOneSection />
      <Footer />
    </main>
  )
}


