import Link from 'next/link'

export default function PaidTrafficSuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-24 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-8 text-center">
        <h1 className="text-3xl font-bold">Payment started successfully</h1>
        <p className="mt-3 text-slate-200">
          We received your checkout information. Our team will continue the onboarding and campaign setup with you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/paid-traffic"
            className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back to plans
          </Link>
          <Link
            href="/contact"
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:opacity-90"
          >
            Talk to our team
          </Link>
        </div>
      </div>
    </main>
  )
}
