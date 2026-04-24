function pad2(n) {
  return String(n).padStart(2, '0')
}

function monthKeyLocal(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/**
 * Total cash (sum of amounts) and month-over-month net change (this calendar month vs previous).
 * @param {Array<{ amount?: number|string, date?: string }>} rows
 * @param {Date} [now]
 * @returns {{ totalCash: number, netThisMonth: number, netPrevMonth: number, deltaNet: number } | null}
 */
export function computeTotalCashAndMoMNetDelta(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null

  let totalCash = 0
  const netByMonth = new Map()
  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    totalCash += a
    const k = monthKeyLocal(r.date)
    if (!k) continue
    netByMonth.set(k, (netByMonth.get(k) || 0) + a)
  }

  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const thisKey = `${y}-${pad2(m)}`
  const prev = new Date(y, now.getMonth() - 1, 1)
  const prevKey = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`

  const netThisMonth = netByMonth.get(thisKey) ?? 0
  const netPrevMonth = netByMonth.get(prevKey) ?? 0
  const deltaNet = netThisMonth - netPrevMonth

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
    const t = r?.date ? new Date(r.date).getTime() : NaN
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
