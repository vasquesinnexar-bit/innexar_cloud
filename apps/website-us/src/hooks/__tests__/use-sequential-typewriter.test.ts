import { renderHook } from '@testing-library/react'
import { useSequentialTypewriter } from '@/hooks/use-sequential-typewriter'

describe('useSequentialTypewriter', () => {
  it('when disabled, exposes full strings immediately', () => {
    const { result } = renderHook(() => useSequentialTypewriter('Hello', 'World', false))

    expect(result.current.line1).toBe('Hello')
    expect(result.current.line2).toBe('World')
    expect(result.current.phase).toBe('done')
  })
})
