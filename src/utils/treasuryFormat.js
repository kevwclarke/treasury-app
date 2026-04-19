export function formatGBP(value, opts = {}) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
  }).format(value)
}

export function formatPct(value, digits = 1) {
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}
