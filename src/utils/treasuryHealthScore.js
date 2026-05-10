import { YIELD_BEST_PCT, YIELD_CURRENT_PCT, YIELD_SPREAD_DEC } from './treasuryYield'

function runwayScore(mo) {
  if (!Number.isFinite(mo)) return 0
  if (mo >= 18) return 35
  if (mo >= 12) return 25
  if (mo >= 9) return 18
  if (mo >= 6) return 10
  return 0
}

function yieldScore(annualOppCost) {
  if (!Number.isFinite(annualOppCost)) return 25
  if (annualOppCost < 10000) return 25
  if (annualOppCost < 50000) return 18
  if (annualOppCost < 150000) return 10
  if (annualOppCost < 300000) return 5
  return 0
}

function concentrationScore(maxPct) {
  if (!Number.isFinite(maxPct)) return 25
  if (maxPct < 50) return 25
  if (maxPct < 75) return 15
  if (maxPct < 90) return 8
  return 0
}

function burnScore(deltaPct) {
  if (!Number.isFinite(deltaPct)) return 15
  if (deltaPct <= 0) return 15
  if (deltaPct <= 5) return 10
  if (deltaPct <= 15) return 5
  return 0
}

/**
 * Treasury health score 0–100 per investor report rules.
 * @param {{
 *   maxInstitutionConcentrationPct: number,
 *   totalCash: number,
 *   baseRunwayMo: number | null,
 *   fscsUnprotectedGbp: number,
 *   burnMomGrowthPct: number | null,
 * }} p
 */
export function computeTreasuryHealthScore100(p) {
  const yieldGapPct = YIELD_BEST_PCT - YIELD_CURRENT_PCT
  const annualOppCost =
    p.totalCash > 0 && yieldGapPct > 0 ? p.totalCash * YIELD_SPREAD_DEC : 0

  const raw =
    runwayScore(p.baseRunwayMo ?? NaN) +
    yieldScore(annualOppCost) +
    concentrationScore(p.maxInstitutionConcentrationPct) +
    burnScore(p.burnMomGrowthPct ?? NaN)

  return Math.max(0, Math.min(100, Math.round(raw)))
}

/** Display band for colour-coding the score in the UI. */
export function getTreasuryHealthScoreBand(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return 'warn'
  if (n >= 80) return 'good'
  if (n >= 60) return 'warn'
  return 'risk'
}
