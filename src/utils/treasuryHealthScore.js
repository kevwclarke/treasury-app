import { YIELD_BEST_PCT, YIELD_CURRENT_PCT } from './treasuryYield'

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
  // Additive pillars (max 100): runway 35, yield gap 25, concentration 25, burn 15.
  const yieldGapPct = YIELD_BEST_PCT - YIELD_CURRENT_PCT

  let runwayPts = 0
  const r = p.baseRunwayMo
  if (r != null && Number.isFinite(r) && r > 0) {
    runwayPts = r >= 18 ? 35 : (r / 18) * 35
  }

  let yieldPts = 25
  if (p.totalCash > 0 && yieldGapPct > 0) {
    yieldPts = Math.max(0, 25 - yieldGapPct * 6)
  }

  let concPts = 25
  if (p.maxInstitutionConcentrationPct > 75) concPts -= 15
  else if (p.maxInstitutionConcentrationPct > 50) concPts -= 8
  if (p.fscsUnprotectedGbp > 500_000) concPts -= 10
  else if (p.fscsUnprotectedGbp > 250_000) concPts -= 5
  concPts = Math.max(0, concPts)

  let burnPts = 15
  if (p.burnMomGrowthPct != null && Number.isFinite(p.burnMomGrowthPct)) {
    if (p.burnMomGrowthPct > 10) burnPts = 0
    else if (p.burnMomGrowthPct > 5) burnPts = 7.5
  }

  const raw = runwayPts + yieldPts + concPts + burnPts
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
