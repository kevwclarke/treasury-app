import { monthsSpannedByTransactions } from './treasuryRunway'

function monthKeyFromIso(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function padMonth(y, m0) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}`
}

/** Inclusive list of YYYY-MM from first calendar month through last. */
function monthKeysBetween(minMs, maxMs) {
  const d0 = new Date(minMs)
  const d1 = new Date(maxMs)
  const keys = []
  let y = d0.getFullYear()
  let m = d0.getMonth()
  const endY = d1.getFullYear()
  const endM = d1.getMonth()
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(padMonth(y, m))
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return keys
}

function addMonthsToKey(ym, delta) {
  const [ys, ms] = ym.split('-').map(Number)
  const d = new Date(ys, ms - 1 + delta, 1)
  return padMonth(d.getFullYear(), d.getMonth())
}

function parseKey(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).getTime()
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  if (!s.length) return 0
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * @param {Array<{ amount?: number|string, date?: string, payee?: string }>} rows
 */
export function computeCashflowSummary(rows) {
  const list = Array.isArray(rows) ? rows : []
  let totalIn = 0
  let totalOutAbs = 0
  let hasRunning = false
  let newestRunningT = -Infinity
  let newestRunningBal = null
  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    if (a > 0) totalIn += a
    if (a < 0) totalOutAbs += -a

    const rb = Number(r?.running_balance)
    if (Number.isFinite(rb) && r?.date) {
      const t = new Date(r.date).getTime()
      if (Number.isFinite(t)) {
        hasRunning = true
        if (t >= newestRunningT) {
          newestRunningT = t
          newestRunningBal = rb
        }
      }
    }
  }
  const months = monthsSpannedByTransactions(list)
  const avgMonthlyIn = months > 0 ? totalIn / months : 0
  const avgMonthlyOut = months > 0 ? totalOutAbs / months : 0
  const netMonthly = avgMonthlyIn - avgMonthlyOut
  let totalCash = list.reduce((s, r) => {
    const a = Number(r?.amount)
    return s + (Number.isFinite(a) ? a : 0)
  }, 0)

  if (hasRunning && newestRunningBal != null) {
    totalCash = newestRunningBal
  }

  return {
    months,
    avgMonthlyIn,
    avgMonthlyOut,
    netMonthly,
    totalIn,
    totalOutAbs,
    totalCash,
  }
}

/**
 * Monthly net actuals + projected months (avg in − out) until last txn + horizonDays.
 * @returns {Array<{ key: string, label: string, net: number, proj: boolean }>}
 */
export function buildCashflowMonthlySeries(rows, summary, horizonDays = 90) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r?.date)
  if (!list.length) return []

  const times = list.map((r) => new Date(r.date).getTime()).filter(Number.isFinite)
  const minT = Math.min(...times)
  const maxT = Math.max(...times)

  const netByMonth = new Map()
  for (const r of list) {
    const k = monthKeyFromIso(r.date)
    if (!k) continue
    const a = Number(r.amount)
    if (!Number.isFinite(a)) continue
    netByMonth.set(k, (netByMonth.get(k) || 0) + a)
  }

  const monthShortYear = (key) => {
    const [y, m] = key.split('-').map(Number)
    const mon = new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short' })
    return `${mon} '${String(y).slice(-2)}`
  }

  const actualKeys = monthKeysBetween(minT, maxT)
  const series = actualKeys.map((key) => ({
    key,
    label: monthShortYear(key),
    net: netByMonth.get(key) || 0,
    proj: false,
  }))

  const lastKey = actualKeys[actualKeys.length - 1]
  const horizonEnd = maxT + horizonDays * 86400000
  const projNet = summary.avgMonthlyIn - summary.avgMonthlyOut

  let projKey = addMonthsToKey(lastKey, 1)
  while (parseKey(projKey) <= horizonEnd) {
    series.push({
      key: projKey,
      label: monthShortYear(projKey),
      net: projNet,
      proj: true,
    })
    projKey = addMonthsToKey(projKey, 1)
  }

  return series
}

