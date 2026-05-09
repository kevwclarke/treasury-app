import { YIELD_CURRENT_PCT } from './treasuryYield'
import { computeBurn30Vs90Pct, computeTotalCashAndMoMNetDelta } from './treasuryKpi'
import { computeRunwayFromTransactions } from './treasuryRunway'

function parseDate(str) {
  if (!str) return null
  const d = new Date(String(str).trim())
  return isNaN(d.getTime()) ? null : d
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function monthKeyFromDate(d) {
  if (!d) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function monthKeyFromRow(row) {
  return monthKeyFromDate(parseDate(row?.date))
}

function isCompleteMonth(rows, ym) {
  let n = 0
  for (const r of rows) {
    if (monthKeyFromRow(r) === ym) n += 1
  }
  return n >= 3
}

function distinctSortedMonthKeys(rows) {
  const set = new Set()
  for (const r of rows) {
    const k = monthKeyFromRow(r)
    if (k) set.add(k)
  }
  return Array.from(set).sort()
}

/** Last up to 6 calendar months that each have at least 3 transaction rows with valid dates (data-driven). */
export function lastSixMonthKeys(rows) {
  const list = Array.isArray(rows) ? rows : []
  const complete = distinctSortedMonthKeys(list).filter((ym) => isCompleteMonth(list, ym))
  return complete.slice(-6)
}

export function computeTotalCashSparkline(rows) {
  const keys = lastSixMonthKeys(rows)
  if (!keys.length) return null

  const kpi = computeTotalCashAndMoMNetDelta(rows)
  const totalCash = kpi?.totalCash ?? null

  const out = keys.map((ym) => {
    let bestT = -Infinity
    let bestBal = null
    const list = Array.isArray(rows) ? rows : []
    for (const r of list) {
      if (monthKeyFromRow(r) !== ym) continue
      const rb = r?.running_balance
      if (rb == null || !Number.isFinite(Number(rb))) continue
      const d = parseDate(r.date)
      if (!d) continue
      const t = d.getTime()
      if (t >= bestT) {
        bestT = t
        bestBal = Number(rb)
      }
    }
    return bestBal
  })

  if (totalCash != null && out.length) {
    out[out.length - 1] = totalCash
  }

  if (out.every((v) => v == null)) return null
  return out
}

export function computeBurnSparkline(rows) {
  const keys = lastSixMonthKeys(rows)
  if (!keys.length) return null
  const list = Array.isArray(rows) ? rows : []

  const out = keys.map((ym) => {
    let total = 0
    for (const r of list) {
      if (monthKeyFromRow(r) !== ym) continue
      const a = Number(r.amount)
      if (Number.isFinite(a) && a < 0) total += Math.abs(a)
    }
    return total
  })

  const burnKpi = computeBurn30Vs90Pct(rows)
  if (burnKpi != null && out.length) {
    out[out.length - 1] = burnKpi.monthlyBurn90
  }

  return out
}

/**
 * Runway months: each month’s cash (from total cash sparkline) ÷ average monthly burn across the six months.
 * @returns {number[] | null}
 */
export function computeRunwaySparkline(rows) {
  const balances = computeTotalCashSparkline(rows)
  const burns = computeBurnSparkline(rows)
  if (!balances?.length || !burns?.length) return null
  const n = Math.min(balances.length, burns.length)
  let burnSum = 0
  let burnCount = 0
  for (let i = 0; i < n; i += 1) {
    const b = burns[i]
    if (b != null && Number.isFinite(b)) {
      burnSum += b
      burnCount += 1
    }
  }
  const avgBurn = burnCount > 0 ? burnSum / burnCount : 0
  let out
  if (!(avgBurn > 0)) {
    out = balances.map((bal) => (bal != null && Number.isFinite(bal) ? 0 : null))
  } else {
    out = balances.map((bal) => (bal != null && Number.isFinite(bal) ? bal / avgBurn : null))
  }

  const runway = computeRunwayFromTransactions(rows)
  const base = runway?.baseRunwayMo
  if (base != null && Number.isFinite(base) && out.length) {
    out[out.length - 1] = base
  }

  return out
}

/** Flat effective yield series (hardcoded current rate). */
export function computeYieldSparklineFlat() {
  return Array.from({ length: 6 }, () => YIELD_CURRENT_PCT)
}

/**
 * Merge month keys with numeric series for charting (X labels, tooltip title).
 * @param {number[] | null} values
 * @param {string[]} monthKeys YYYY-MM keys (same length and order as values)
 * @returns {Array<{ xLabel: string, monthKey: string, tooltipLabel: string, value: number }> | null}
 */
export function kpiChartPoints(values, monthKeys) {
  if (!values?.length || !monthKeys?.length) return null
  const len = Math.min(values.length, monthKeys.length)
  return Array.from({ length: len }, (_, i) => {
    const ym = monthKeys[i]
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1, 15)
    const raw = values[i]
    return {
      xLabel: d.toLocaleString('en-GB', { month: 'short' }),
      monthKey: ym,
      tooltipLabel: d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
      value: Number.isFinite(raw) ? raw : 0,
    }
  })
}
