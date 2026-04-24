import { useEffect, useState } from 'react'

/**
 * Animates a numeric value from 0 toward `endValue` when `enabled` becomes true.
 * @param {number} endValue
 * @param {{ duration?: number, enabled?: boolean }} opts
 */
export function useCountUp(endValue, { duration = 850, enabled = true } = {}) {
  const [v, setV] = useState(() => (enabled ? 0 : endValue))

  useEffect(() => {
    if (!enabled || endValue == null || !Number.isFinite(endValue)) {
      setV(endValue ?? 0)
      return undefined
    }

    let raf = 0
    const start = performance.now()
    const from = 0
    const delta = endValue - from

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 2.4
      setV(from + delta * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setV(endValue)
    }

    setV(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [endValue, duration, enabled])

  return v
}
