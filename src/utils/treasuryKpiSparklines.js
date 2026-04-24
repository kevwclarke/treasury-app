import { computeRunwayFromTransactions } from './treasuryRunway'
import { YIELD_CURRENT_PCT } from './treasuryYield'

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Last six calendar months from (now - 5 months) through current month, as YYYY-MM. */
export function lastSixMonthKeys(now = new Date()) {
  const keys = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  return keys
}

/** End of calendar month (local) for key `YYYY-MM`, inclusive ms. */
export function endOfMonthMsForYm(ym) {
  const [y, m] = ym.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m)) return NaN
  return new Date(y, m, 0, 23, 59, 59, 999).getTime()
}

function monthKeyLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/**
 * Cumulative net cash at end of each of the last 6 months.
 * @returns {number[] | null}
 */
export function computeTotalCashSparkline(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym) => {
    const endMs = endOfMonthMsForYm(ym)
    let s = 0
    for (const r of list) {
      const t = new Date(r.date).getTime()
      if (!Number.isFinite(t) || t > endMs) continue
      const a = Number(r.amount)
      if (Number.isFinite(a)) s += a
    }
    return s
  })
}

/**
 * Runway (months) at end of each of the last 6 months using transactions through that date only.
 * @returns {number[] | null}
 */
export function computeRunwaySparkline(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym) => {
    const endMs = endOfMonthMsForYm(ym)
    const slice = list.filter((r) => {
      const t = new Date(r.date).getTime()
      return Number.isFinite(t) && t <= endMs
    })
    const { baseRunwayMo } = computeRunwayFromTransactions(slice)
    if (baseRunwayMo != null && Number.isFinite(baseRunwayMo)) return baseRunwayMo
    return 0
  })
}

function monthlyOutflowPositive(rows, ym) {
  let s = 0
  for (const r of rows) {
    if (monthKeyLocal(r.date) !== ym) continue
    const a = Number(r.amount)
    if (Number.isFinite(a) && a < 0) s += -a
  }
  return s
}

/**
 * Total outflows (positive £) per calendar month for the last 6 months.
 * @returns {number[] | null}
 */
export function computeBurnSparkline(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym) => monthlyOutflowPositive(list, ym))
}

/** Flat effective yield series (hardcoded current rate). */
export function computeYieldSparklineFlat() {
  return Array.from({ length: 6 }, () => YIELD_CURRENT_PCT)
}

/**
 * Merge last-six-month keys with numeric series for charting (X labels, tooltip title).
 * @param {number[] | null} values
 * @param {Date} [now]
 * @returns {Array<{ xLabel: string, monthKey: string, tooltipLabel: string, value: number }> | null}
 */
export function kpiChartPoints(values, now = new Date()) {
  if (!values?.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym, i) => {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1, 15)
    return {
      xLabel: d.toLocaleString('en-GB', { month: 'short' }),
      monthKey: ym,
      tooltipLabel: d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
      value: Number.isFinite(values[i]) ? values[i] : 0,
    }
  })
}
