/** Policy bands for operating liquidity (months of burn coverage). */
export const LIQUIDITY_MIN_MONTHS = 3
export const LIQUIDITY_TARGET_MONTHS = 6
export const LIQUIDITY_LOOKBACK_DAYS = 90

/**
 * @param {Array<{ amount?: number|string, date?: string }>} rows
 * @param {number} [nowMs]
 * @returns {{
 *   totalCash: number,
 *   monthlyBurn: number,
 *   bufferMonths: number | null,
 *   obligations3mo: number,
 *   bufferExcess: number,
 *   minCash3mo: number,
 *   targetCash6mo: number,
 *   eligibleForYield: number,
 *   band: 'red' | 'amber' | 'green',
 * }}
 */
export function computeLiquidityBuffer(rows, nowMs = Date.now()) {
  const list = Array.isArray(rows) ? rows : []
  let totalCash = 0
  for (const r of list) {
    const a = Number(r?.amount)
    if (Number.isFinite(a)) totalCash += a
  }

  const cutoff = nowMs - LIQUIDITY_LOOKBACK_DAYS * 86400000
  let outflow90 = 0
  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a) || a >= 0) continue
    const t = r?.date ? new Date(r.date).getTime() : NaN
    if (!Number.isFinite(t) || t < cutoff) continue
    outflow90 += -a
  }

  const monthlyBurn =
    outflow90 > 0 ? (outflow90 / LIQUIDITY_LOOKBACK_DAYS) * 30 : 0

  const obligations3mo = monthlyBurn * LIQUIDITY_MIN_MONTHS
  const targetCash6mo = monthlyBurn * LIQUIDITY_TARGET_MONTHS
  const minCash3mo = obligations3mo

  const bufferMonths = monthlyBurn > 0 ? totalCash / monthlyBurn : null
  const bufferExcess = totalCash - obligations3mo
  const eligibleForYield = Math.max(0, totalCash - targetCash6mo)

  let band = 'amber'
  if (monthlyBurn <= 0) {
    band = 'green'
  } else if (bufferMonths != null) {
    if (bufferMonths < LIQUIDITY_MIN_MONTHS) band = 'red'
    else if (bufferMonths <= LIQUIDITY_TARGET_MONTHS) band = 'amber'
    else band = 'green'
  }

  return {
    totalCash,
    monthlyBurn,
    bufferMonths,
    bufferExcess,
    obligations3mo,
    minCash3mo,
    targetCash6mo,
    eligibleForYield,
    band,
  }
}