/** Bar height % (5–100) from signed net vs max magnitude. */
export function seriesToBarHeights(series) {
  const maxAbs = Math.max(1e-6, ...series.map((s) => Math.abs(s.net)))
  return series.map((s) => ({
    ...s,
    hPct: 5 + (Math.abs(s.net) / maxAbs) * 95,
    neg: s.net < 0,
  }))
}

/**
 * Recurring only if some calendar day-of-month anchor (1–31) exists such that the payee has
 * at least one transaction within ±3 days of that anchor in each of 2+ distinct calendar months.
 * @returns {Array<{ payee: string, amount: number, frequency: string, nextExpected: string }>}
 */
export function detectRecurringTransactions(rows) {
  const list = Array.isArray(rows) ? rows : []
  /** @type {Map<string, Map<string, Array<{ date: string, t: number, dom: number, ym: string, amount: number }>>>} */
  const byPayee = new Map()
  for (const r of list) {
    const p = String(r.payee ?? '').trim()
    if (!p) continue
    const a = Number(r.amount)
    if (!Number.isFinite(a)) continue
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) continue
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const dom = d.getDate()
    if (!byPayee.has(p)) byPayee.set(p, new Map())
    const byMonth = byPayee.get(p)
    if (!byMonth.has(ym)) byMonth.set(ym, [])
    byMonth.get(ym).push({ date: r.date, t: d.getTime(), dom, ym, amount: a })
  }

  const out = []
  for (const [payee, byMonth] of byPayee) {
    if (byMonth.size < 2) continue

    let bestAnchor = null
    let bestMonthCount = 0
    let bestSpread = Infinity
    /** @type {Array<{ date: string, t: number, dom: number, ym: string, amount: number }>} */
    let bestMatched = []

    for (let anchor = 1; anchor <= 31; anchor += 1) {
      const qualifyingMonths = new Set()
      let spreadSum = 0
      const matched = []
      for (const [ym, entries] of byMonth) {
        let minDev = Infinity
        for (const e of entries) {
          const dev = Math.abs(e.dom - anchor)
          if (dev <= 3) {
            minDev = Math.min(minDev, dev)
            matched.push(e)
          }
        }
        if (minDev < Infinity) {
          qualifyingMonths.add(ym)
          spreadSum += minDev
        }
      }
      const mc = qualifyingMonths.size
      if (mc < 2) continue
      const better =
        mc > bestMonthCount ||
        (mc === bestMonthCount && spreadSum < bestSpread) ||
        (mc === bestMonthCount && spreadSum === bestSpread && bestAnchor !== null && anchor < bestAnchor)
      if (better) {
        bestMonthCount = mc
        bestSpread = spreadSum
        bestAnchor = anchor
        bestMatched = matched
      }
    }

    if (bestAnchor === null || bestMatched.length === 0) continue

    const absAmts = bestMatched.map((x) => Math.abs(x.amount))
    const amount = median(absAmts)

    const last = bestMatched.reduce((a, b) => (a.t > b.t ? a : b))
    const lastD = new Date(last.t)
    const next = new Date(lastD.getFullYear(), lastD.getMonth() + 1, 1)
    const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(bestAnchor, dim))
    const nextIso = next.toISOString().slice(0, 10)

    out.push({
      payee,
      amount,
      frequency: 'Monthly',
      nextExpected: nextIso,
    })
  }
  out.sort((a, b) => a.payee.localeCompare(b.payee))
  return out
}

/** True if projected balance (weekly steps from current net cash) dips below one month of average outflow. */
export function cashflowWeeklyLowCashWarning(summary, weeks = 13) {
  const { totalCash, netMonthly, avgMonthlyOut } = summary
  if (!Number.isFinite(avgMonthlyOut) || avgMonthlyOut <= 0) return false
  const weeklyNet = netMonthly * (7 / 30.437)
  for (let w = 1; w <= weeks; w += 1) {
    const bal = totalCash + weeklyNet * w
    if (bal < avgMonthlyOut) return true
  }
  return false
}
