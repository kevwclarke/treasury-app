import { YIELD_BEST_PCT, YIELD_CURRENT_PCT, YIELD_SPREAD_DEC } from './treasuryYield'

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

  let runwayPts = 0
  const r = p.baseRunwayMo
  if (r != null && Number.isFinite(r) && r > 0) {
    if (r > 18) runwayPts = 35
    else if (r >= 12) runwayPts = 25
    else if (r >= 9) runwayPts = 18
    else if (r >= 6) runwayPts = 10
    else runwayPts = 0
  }

  let yieldPts = 25
  const annualOppGbp = p.totalCash > 0 && yieldGapPct > 0 ? p.totalCash * YIELD_SPREAD_DEC : 0
  if (annualOppGbp > 0) {
    if (annualOppGbp < 10_000) yieldPts = 25
    else if (annualOppGbp < 50_000) yieldPts = 18
    else if (annualOppGbp < 150_000) yieldPts = 10
    else if (annualOppGbp < 300_000) yieldPts = 5
    else yieldPts = 0
  }

  const maxConc = p.maxInstitutionConcentrationPct
  let concPts = 0
  if (maxConc < 50) concPts = 25
  else if (maxConc <= 75) concPts = 15
  else if (maxConc <= 90) concPts = 8
  else concPts = 0

  let burnPts = 15
  const b = p.burnMomGrowthPct
  if (b != null && Number.isFinite(b)) {
    if (b > 15) burnPts = 0
    else if (b > 5) burnPts = 5
    else if (b > 0) burnPts = 10
    else burnPts = 15
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
