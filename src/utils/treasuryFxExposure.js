/**
 * Heuristic FX exposure from payee text (matches FX detail page behaviour).
 * @param {Array<{ payee?: string }>} rows
 * @returns {{ code: string, pair: string, monthlyFc: number, gbp: number }[]}
 */
export function detectFxExposureFromPayees(rows) {
  const list = Array.isArray(rows) ? rows : []
  const pairs = []
  list.forEach((t) => {
    const p = String(t.payee ?? '').toLowerCase()
    if (/\busd\b|\$|dollar/.test(p) && !pairs.find((x) => x.code === 'USD')) {
      pairs.push({ code: 'USD', pair: 'USD → GBP', monthlyFc: 182_000, gbp: 142_600 })
    }
    if (/\beur\b|€|euro/.test(p) && !pairs.find((x) => x.code === 'EUR')) {
      pairs.push({ code: 'EUR', pair: 'EUR → GBP', monthlyFc: 96_400, gbp: 82_900 })
    }
  })
  return pairs
}

/**
 * @param {Array<{ payee?: string }>} rows
 */
export function summarizeFxExposure(rows) {
  const pairs = detectFxExposureFromPayees(rows)
  const totalUnhedgedGbp = pairs.reduce((s, x) => s + x.gbp, 0)
  const fivePctOnMonthlyBurn = pairs.reduce((s, x) => s + x.gbp * 0.05, 0)
  return {
    hasMultiCurrency: pairs.length > 0,
    pairs,
    totalUnhedgedGbp,
    fivePctOnMonthlyBurn,
  }
}
