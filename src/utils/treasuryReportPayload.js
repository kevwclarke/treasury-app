import { BURN_CATEGORY_ORDER, categorisePayee } from './treasuryBurn'
import { computeConcentrationFromTransactions } from './treasuryConcentration'
import { computeBurn30Vs90Pct } from './treasuryKpi'
import { computeRunwayFromTransactions } from './treasuryRunway'
import { YIELD_BEST_DEC, YIELD_BEST_PCT, YIELD_CURRENT_DEC, YIELD_CURRENT_PCT } from './treasuryYield'
import { computeTreasuryHealthScore100 } from './treasuryHealthScore'
import { getReportCompanyName, TREASURY_AI_ACTIONS_CACHE_KEY } from '../constants/treasuryReport'

function since90dIso() {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @param {Array<{ amount?: number|string }>} txnRows
 * @param {{ currentYieldDec?: number }} [opts]
 */
export function computeYieldSummary(txnRows, opts = {}) {
  const currentYieldDec =
    opts.currentYieldDec != null && Number.isFinite(Number(opts.currentYieldDec))
      ? Math.max(0, Math.min(0.25, Number(opts.currentYieldDec)))
      : YIELD_CURRENT_DEC
  const list = Array.isArray(txnRows) ? txnRows : []
  let totalCash = 0
  for (const t of list) {
    const a = Number(t?.amount)
    if (!Number.isFinite(a)) continue
    totalCash += a
  }
  const spreadDec = Math.max(0, YIELD_BEST_DEC - currentYieldDec)
  const annualOppCost = totalCash * spreadDec
  const monthlyOppCost = annualOppCost / 12
  return { totalCash, annualOppCost, monthlyOppCost, currentYieldDec, spreadDec }
}

function computeBurnSummaryFromRows(burnRows) {
  if (!burnRows?.length) {
    return {
      monthlyAvg: 0,
      categories: BURN_CATEGORY_ORDER.map((name) => ({ name, amount: 0, pct: 0 })),
      total: 0,
    }
  }
  const totals = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
  let total = 0
  for (const t of burnRows) {
    const spend = Math.abs(Number(t.amount) || 0)
    if (!spend) continue
    const cat = categorisePayee(t.payee)
    totals[cat] += spend
    total += spend
  }
  const categories = BURN_CATEGORY_ORDER.map((name) => {
    const amount = totals[name] ?? 0
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0
    return { name, amount, pct }
  })
  const monthlyAvg = total > 0 ? (total / 90) * 30 : 0
  return { monthlyAvg, categories, total }
}

/**
 * @returns {Array<{ rank: number, title: string, action: string, impactGbpPerYear: number, effort: string }>}
 */
export function readCachedAiActionsTop3() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TREASURY_AI_ACTIONS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const actions = parsed?.actions
    if (!Array.isArray(actions)) return []
    return [...actions]
      .sort((a, b) => (Number(a?.rank) || 0) - (Number(b?.rank) || 0))
      .slice(0, 3)
      .filter((a) => a && typeof a.title === 'string')
  } catch {
    return []
  }
}

/**
 * Snapshot for the investor PDF (same inputs as Treasury Autopilot KPIs).
 * @param {Array<{ amount?: number|string, payee?: string, date?: string, institution?: string }>} txnRows
 */
export function buildTreasuryReportPdfPayload(txnRows) {
  const list = Array.isArray(txnRows) ? txnRows : []
  const yieldSummary = computeYieldSummary(list)
  const concentration = computeConcentrationFromTransactions(list)
  const runwayMetrics = computeRunwayFromTransactions(list)

  const cut = since90dIso()
  const burnRows = list.filter((t) => {
    const amt = Number(t.amount)
    if (!Number.isFinite(amt) || amt >= 0) return false
    const d = t.date ? new Date(t.date).getTime() : 0
    return d >= new Date(cut).getTime()
  })
  const burnSummary = computeBurnSummaryFromRows(burnRows)
  const burnKpi = computeBurn30Vs90Pct(list)

  const healthScore = computeTreasuryHealthScore100({
    maxInstitutionConcentrationPct: concentration.maxPct,
    totalCash: yieldSummary.totalCash,
    baseRunwayMo: runwayMetrics.baseRunwayMo,
    fscsUnprotectedGbp: concentration.unprotectedTotal,
    burnMomGrowthPct: burnKpi?.deltaPct ?? null,
  })

  const topBurnCategories = [...burnSummary.categories]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)

  const institutionRowsForPdf = concentration.institutionRows.filter((r) => r.balance > 0)

  return {
    companyName: getReportCompanyName(),
    generatedAt: new Date(),
    healthScore,
    yieldSummary,
    effectiveYieldPct: YIELD_CURRENT_PCT,
    bestYieldPct: YIELD_BEST_PCT,
    concentration,
    institutionRowsForPdf,
    runwayMetrics,
    burnSummary,
    topBurnCategories,
    burnKpi,
    aiActions: readCachedAiActionsTop3(),
  }
}
