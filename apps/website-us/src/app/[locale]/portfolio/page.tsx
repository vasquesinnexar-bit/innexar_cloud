import { generateMetadata as genMeta } from '@/lib/seo'
import Header from '@/components/Header'
import SuccessStories from '@/components/SuccessStories'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return genMeta(locale, 'portfolio')
}

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Header />
      <div className="pt-16">
        <SuccessStories />
      </div>
      <Contact />
      <Footer />
    </main>
  )
}