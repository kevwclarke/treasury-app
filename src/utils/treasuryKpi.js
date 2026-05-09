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
 * @returns {{ totalCash: number, netThisMonth: number, netPrevMonth: number | null, deltaNet: number | null } | null}
 */
export function computeTotalCashAndMoMNetDelta(rows) {
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
 * Monthly burn: average outflow over the 3 calendar months ending at the anchor month
 * (latest transaction date). Latest month total vs that average drives deltaPct.
 * @returns {{ monthlyBurn90: number, monthlyImplied30: number, deltaPct: number | null } | null}
 */
export function computeBurn30Vs90Pct(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null
  const anchor = latestTransactionDate(list)
  if (!anchor) return null
  const anchorYear = anchor.getFullYear()
  const anchorMonth = anchor.getMonth() + 1
  const monthKeys = []
  for (let i = 2; i >= 0; i -= 1) {
    const d = new Date(anchorYear, anchorMonth - 1 - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const monthlyBurns = monthKeys.map((ym) => {
    let total = 0
    for (const r of list) {
      const d = parseDate(r.date)
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key !== ym) continue
      const a = Number(r.amount)
      if (Number.isFinite(a) && a < 0) total += Math.abs(a)
    }
    return total
  })
  const validBurns = monthlyBurns.filter((v) => v > 0)
  if (!validBurns.length) return { monthlyBurn90: 0, monthlyImplied30: 0, deltaPct: null }
  const monthlyBurn90 = monthlyBurns.reduce((s, v) => s + v, 0) / 3
  const monthlyImplied30 = monthlyBurns[monthlyBurns.length - 1]
  if (monthlyBurn90 <= 0) return { monthlyBurn90: 0, monthlyImplied30, deltaPct: null }
  const deltaPct = ((monthlyImplied30 - monthlyBurn90) / monthlyBurn90) * 100
  return { monthlyBurn90, monthlyImplied30, deltaPct }
}
