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

/** A month is complete if it has at least 3 transaction rows with valid dates. */
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

function monthHasRunningBalanceRow(rows, ym) {
  for (const r of rows) {
    if (monthKeyFromRow(r) !== ym) continue
    const rb = r?.running_balance
    if (rb != null && Number.isFinite(Number(rb))) return true
  }
  return false
}

function lastRunningBalanceInMonth(rows, ym) {
  let bestT = -Infinity
  let bestBal = null
  for (const r of rows) {
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
}

/**
 * Total cash (latest running balance) and month-over-month change from complete months only.
 * @param {Array<{ amount?: number|string, date?: string, running_balance?: number|null }>} rows
 * @param {Date} [_now]
 * @returns {{ totalCash: number, netThisMonth: number, netPrevMonth: number | null, deltaNet: number | null } | null}
 */
export function computeTotalCashAndMoMNetDelta(rows, _now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null

  let totalCash = null
  let latestT = -Infinity
  for (const r of list) {
    const rb = r?.running_balance
    if (rb == null || !Number.isFinite(Number(rb))) continue
    const d = parseDate(r.date)
    if (!d) continue
    const t = d.getTime()
    if (t >= latestT) {
      latestT = t
      totalCash = Number(rb)
    }
  }

  if (totalCash == null) return null

  const completeWithRb = completeMonthKeysSorted(list).filter((ym) =>
    monthHasRunningBalanceRow(list, ym),
  )

  if (!completeWithRb.length) {
    return { totalCash, netThisMonth: totalCash, netPrevMonth: null, deltaNet: null }
  }

  const monthA = completeWithRb[completeWithRb.length - 1]
  const netThisMonth = lastRunningBalanceInMonth(list, monthA)
  if (netThisMonth == null) {
    return { totalCash, netThisMonth: totalCash, netPrevMonth: null, deltaNet: null }
  }

  const [y, m] = monthA.split('-').map(Number)
  const prevMonthStart = new Date(y, m - 2, 1)
  const monthB = `${prevMonthStart.getFullYear()}-${pad2(prevMonthStart.getMonth() + 1)}`
  const netPrevMonth = lastRunningBalanceInMonth(list, monthB)
  const deltaNet =
    netPrevMonth != null && Number.isFinite(netPrevMonth)
      ? netThisMonth - netPrevMonth
      : null

  return { totalCash, netThisMonth, netPrevMonth, deltaNet }
}

/**
 * Monthly burn from last 90 days (same scaling as burn strip) and % change vs that average
 * implied by last 30 days of outflows.
 * @returns {{ monthlyBurn90: number, monthlyImplied30: number, deltaPct: number | null } | null}
 */
export function computeBurn30Vs90Pct(rows, nowMs = Date.now()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null

  const cutoff90 = nowMs - 90 * 86400000
  const cutoff30 = nowMs - 30 * 86400000
  let out90 = 0
  let out30 = 0

  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a) || a >= 0) continue
    const d = parseDate(r?.date)
    if (!d) continue
    const t = d.getTime()
    const v = -a
    if (t >= cutoff90) out90 += v
    if (t >= cutoff30) out30 += v
  }

  const monthlyBurn90 = out90 > 0 ? (out90 / 90) * 30 : 0
  const monthlyImplied30 = out30 > 0 ? (out30 / 30) * 30 : 0

  if (monthlyBurn90 <= 0) {
    return { monthlyBurn90: 0, monthlyImplied30, deltaPct: null }
  }

  const deltaPct = ((monthlyImplied30 - monthlyBurn90) / monthlyBurn90) * 100
  return { monthlyBurn90, monthlyImplied30, deltaPct }
}
