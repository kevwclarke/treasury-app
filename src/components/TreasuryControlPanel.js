import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { computeBurn30Vs90Pct } from '../utils/treasuryKpi'
import { computeLiquidityBuffer } from '../utils/treasuryLiquidity'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { computeRunwaySparkline } from '../utils/treasuryKpiSparklines'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { YIELD_BEST_PCT, YIELD_CURRENT_PCT, YIELD_SPREAD_DEC } from '../utils/treasuryYield'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import {
  computeRunwayMoMChange,
  runwayRiskLevel,
  topRunwayProtectAction,
} from '../utils/treasuryCashControl'
import { summarizeFxExposure } from '../utils/treasuryFxExposure'
import './TreasuryControlPanel.css'

const SINCE_90D = () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

function burnSummaryFromRows(txnRows) {
  const since90dIso = SINCE_90D()
  const burnRows = (txnRows ?? []).filter((t) => {
    const amt = Number(t.amount)
    if (!Number.isFinite(amt) || amt >= 0) return false
    const d = t.date ? new Date(t.date).getTime() : 0
    return d >= new Date(since90dIso).getTime()
  })
  if (!burnRows.length) {
    return {
      monthlyAvg: 0,
      categories: BURN_CATEGORY_ORDER.map((name) => ({ name, amount: 0, pct: 0 })),
      total: 0,
    }
  }
  const totals = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
  let total = 0
  burnRows.forEach((t) => {
    const spend = Math.abs(Number(t.amount) || 0)
    if (!spend) return
    const cat = categorisePayee(t.payee)
    totals[cat] += spend
    total += spend
  })
  const categories = BURN_CATEGORY_ORDER.map((name) => {
    const amount = totals[name] ?? 0
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0
    return { name, amount, pct }
  })
  const monthlyAvg = total > 0 ? (total / 90) * 30 : 0
  return { monthlyAvg, categories, total }
}

