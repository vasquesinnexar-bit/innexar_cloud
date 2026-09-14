import Header from '@/components/Header'
import Hero from '@/components/Hero'
import BuildToUiSection from '@/components/home/BuildToUiSection'
import HomeGrowthSections from '@/components/home/HomeGrowthSections'
import Footer from '@/components/Footer'
import { generateMetadata as genMeta } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return genMeta(locale, 'home')
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await params

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <BuildToUiSection />
      <HomeGrowthSections />
      <Footer />
    </main>
  )
}
