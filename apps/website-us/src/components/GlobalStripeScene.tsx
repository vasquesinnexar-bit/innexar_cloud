'use client'

import { useEffect, useState } from 'react'

export default function GlobalStripeScene() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(110deg,#f8fcff_0%,#f4f9ff_35%,#eff7ff_65%,#f8fcff_100%)]" />

      <div className="absolute inset-0 opacity-65 [background-image:linear-gradient(rgba(14,116,144,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,0.08)_1px,transparent_1px)] [background-size:60px_60px]" />

      <div className="absolute -top-32 left-[8%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/30 blur-3xl animate-orb-drift" />
      <div className="absolute top-[15%] right-[5%] h-[26rem] w-[26rem] rounded-full bg-blue-300/30 blur-3xl animate-orb-drift-delayed" />
      <div className="absolute bottom-[-8rem] left-[35%] h-[24rem] w-[24rem] rounded-full bg-sky-200/35 blur-3xl animate-orb-drift-slow" />

      <div className="absolute left-[-15%] top-[12%] h-px w-[55%] rotate-12 bg-linear-to-r from-transparent via-cyan-400/60 to-transparent" />
      <div className="absolute right-[-20%] top-[38%] h-px w-[60%] -rotate-6 bg-linear-to-r from-transparent via-blue-400/55 to-transparent" />
      <div className="absolute left-[-18%] bottom-[18%] h-px w-[58%] -rotate-12 bg-linear-to-r from-transparent via-cyan-500/45 to-transparent" />
    </div>
  )
}
