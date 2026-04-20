import { YIELD_SPREAD_DEC } from './treasuryYield'

/**
 * Calendar months spanned by transaction dates (inclusive), minimum 1 if any valid date exists.
 * @param {Array<{ date?: string }>} rows
 */
export function monthsSpannedByTransactions(rows) {
  const list = Array.isArray(rows) ? rows : []
  const times = []
  for (const r of list) {
    if (!r?.date) continue
    const t = new Date(r.date).getTime()
    if (Number.isFinite(t)) times.push(t)
  }
  if (!times.length) return 0
  const min = Math.min(...times)
  const max = Math.max(...times)
  const d0 = new Date(min)
  const d1 = new Date(max)
  const span = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth()) + 1
  return Math.max(1, span)
}

/**
 * @param {Array<{ amount?: number | string, date?: string }>} rows
 * @returns {{
 *   totalCash: number,
 *   totalOutflows: number,
 *   months: number,
 *   monthlyBurn: number,
 *   monthlyOppCost: number,
 *   baseRunwayMo: number | null,
 *   bearRunwayMo: number | null,
 *   bullRunwayMo: number | null,
 * }}
 */
export function computeRunwayFromTransactions(rows) {
  const list = Array.isArray(rows) ? rows : []
  let totalCash = 0
  let totalOutflows = 0

  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    totalCash += a
    if (a < 0) totalOutflows += Math.abs(a)
  }

  const months = monthsSpannedByTransactions(list)
  const monthlyBurn = months > 0 ? totalOutflows / months : 0
  const monthlyOppCost = totalCash > 0 ? (totalCash * YIELD_SPREAD_DEC) / 12 : 0

  let baseRunwayMo = null
  let bearRunwayMo = null
  let bullRunwayMo = null

  if (monthlyBurn > 0 && Number.isFinite(totalCash)) {
    baseRunwayMo = totalCash / monthlyBurn
    bearRunwayMo = totalCash / (monthlyBurn * 1.15)
    bullRunwayMo = (totalCash + monthlyOppCost) / monthlyBurn
  }

  return {
    totalCash,
    totalOutflows,
    months,
    monthlyBurn,
    monthlyOppCost,
    baseRunwayMo,
    bearRunwayMo,
    bullRunwayMo,
  }
}

/** Base runway below this (months) triggers fundraise planning alert. */
export const FUNDRAISE_RUNWAY_ALERT_MONTHS = 24
