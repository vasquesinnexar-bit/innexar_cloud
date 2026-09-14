'use client'

import { useState, useEffect } from 'react'

const DEFAULT_SPEED_MS = 38
const DEFAULT_PAUSE_MS = 380

type Phase = 'first' | 'between' | 'second' | 'done'

export function useSequentialTypewriter(
  first: string,
  second: string,
  enabled: boolean,
  speedMs = DEFAULT_SPEED_MS,
  pauseMs = DEFAULT_PAUSE_MS
): { line1: string; line2: string; phase: Phase } {
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [phase, setPhase] = useState<Phase>('first')

  useEffect(() => {
    if (!enabled) {
      setLine1(first)
      setLine2(second)
      setPhase('done')
      return
    }

    let cancelled = false
    setLine1('')
    setLine2('')
    setPhase('first')

    const typeFirst = (i: number) => {
      if (cancelled) return
      setLine1(first.slice(0, i))
      if (i < first.length) {
        window.setTimeout(() => typeFirst(i + 1), speedMs)
      } else {
        setPhase('between')
        window.setTimeout(() => {
          if (cancelled) return
          setPhase('second')
          const typeSecond = (j: number) => {
            if (cancelled) return
            setLine2(second.slice(0, j))
            if (j < second.length) {
              window.setTimeout(() => typeSecond(j + 1), speedMs)
            } else {
              setPhase('done')
            }
          }
          typeSecond(0)
        }, pauseMs)
      }
    }

    typeFirst(0)

    return () => {
      cancelled = true
    }
  }, [first, second, enabled, speedMs, pauseMs])

  return { line1, line2, phase }
}
