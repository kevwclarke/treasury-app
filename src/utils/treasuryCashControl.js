import { FUNDRAISE_RUNWAY_ALERT_MONTHS } from './treasuryRunway'

/**
 * @param {number[] | null} runwaySparklineSixMo
 */
export function computeRunwayMoMChange(runwaySparklineSixMo) {
  if (!runwaySparklineSixMo || runwaySparklineSixMo.length < 2) return null
  const curr = runwaySparklineSixMo[runwaySparklineSixMo.length - 1]
  const prev = runwaySparklineSixMo[runwaySparklineSixMo.length - 2]
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
  return { deltaMo: curr - prev, currentMo: curr, previousMo: prev }
}

/**
 * @param {number | null} baseRunwayMo
 * @param {number} minRunwayMonths policy floor (e.g. from treasury_policies)
 * @returns {'Low' | 'Medium' | 'High'}
 */
export function runwayRiskLevel(baseRunwayMo, minRunwayMonths) {
  const m = Number(minRunwayMonths) || 6
  if (baseRunwayMo == null || !Number.isFinite(baseRunwayMo)) return 'Medium'
  if (baseRunwayMo < m) return 'High'
  if (baseRunwayMo < FUNDRAISE_RUNWAY_ALERT_MONTHS) return 'Medium'
  return 'Low'
}

/**
 * Single deterministic “top” runway action for the control panel (not AI).
 * @param {{ runwayMetrics: object, burnSummary: object, minRunwayMonths: number, kpiBurnKpi: object | null }} p
 * @returns {{ line: string, impactGbp: number }}
 */
export function topRunwayProtectAction({ runwayMetrics, burnSummary, minRunwayMonths, kpiBurnKpi }) {
  const monthlyBurn = Number(runwayMetrics?.monthlyBurn) || 0
  const base = runwayMetrics?.baseRunwayMo
  const m = Number(minRunwayMonths) || 6
  const cats = burnSummary?.categories ?? []
  const topCat = cats.reduce((best, c) => ((c?.amount ?? 0) > (best?.amount ?? 0) ? c : best), null)
  const topMonthlyGbp = topCat && topCat.amount > 0 ? topCat.amount / 3 : 0

  if (base != null && Number.isFinite(base) && base < m && monthlyBurn > 0) {
    const gapMo = Math.max(0, m - base)
    return {
      line: `Close the gap to your ${m}-month runway floor — add cash or reduce burn before policy breach.`,
      impactGbp: Math.round(gapMo * monthlyBurn),
    }
  }

  if (kpiBurnKpi && kpiBurnKpi.deltaPct != null && Number.isFinite(kpiBurnKpi.deltaPct) && kpiBurnKpi.deltaPct > 4 && monthlyBurn > 0) {
    const extra = monthlyBurn * (kpiBurnKpi.deltaPct / 100)
    return {
      line: 'Stabilise rising burn (30d vs 90d) so runway does not compress further.',
      impactGbp: Math.round(Math.max(0, extra)),
    }
  }

  if (topCat && topMonthlyGbp > 0) {
    return {
      line: `Attack ${topCat.name} first — it is your largest 90-day outflow line.`,
      impactGbp: Math.round(topMonthlyGbp * 0.12),
    }
  }

  if (monthlyBurn > 0) {
    return {
      line: 'Review discretionary and recurring spend in Burn Intelligence to protect runway.',
      impactGbp: Math.round(monthlyBurn * 0.06),
    }
  }

  return {
    line: 'Upload transactions or open Burn Intelligence to model runway actions.',
    impactGbp: 0,
  }
}
