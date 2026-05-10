function parseDate(str) {
  if (!str) return null
  const d = new Date(String(str).trim())
  return isNaN(d.getTime()) ? null : d
}

/** Same as treasuryKpi.js — latest calendar date among rows with a valid date. */
function latestTransactionDate(rows) {
  let latest = null
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = parseDate(r.date)
    if (!d) continue
    if (!latest || d > latest) latest = d
  }
  return latest
}

function monthKeyFromRow(row) {
  return monthKeyFromDate(parseDate(row?.date))
}

/** A month is complete if it has at least 3 transaction rows with valid dates (treasuryKpi pattern). */
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

function completeMonthKeysSorted(rows) {
  return distinctSortedMonthKeys(rows).filter((ym) => isCompleteMonth(rows, ym))
}

function endOfDayMs(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

function monthKeyFromDate(d) {
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyFromIso(iso) {
  const d = parseDate(iso)
  return monthKeyFromDate(d)
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

/** Last 3 calendar months ending at the anchor transaction month (inclusive). */
function lastThreeMonthKeysEndingAtAnchor(anchorMs) {
  const anchorDate = new Date(anchorMs)
  const y = anchorDate.getFullYear()
  const m0 = anchorDate.getMonth()
  const keys = []
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date(y, m0 - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

/**
 * @param {Array<{ amount?: number|string, date?: string, payee?: string }>} rows
 */
export function computeCashflowSummary(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) {
    return {
      months: 0,
      avgMonthlyIn: 0,
      avgMonthlyOut: 0,
      netMonthly: 0,
      totalIn: 0,
      totalOutAbs: 0,
      totalCash: 0,
      startingCash: 0,
    }
  }

  const anchor = latestTransactionDate(list)
  if (!anchor) {
    return {
      months: 0,
      avgMonthlyIn: 0,
      avgMonthlyOut: 0,
      netMonthly: 0,
      totalIn: 0,
      totalOutAbs: 0,
      totalCash: 0,
      startingCash: 0,
    }
  }

  const anchorMs = anchor.getTime()
  const anchorEndMs = endOfDayMs(anchor)
  const anchorYm = monthKeyFromDate(anchor)

  const completeKeys = completeMonthKeysSorted(list)
  const eligibleComplete = completeKeys.filter((ym) => ym <= anchorYm)
  let windowKeyList = eligibleComplete.slice(-3)
  let windowKeys = new Set(windowKeyList)
  if (windowKeyList.length === 0) {
    windowKeyList = lastThreeMonthKeysEndingAtAnchor(anchorMs)
    windowKeys = new Set(windowKeyList)
  }

  const months = Math.max(1, windowKeyList.length)

  const byMonthInAmts = new Map()
  const byMonthOutAmts = new Map()
  for (const r of list) {
    const d = parseDate(r?.date)
    if (!d || d.getTime() > anchorEndMs) continue
    const mk = monthKeyFromDate(d)
    if (!mk || !windowKeys.has(mk)) continue
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    if (a > 0) {
      if (!byMonthInAmts.has(mk)) byMonthInAmts.set(mk, [])
      byMonthInAmts.get(mk).push(a)
    } else if (a < 0) {
      if (!byMonthOutAmts.has(mk)) byMonthOutAmts.set(mk, [])
      byMonthOutAmts.get(mk).push(-a)
    }
  }

  const medianInByMonth = new Map()
  const medianOutByMonth = new Map()
  for (const mk of windowKeys) {
    medianInByMonth.set(mk, median(byMonthInAmts.get(mk) ?? []))
    medianOutByMonth.set(mk, median(byMonthOutAmts.get(mk) ?? []))
  }

  let totalIn = 0
  let totalOutAbs = 0

  let hasRunning = false
  let newestRunningT = -Infinity
  let newestRunningBal = null

  for (const r of list) {
    const d = parseDate(r?.date)
    if (!d || d.getTime() > anchorEndMs) continue

    const mk = monthKeyFromDate(d)
    if (!mk || !windowKeys.has(mk)) continue

    const a = Number(r?.amount)
    if (Number.isFinite(a)) {
      if (a > 0) {
        const medIn = medianInByMonth.get(mk) ?? 0
        const capIn = medIn > 0 ? 3 * medIn : Infinity
        if (a <= capIn) totalIn += a
      }
      if (a < 0) {
        const medOut = medianOutByMonth.get(mk) ?? 0
        const capOut = medOut > 0 ? 3 * medOut : Infinity
        if (-a <= capOut) totalOutAbs += -a
      }
    }

    const rb = Number(r?.running_balance)
    if (Number.isFinite(rb) && r?.date) {
      const t = d.getTime()
      if (Number.isFinite(t)) {
        hasRunning = true
        if (t >= newestRunningT) {
          newestRunningT = t
          newestRunningBal = rb
        }
      }
    }
  }

  const avgMonthlyIn = totalIn / months
  const avgMonthlyOut = totalOutAbs / months
  const netMonthly = avgMonthlyIn - avgMonthlyOut

  let totalCash = list.reduce((s, r) => {
    const a = Number(r?.amount)
    return s + (Number.isFinite(a) ? a : 0)
  }, 0)

  if (hasRunning && newestRunningBal != null) {
    totalCash = newestRunningBal
  }

  const startingCashRow = list.reduce((best, r) => {
    const rb = Number(r?.running_balance)
    if (!Number.isFinite(rb)) return best
    const d = new Date(String(r.date).trim())
    if (isNaN(d.getTime())) return best
    return !best || d > new Date(String(best.date).trim()) ? r : best
  }, null)
  const startingCash = Number(startingCashRow?.running_balance) || 0

  return {
    months,
    avgMonthlyIn,
    avgMonthlyOut,
    netMonthly,
    totalIn,
    totalOutAbs,
    totalCash,
    startingCash,
  }
}

function startOfWeekMonday(d) {
  const x = new Date(d)
  const dow = x.getDay()
  const diff = (dow + 6) % 7
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Weekly cumulative cash for the 90-day chart: actual weekly nets, then projected from summary.netMonthly.
 * Cumulative balance is shifted so the last actual week matches latest running_balance (startingCash), not £0.
 */
export function buildWeeklyCashChartData(rows, summary, numWeeks = 13) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r?.date)
  if (!list.length) return []

  const times = list.map((r) => new Date(String(r.date).trim()).getTime()).filter(Number.isFinite)
  const maxT = Math.max(...times)

  const weeklyNetAvg = summary.netMonthly * (7 / 30.437)

  let ws = startOfWeekMonday(new Date(Math.min(...times)))
  const projectionEnd = addDays(startOfWeekMonday(new Date(maxT)), numWeeks * 7)

  const raw = []
  while (ws.getTime() <= projectionEnd.getTime()) {
    const we = addDays(ws, 7)
    let net = 0
    let isProj = false

    if (ws.getTime() > maxT) {
      net = weeklyNetAvg
      isProj = true
    } else {
      for (const r of list) {
        const t = new Date(String(r.date).trim()).getTime()
        if (t >= ws.getTime() && t < we.getTime()) {
          const a = Number(r.amount)
          if (Number.isFinite(a)) net += a
        }
      }
    }

    raw.push({
      label: ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      net,
      isProj,
    })
    ws = addDays(ws, 7)
  }

  let cum = 0
  const withCum = raw.map((p) => {
    cum += p.net
    return { ...p, cum }
  })

  let lastAct = -1
  withCum.forEach((p, i) => {
    if (!p.isProj) lastAct = i
  })

  const rbBaseline = Number(summary?.startingCash)
  let offset = 0
  if (lastAct >= 0) {
    if (Number.isFinite(rbBaseline) && rbBaseline !== 0) {
      offset = rbBaseline - withCum[lastAct].cum
    } else if (Number.isFinite(summary?.totalCash)) {
      offset = summary.totalCash - withCum[lastAct].cum
    }
  }

  const shifted = withCum.map((p) => ({ ...p, cum: p.cum + offset }))

  const chartData = shifted.map((p) => ({
    label: p.label,
    act: p.isProj ? null : p.cum,
    proj: p.isProj ? p.cum : null,
  }))

  if (lastAct >= 0 && lastAct < chartData.length - 1 && chartData[lastAct].act != null) {
    chartData[lastAct].proj = chartData[lastAct].act
  }

  return chartData
}

/**
 * Monthly net actuals + projected months (avg in − out) until last txn + horizonDays.
 * @returns {Array<{ key: string, label: string, net: number, proj: boolean }>}
 */
export function buildCashflowMonthlySeries(rows, summary, horizonDays = 90) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r?.date)
  if (!list.length) return []

  const anchorT = list.reduce((max, r) => {
    const d = new Date(String(r.date).trim())
    return isNaN(d.getTime()) ? max : Math.max(max, d.getTime())
  }, -Infinity)
  if (!Number.isFinite(anchorT) || anchorT <= 0) return []

  const anchorMs = anchorT

  const times = list.map((r) => parseDate(r.date)?.getTime()).filter(Number.isFinite)
  const minT = Math.min(...times)
  const maxT = anchorMs

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
  const horizonEnd = anchorMs + horizonDays * 86400000
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
    const d = parseDate(r.date)
    if (!d) continue
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
