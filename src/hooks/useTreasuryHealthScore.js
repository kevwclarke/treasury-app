import { useMemo } from 'react'
import { computeConcentrationFromTransactions } from '../utils/treasuryConcentration'
import { computeBurn30Vs90Pct } from '../utils/treasuryKpi'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { YIELD_SPREAD_DEC } from '../utils/treasuryYield'
import { computeTreasuryHealthScore100, getTreasuryHealthScoreBand } from '../utils/treasuryHealthScore'
import { useTreasuryTransactions } from './useTreasuryTransactions'

/**
 * Same 0–100 treasury health score as the dashboard, for sidebar / chrome.
 */
export function useTreasuryHealthScore() {
  const { txnLoading, txnRows } = useTreasuryTransactions()

  const yieldSummary = useMemo(() => {
    const totalCash = (txnRows ?? []).reduce((s, t) => {
      const a = Number(t.amount)
      return s + (Number.isFinite(a) ? a : 0)
    }, 0)
    const annualOppCost = totalCash * YIELD_SPREAD_DEC
    const monthlyOppCost = annualOppCost / 12
    return { totalCash, annualOppCost, monthlyOppCost }
  }, [txnRows])

  const concentration = useMemo(() => computeConcentrationFromTransactions(txnRows), [txnRows])
  const runwayMetrics = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])
  const kpiBurnKpi = useMemo(() => computeBurn30Vs90Pct(txnRows), [txnRows])

  const score = useMemo(
    () =>
      computeTreasuryHealthScore100({
        maxInstitutionConcentrationPct: concentration.maxPct,
        totalCash: yieldSummary.totalCash,
        baseRunwayMo: runwayMetrics.baseRunwayMo,
        fscsUnprotectedGbp: concentration.unprotectedTotal,
        burnMomGrowthPct: kpiBurnKpi?.deltaPct ?? null,
      }),
    [concentration, yieldSummary, runwayMetrics, kpiBurnKpi],
  )

  const band = txnLoading ? 'warn' : getTreasuryHealthScoreBand(score)

  return { score, band, loading: txnLoading }
}
