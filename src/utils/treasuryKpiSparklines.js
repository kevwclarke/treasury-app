import { YIELD_CURRENT_PCT } from './treasuryYield'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function isOpeningBalanceRow(r) {
  const desc = String(r?.description ?? '').toUpperCase()
  const payee = String(r?.payee ?? '').toUpperCase()
  return desc.includes('OPENING BALANCE') || payee.includes('OPENING BALANCE')
}

/** Transactions used for KPI sparklines (excludes synthetic opening-balance rows). */
function filterSparklineRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  return list.filter((r) => !isOpeningBalanceRow(r))
}

/** Last six fully completed calendar months (excludes the current month), as YYYY-MM. */
export function lastSixMonthKeys(now = new Date()) {
  const keys = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)
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

/** Calendar month of `now` as YYYY-MM (incomplete month for sparklines). */
function currentCalendarYm(now) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

/**
 * Opening-balance rows removed; rows in the current (incomplete) calendar month removed.
 */
function sparklineBaseRows(rows, now = new Date()) {
  const cy = currentCalendarYm(now)
  return filterSparklineRows(rows).filter((r) => {
    const mk = monthKeyLocal(r.date)
    return mk != null && mk !== cy
  })
}

export function computeTotalCashSparkline(rows, now = new Date()) {
  const base = sparklineBaseRows(rows, now)
  if (!base.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym) => {
    const monthRows = base.filter((r) => monthKeyLocal(r.date) === ym)
    if (!monthRows.length) return null
    const sorted = monthRows.sort((a, b) => new Date(b.date) - new Date(a.date))
    const latest = sorted[0]
    if (latest.running_balance != null && Number.isFinite(Number(latest.running_balance))) {
      return Number(latest.running_balance)
    }
    return null
  })
}

export function computeBurnSparkline(rows, now = new Date()) {
  const base = sparklineBaseRows(rows, now)
  if (!base.length) return null
  const keys = lastSixMonthKeys(now)
  return keys.map((ym) => {
    const monthRows = base.filter((r) => monthKeyLocal(r.date) === ym)
    if (!monthRows.length) return null
    let total = 0
    monthRows.forEach((r) => {
      const a = Number(r.amount)
      if (Number.isFinite(a) && a < 0) total += Math.abs(a)
    })
    return total
  })
}

/**
 * Runway months at each complete month: that month's ending balance ÷ average monthly burn across the six months.
 * @returns {number[] | null}
 */
export function computeRunwaySparkline(rows, now = new Date()) {
  const balances = computeTotalCashSparkline(rows, now)
  const burns = computeBurnSparkline(rows, now)
  if (!balances?.length || !burns?.length) return null
  const n = Math.min(balances.length, burns.length)
  let burnSum = 0
  for (let i = 0; i < n; i += 1) burnSum += burns[i]
  const avgBurn = n > 0 ? burnSum / n : 0
  if (!(avgBurn > 0)) {
    return balances.map(() => 0)
  }
  return balances.map((b) => (Number.isFinite(b) ? b / avgBurn : 0))
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
