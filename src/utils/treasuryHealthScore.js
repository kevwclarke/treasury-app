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
  let score = 100

  if (p.maxInstitutionConcentrationPct > 75) {
    score -= 20
  }

  const yieldGapPct = YIELD_BEST_PCT - YIELD_CURRENT_PCT
  if (p.totalCash > 0 && yieldGapPct > 2) {
    score -= 15
  }

  if (
    p.baseRunwayMo != null &&
    Number.isFinite(p.baseRunwayMo) &&
    p.baseRunwayMo > 0 &&
    p.baseRunwayMo < 18
  ) {
    score -= 15
  }

  if (p.fscsUnprotectedGbp > 500_000) {
    score -= 10
  }

  if (p.burnMomGrowthPct != null && Number.isFinite(p.burnMomGrowthPct) && p.burnMomGrowthPct > 10) {
    score -= 10
  }

  return Math.max(0, Math.round(score))
}