export function TreasuryControlPanel({ txnLoading, txnError, txnRows, autopilot }) {
  const burnSummary = useMemo(() => burnSummaryFromRows(txnRows), [txnRows])

  const yieldSummary = useMemo(() => {
    const totalCash = (txnRows ?? []).reduce((s, t) => {
      const a = Number(t.amount)
      return s + (Number.isFinite(a) ? a : 0)
    }, 0)
    const annualOppCost = totalCash * YIELD_SPREAD_DEC
    return { totalCash, annualOppCost }
  }, [txnRows])

  const runwayMetrics = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])

  const liquidity = useMemo(() => computeLiquidityBuffer(txnRows), [txnRows])

  const kpiBurnKpi = useMemo(() => computeBurn30Vs90Pct(txnRows), [txnRows])

  const runwaySpark = useMemo(() => computeRunwaySparkline(txnRows), [txnRows])

  const mom = useMemo(() => computeRunwayMoMChange(runwaySpark), [runwaySpark])

  const risk = useMemo(
    () => runwayRiskLevel(runwayMetrics.baseRunwayMo, autopilot?.minRunwayMonths ?? 6),
    [runwayMetrics.baseRunwayMo, autopilot?.minRunwayMonths],
  )

  const topAction = useMemo(
    () =>
      topRunwayProtectAction({
        runwayMetrics,
        burnSummary,
        minRunwayMonths: autopilot?.minRunwayMonths ?? 6,
        kpiBurnKpi,
      }),
    [runwayMetrics, burnSummary, autopilot?.minRunwayMonths, kpiBurnKpi],
  )

  const fx = useMemo(() => summarizeFxExposure(txnRows), [txnRows])

  const idleAboveBuffer = liquidity.eligibleForYield
  const hasData = (txnRows?.length ?? 0) > 0

  if (txnError) {
    return <div className="tcp tcp--error">{txnError}</div>
  }

  return (
    <div className="tcp" aria-label="Cash control panel">
      <article className="tcp-card tcp-card--runway">
        <header className="tcp-card__head">
          <h2 className="tcp-card__title">Runway Autopilot</h2>
          {txnLoading ? (
            <span className="tcp-card__risk tcp-card__risk--muted">…</span>
          ) : (
            <span className={`tcp-card__risk tcp-card__risk--${risk.toLowerCase()}`}>{risk} risk</span>
          )}
        </header>
        {txnLoading ? (
          <div className="tcp-card__skel" aria-busy="true">
            <span className="ds-skeleton ds-skeleton--value-lg" />
            <span className="ds-skeleton ds-skeleton--line" />
          </div>
        ) : !hasData ? (
          <p className="tcp-card__muted">Import a bank CSV to see runway from your cash and outflows.</p>
        ) : (
          <>
            <p className="tcp-card__kpi">
              <span className="tcp-card__kpi-num">
                {runwayMetrics.baseRunwayMo != null && Number.isFinite(runwayMetrics.baseRunwayMo)
                  ? `${runwayMetrics.baseRunwayMo.toFixed(1)}`
                  : '—'}
              </span>
              <span className="tcp-card__kpi-unit">months runway</span>
            </p>
            <p className="tcp-card__meta">
              {mom ? (
                <>
                  <span className={mom.deltaMo >= 0 ? 'tcp-card__delta--up' : 'tcp-card__delta--down'}>
                    {mom.deltaMo >= 0 ? '+' : ''}
                    {mom.deltaMo.toFixed(1)} mo
                  </span>{' '}
                  vs last calendar month (modelled from your import).
                </>
              ) : (
                <>Not enough history to compare month-on-month runway.</>
              )}
            </p>
            <div className="tcp-card__action-block">
              <p className="tcp-card__action-label">Top move</p>
              <p className="tcp-card__action-text">{topAction.line}</p>
              <p className="tcp-card__impact">
                Indicative impact if executed this month:{' '}
                <strong>{topAction.impactGbp > 0 ? formatGBP(topAction.impactGbp) : '—'}</strong>
              </p>
            </div>
          </>
        )}
        <Link className="tcp-card__cta" to="/app/burn-intelligence">
          Review Autopilot
        </Link>
      </article>

      <article className="tcp-card tcp-card--yield">
        <header className="tcp-card__head">
          <h2 className="tcp-card__title">Cash Optimisation</h2>
        </header>
        {txnLoading ? (
          <div className="tcp-card__skel" aria-busy="true">
            <span className="ds-skeleton ds-skeleton--value-lg" />
            <span className="ds-skeleton ds-skeleton--line" />
          </div>
        ) : !hasData ? (
          <p className="tcp-card__muted">Upload transactions to quantify idle cash above your liquidity buffer.</p>
        ) : (
          <dl className="tcp-dl">
            <div>
              <dt>Idle cash (above {formatGBP(Math.round(liquidity.targetCash6mo))} target buffer)</dt>
              <dd>{formatGBP(Math.round(idleAboveBuffer))}</dd>
            </div>
            <div>
              <dt>Current yield</dt>
              <dd>{formatPct(YIELD_CURRENT_PCT, 2)}</dd>
            </div>
            <div>
              <dt>Best available (placeholder)</dt>
              <dd className="tcp-dl__accent">{formatPct(YIELD_BEST_PCT, 2)}</dd>
            </div>
            <div>
              <dt>Annual opportunity cost</dt>
              <dd className="tcp-dl__cost">{formatGBP(Math.round(yieldSummary.annualOppCost))}</dd>
            </div>
          </dl>
        )}
        <Link className="tcp-card__cta tcp-card__cta--primary" to="/app/yield">
          Optimise Cash
        </Link>
      </article>

      {fx.hasMultiCurrency ? (
        <article className="tcp-card tcp-card--fx">
          <header className="tcp-card__head">
            <h2 className="tcp-card__title">FX Exposure</h2>
            <span className="tcp-card__pill">Multi-currency</span>
          </header>
          {txnLoading ? (
            <div className="tcp-card__skel" aria-busy="true">
              <span className="ds-skeleton ds-skeleton--line" />
            </div>
          ) : (
            <>
              <p className="tcp-card__kpi tcp-card__kpi--compact">
                <span className="tcp-card__kpi-num">{formatGBP(Math.round(fx.totalUnhedgedGbp))}</span>
                <span className="tcp-card__kpi-unit">unhedged (GBP equivalent / mo, heuristic)</span>
              </p>
              <p className="tcp-card__meta">
                Impact of a <strong>5%</strong> GBP move on effective monthly burn:{' '}
                <strong>{formatGBP(Math.round(fx.fivePctOnMonthlyBurn))}</strong>
              </p>
            </>
          )}
          <Link className="tcp-card__cta" to="/app/fx">
            Review Exposure
          </Link>
        </article>
      ) : (
        <article className="tcp-card tcp-card--fx tcp-card--fx-ok" aria-live="polite">
          <header className="tcp-card__head">
            <h2 className="tcp-card__title">FX Exposure</h2>
          </header>
          <p className="tcp-card__ok-msg">
            No FX exposure detected — your burn appears entirely in GBP.
          </p>
        </article>
      )}
    </div>
  )
}
