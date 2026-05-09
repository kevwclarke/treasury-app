function pad2(n) {
  return String(n).padStart(2, '0')
}

function isOpeningBalanceRow(r) {
  const desc = String(r?.description ?? '').toUpperCase()
  const payee = String(r?.payee ?? '').toUpperCase()
  return desc.includes('OPENING BALANCE') || payee.includes('OPENING BALANCE')
}

function monthKeyLocal(iso) {
  if (!iso) return null
  let d
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(iso))) {
    const [dd, mm, yyyy] = String(iso).split('/')
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  } else {
    d = new Date(iso)
  }
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function rowTimeMs(iso) {
  if (!iso) return NaN
  let d
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(iso))) {
    const [dd, mm, yyyy] = String(iso).split('/')
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  } else {
    d = new Date(iso)
  }
  if (Number.isNaN(d.getTime())) return NaN
  return d.getTime()
}

function latestRowInMonth(list, ym) {
  let best = null
  let bestT = -Infinity
  for (const r of list) {
    if (monthKeyLocal(r.date) !== ym) continue
    const t = rowTimeMs(r.date)
    if (!Number.isFinite(t)) continue
    if (t >= bestT) {
      bestT = t
      best = r
    }
  }
  return best
}

/**
 * Total cash from latest row's running_balance; MoM delta = previous calendar month end vs month before
 * (avoids incomplete current month with no rows).
 * Opening-balance rows are included for running_balance lookups only (not for burn below).
 * @param {Array<{ amount?: number|string, date?: string, running_balance?: number|null }>} rows
 * @param {Date} [now]
 * @returns {{ totalCash: number, netThisMonth: number, netPrevMonth: number, deltaNet: number } | null}
 */
export function computeTotalCashAndMoMNetDelta(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null

  let latestAll = null
  let latestT = -Infinity
  for (const r of list) {
    const t = rowTimeMs(r.date)
    if (!Number.isFinite(t)) continue
    if (t >= latestT) {
      latestT = t
      latestAll = r
    }
  }

  const rbGlobal = latestAll != null ? Number(latestAll.running_balance) : NaN
  const totalCash = Number.isFinite(rbGlobal) ? rbGlobal : 0

  const y = now.getFullYear()
  const prev1 = new Date(y, now.getMonth() - 1, 1)
  const prev1Key = `${prev1.getFullYear()}-${pad2(prev1.getMonth() + 1)}`
  const prev2 = new Date(y, now.getMonth() - 2, 1)
  const prev2Key = `${prev2.getFullYear()}-${pad2(prev2.getMonth() + 1)}`

  const rowThis = latestRowInMonth(list, prev1Key)
  const rowPrev = latestRowInMonth(list, prev2Key)
  const rbThis = rowThis != null ? Number(rowThis.running_balance) : NaN
  const rbPrev = rowPrev != null ? Number(rowPrev.running_balance) : NaN
  const netThisMonth = Number.isFinite(rbThis) ? rbThis : 0
  const netPrevMonth = Number.isFinite(rbPrev) ? rbPrev : 0
  const deltaNet = netThisMonth - netPrevMonth

  return { totalCash, netThisMonth, netPrevMonth, deltaNet }
}

/**
 * Monthly burn from last 90 days (same scaling as burn strip) and % change vs that average
 * implied by last 30 days of outflows. Opening-balance rows excluded.
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
    if (isOpeningBalanceRow(r)) continue
    const a = Number(r?.amount)
    if (!Number.isFinite(a) || a >= 0) continue
    const t = r?.date ? rowTimeMs(r.date) : NaN
    if (!Number.isFinite(t)) continue
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
