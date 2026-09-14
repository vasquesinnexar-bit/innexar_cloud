'use client'

import { useReducedMotion } from 'framer-motion'
import { MARQUEE_TECH, MARQUEE_AI, type MarqueeItem } from '@/components/home/tech-marquee-data'
import { brandIconUrl } from '@/lib/brand-icon-url'

function MarqueeGlyph({ item }: { item: MarqueeItem }) {
  if (item.fallbackInitial) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
        style={{ backgroundColor: item.fallbackBg ?? '#475569' }}
        aria-hidden
      >
        {item.fallbackInitial}
      </span>
    )
  }

  return (
    <img
      src={brandIconUrl(item.slug)}
      alt=""
      width={22}
      height={22}
      className="h-5 w-5 object-contain opacity-90 brightness-0 invert sepia-[0.12] saturate-150"
      loading="lazy"
    />
  )
}

function MarqueeRow({
  label,
  items,
  direction,
  ariaHidden,
}: {
  label: string
  items: MarqueeItem[]
  direction: 'left' | 'right'
  ariaHidden?: boolean
}) {
  const doubled = [...items, ...items]

  return (
    <div
      className="relative overflow-hidden border-y border-cyan-300/10 bg-slate-950/55 py-3 backdrop-blur-md"
      aria-hidden={ariaHidden}
    >
      <p className="sr-only">{label}</p>
      <div
        className={`flex w-max gap-10 px-4 ${direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'}`}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.slug}-${i}`}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border border-white/8 bg-white/[0.02] px-3 py-1 text-slate-200"
            title={item.label}
          >
            <MarqueeGlyph item={item} />
            <span className="text-sm font-medium tracking-tight text-slate-200">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

type TechAiMarqueeProps = {
  techLabel: string
  aiLabel: string
}

function StaticRow({ label, items }: { label: string; items: MarqueeItem[] }) {
  return (
    <div className="border-y border-cyan-300/10 bg-slate-950/55 py-4 backdrop-blur-md">
      <p className="mb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-4">
        {items.map((item) => (
          <span
            key={item.slug}
            className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/8 bg-white/[0.02] px-3 py-1 text-slate-200"
            title={item.label}
          >
            <MarqueeGlyph item={item} />
            <span className="text-sm font-medium text-slate-300">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function TechAiMarquee({ techLabel, aiLabel }: TechAiMarqueeProps) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <div className="relative z-10 mt-10 space-y-0 overflow-hidden rounded-xl ring-1 ring-white/10">
        <StaticRow label={techLabel} items={MARQUEE_TECH} />
        <StaticRow label={aiLabel} items={MARQUEE_AI} />
      </div>
    )
  }

  return (
    <div className="relative z-10 mt-10 space-y-0 overflow-hidden rounded-xl ring-1 ring-white/10">
      <MarqueeRow label={techLabel} items={MARQUEE_TECH} direction="left" ariaHidden />
      <MarqueeRow label={aiLabel} items={MARQUEE_AI} direction="right" ariaHidden />
    </div>
  )
}
