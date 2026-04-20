export function formatGBP(value, opts = {}) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
  }).format(value)
}

/** Axis-style labels e.g. £0, £50k, £150k */
export function formatCompactAxisGBP(value) {
  const n = Math.abs(Number(value) || 0)
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return m % 1 === 0 ? `£${m}m` : `£${m.toFixed(1)}m`
  }
  if (n >= 1000) {
    const k = n / 1000
    return Number.isInteger(k) ? `£${k}k` : `£${k.toFixed(0)}k`
  }
  return `£${Math.round(n)}`
}

export function formatPct(value, digits = 1) {
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}
