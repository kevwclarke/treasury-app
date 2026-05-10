import { CSV_SOURCE_INSTITUTIONS } from '../constants/institutions'

export const CONCENTRATION_INSTITUTIONS = [...CSV_SOURCE_INSTITUTIONS]

export const FSCS_LIMIT_GBP = 120_000

const STACK_COLORS = ['#1B2B8C', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB']

const BANK_BADGE = {
  Barclays: 'BARC',
  HSBC: 'HSBC',
  Starling: 'STAR',
  Monzo: 'MONZO',
  NatWest: 'NWIDE',
  Lloyds: 'LLOYDS',
  Other: 'OTHER',
}

/** Normalise stored institution; missing or unknown → Other. */
export function normalizeTransactionInstitution(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return 'Other'
  return CSV_SOURCE_INSTITUTIONS.includes(s) ? s : 'Other'
}

function latestRunningBalanceForInstitution(rows, institutionKey) {
  let latest = null
  let latestT = -Infinity
  for (const r of rows) {
    if (normalizeTransactionInstitution(r?.institution) !== institutionKey) continue
    const rb = Number(r?.running_balance)
    if (!Number.isFinite(rb)) continue
    const d = new Date(String(r.date).trim())
    if (isNaN(d.getTime())) continue
    const t = d.getTime()
    if (t >= latestT) {
      latestT = t
      latest = rb
    }
  }
  return latest
}

function emptyBuckets() {
  return Object.fromEntries(CONCENTRATION_INSTITUTIONS.map((k) => [k, 0]))
}

/**
 * Concentration from uploaded transactions: all amounts in a row belong to `institution`
 * (the bank selected at CSV import).
 *
 * @param {Array<{ amount?: number | string, institution?: string | null }>} rows
 */
export function computeConcentrationFromTransactions(rows) {
  const list = Array.isArray(rows) ? rows : []
  let totalCash = 0
  let hasRunning = false
  let newestRunningT = -Infinity
  let newestRunningBal = null

  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    totalCash += a

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

  if (hasRunning && newestRunningBal != null) {
    totalCash = newestRunningBal
  }

  const balances = emptyBuckets()
  const amountSums = emptyBuckets()

  for (const r of list) {
    const a = Number(r?.amount)
    if (!Number.isFinite(a)) continue
    const key = normalizeTransactionInstitution(r?.institution)
    amountSums[key] = (amountSums[key] ?? 0) + a
  }

  for (const name of CONCENTRATION_INSTITUTIONS) {
    const rb = latestRunningBalanceForInstitution(list, name)
    if (rb != null) {
      balances[name] = rb
    } else {
      balances[name] = amountSums[name] ?? 0
    }
  }

  const institutionRows = CONCENTRATION_INSTITUTIONS.map((name) => {
    const balance = balances[name] ?? 0
    const pctOfTotal = totalCash !== 0 ? (balance / totalCash) * 100 : 0
    const balanceForFscs = Math.max(0, balance)
    const protectedAmt = Math.min(balanceForFscs, FSCS_LIMIT_GBP)
    const unprotectedAmt = Math.max(0, balanceForFscs - FSCS_LIMIT_GBP)
    return {
      name,
      badge: BANK_BADGE[name] ?? 'OTHER',
      balance,
      pctOfTotal,
      protectedAmt,
      unprotectedAmt,
      color: STACK_COLORS[CONCENTRATION_INSTITUTIONS.indexOf(name) % STACK_COLORS.length],
    }
  }).sort((a, b) => b.balance - a.balance)

  const maxPct = institutionRows.reduce((m, r) => Math.max(m, r.pctOfTotal), 0)

  let riskTone = 'green'
  let riskLabel = 'Lower risk'
  if (maxPct > 75) {
    riskTone = 'red'
    riskLabel = 'High risk'
  } else if (maxPct > 50) {
    riskTone = 'amber'
    riskLabel = 'Elevated'
  }

  const unprotectedTotal = institutionRows.reduce((s, r) => s + r.unprotectedAmt, 0)
  const protectedTotal = institutionRows.reduce((s, r) => s + r.protectedAmt, 0)

  const barSegments = getConcentrationBarSegments(institutionRows, totalCash)

  const largestInstitution =
    institutionRows.reduce((best, r) => (!best || r.balance > best.balance ? r : best), null)?.name ?? null

  return {
    totalCash,
    institutionRows,
    barSegments,
    maxPct,
    largestInstitution,
    riskTone,
    riskLabel,
    unprotectedTotal,
    protectedTotal,
  }
}

/**
 * Bar widths as % of bar track. If attributed positive balances exceed total cash, scale down so sum ≤ 100%.
 */
export function getConcentrationBarSegments(institutionRows, totalCash) {
  const positive = institutionRows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance)
  if (totalCash <= 0 || !positive.length) return []
  const raw = positive.map((r) => (r.balance / totalCash) * 100)
  const sum = raw.reduce((a, b) => a + b, 0)
  const scale = sum > 100.001 ? 100 / sum : 1
  return positive.map((r, i) => ({
    name: r.name,
    balance: r.balance,
    color: r.color,
    widthPct: raw[i] * scale,
  }))
}
