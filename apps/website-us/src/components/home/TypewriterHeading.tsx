'use client'

import { useReducedMotion } from 'framer-motion'
import { useSequentialTypewriter } from '@/hooks/use-sequential-typewriter'

type TypewriterHeadingProps = {
  title: string
  highlight: string
}

export function TypewriterHeading({ title, highlight }: TypewriterHeadingProps) {
  const reduceMotion = useReducedMotion()
  const enabled = !reduceMotion
  const { line1, line2, phase } = useSequentialTypewriter(title, highlight, enabled)

  const showCursor = enabled && phase !== 'done'

  return (
    <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-[3.25rem]">
      <span className="block min-h-[1.2em]">
        {line1}
        {phase === 'first' && showCursor ? (
          <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-cyan-400 align-baseline" aria-hidden />
        ) : null}
      </span>
      <span className="mt-1 block min-h-[1.2em] bg-linear-to-r from-violet-300 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
        {line2}
        {(phase === 'second' || phase === 'between') && showCursor ? (
          <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-cyan-300 align-baseline" aria-hidden />
        ) : null}
      </span>
    </h1>
  )
}
