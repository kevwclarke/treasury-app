import { computeBurn30Vs90Pct } from './treasuryKpi'
import { YIELD_SPREAD_DEC } from './treasuryYield'

function parseDate(str) {
  if (!str) return null
  const d = new Date(String(str).trim())
  return isNaN(d.getTime()) ? null : d
}

function latestTransactionDate(rows) {
  let latest = null
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = parseDate(r.date)
    if (!d) continue
    if (!latest || d > latest) latest = d
  }
  return latest
}

/**
 * Calendar months spanned by transaction dates (inclusive), minimum 1 if any valid date exists.
 * @param {Array<{ date?: string }>} rows
 */
export function monthsSpannedByTransactions(rows) {
  const list = Array.isArray(rows) ? rows : []
  const times = []
  for (const r of list) {
    const d = parseDate(r?.date)
    if (!d) continue
    times.push(d.getTime())
  }
  if (!times.length) return 0
  const min = Math.min(...times)
  const max = Math.max(...times)
  const d0 = new Date(min)
  const d1 = new Date(max)
  const span = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth()) + 1
  return Math.max(1, span)
}

function totalOutflowsInBurnWindow(rows, anchor) {
  const list = Array.isArray(rows) ? rows : []
  const anchorYear = anchor.getFullYear()
  const anchorMonth = anchor.getMonth() + 1
  let total = 0
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date(anchorYear, anchorMonth - 1 - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    for (const r of list) {
      const rd = parseDate(r.date)
      if (!rd) continue
      const key = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}`
      if (key !== ym) continue
      const a = Number(r.amount)
      if (Number.isFinite(a) && a < 0) total += Math.abs(a)
    }
  }
  return total
}

/**
 * @param {Array<{ amount?: number | string, date?: string, running_balance?: number|null }>} rows
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

  let hasRunning = false
  let newestRunningT = -Infinity
  let newestRunningBal = null

  for (const r of list) {
    const a = Number(r?.amount)
    if (Number.isFinite(a)) {
      totalCash += a
    }

    const rb = Number(r?.running_balance)
    if (Number.isFinite(rb) && r?.date) {
      const d = parseDate(r.date)
      if (!d) continue
      const t = d.getTime()
      hasRunning = true
      if (t >= newestRunningT) {
        newestRunningT = t
        newestRunningBal = rb
      }
    }
  }

  if (hasRunning && newestRunningBal != null) {
    totalCash = newestRunningBal
  }

  const anchor = latestTransactionDate(list)
  const burnKpi = computeBurn30Vs90Pct(list)
  const monthlyBurn = burnKpi?.monthlyBurn90 ?? 0
  const totalOutflows = anchor ? totalOutflowsInBurnWindow(list, anchor) : 0
  const months = anchor ? 3 : monthsSpannedByTransactions(list)

  const monthlyOppCost = totalCash > 0 ? (totalCash * YIELD_SPREAD_DEC) / 12 : 0

  let baseRunwayMo = null
  let bearRunwayMo = null
  let bullRunwayMo = null

  if (monthlyBurn > 0 && Number.isFinite(totalCash)) {
    baseRunwayMo = totalCash / monthlyBurn
    bearRunwayMo = baseRunwayMo * (1 / 1.15)
    bullRunwayMo = baseRunwayMo * 1.08
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
