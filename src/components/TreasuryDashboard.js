import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { computeConcentrationFromTransactions } from '../utils/treasuryConcentration'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeBurn30Vs90Pct, computeTotalCashAndMoMNetDelta } from '../utils/treasuryKpi'
import {
  computeBurnSparkline,
  computeRunwaySparkline,
  computeTotalCashSparkline,
  kpiChartPoints,
  lastSixMonthKeys,
} from '../utils/treasuryKpiSparklines'
import {
  computeRunwayFromTransactions,
  FUNDRAISE_RUNWAY_ALERT_MONTHS,
} from '../utils/treasuryRunway'
import { cashflowWeeklyLowCashWarning, computeCashflowSummary } from '../utils/treasuryCashflow'
import { computeLiquidityBuffer } from '../utils/treasuryLiquidity'
import { YIELD_BEST_PCT, YIELD_CURRENT_PCT, YIELD_SPREAD_DEC } from '../utils/treasuryYield'
import { useCountUp } from '../hooks/useCountUp'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { computeTreasuryHealthScore100 } from '../utils/treasuryHealthScore'
import { useConnectBankModal } from '../context/ConnectBankContext'
import { TreasuryHealthScoreControl } from './TreasuryHealthScoreControl'
import { KpiRechartsArea } from './KpiRechartsArea'
import { TreasuryOnboarding } from './TreasuryOnboarding'
import { DashboardSummaryCards } from './DashboardSummaryCards'
import './TreasuryDashboard.css'

const SESSION_SKIP_EMPTY_ONBOARD = 'treasury_skip_empty_onboarding'
const IMPORT_WELCOME_COPY = 'Your data is ready — Treasury Autopilot is live'

function IconClock() {
  return (
    <svg className="tdash__alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function KpiAnimatedGbp({ amount, loading, className = 'tdash__kpi-value' }) {
  const has = amount != null && Number.isFinite(amount)
  const target = has ? Math.round(amount) : 0
  const n = useCountUp(target, { enabled: !loading && has })
  if (loading) return null
  if (!has) return <p className={`${className} tdash__kpi-value--muted`}>—</p>
  return <p className={className}>{formatGBP(Math.round(n))}</p>
}

function KpiAnimatedPct({ pct, loading, className = 'tdash__kpi-value tdash__kpi-value--salmon' }) {
  const has = pct != null && Number.isFinite(pct)
  const target = has ? pct : 0
  const n = useCountUp(target, { enabled: !loading && has })
  if (loading) return null
  if (!has) return <p className="tdash__kpi-value tdash__kpi-value--muted">—</p>
  return <p className={className}>{formatPct(n, 2)}</p>
}

function KpiAnimatedRunwayMo({ months, loading }) {
  const has = months != null && Number.isFinite(months)
  const target = has ? months : 0
  const n = useCountUp(target, { enabled: !loading && has })
  if (loading) return null
  if (!has) return <p className="tdash__kpi-value tdash__kpi-value--muted">—</p>
  return <p className="tdash__kpi-value tdash__kpi-value--brand">{n.toFixed(1)} mo</p>
}

const PEER_TREASURY_HEALTH_AVG = 68

export function TreasuryDashboard() {
  const navigate = useNavigate()
  const { openConnectBankModal } = useConnectBankModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [onboardingSkipped, setOnboardingSkipped] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SESSION_SKIP_EMPTY_ONBOARD) === '1',
  )
  const [importToast, setImportToast] = useState('')

  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()

  const skipEmptyOnboarding = useCallback(() => {
    sessionStorage.setItem(SESSION_SKIP_EMPTY_ONBOARD, '1')
    setOnboardingSkipped(true)
  }, [])

  useEffect(() => {
    if (searchParams.get('treasuryReady') !== '1' || txnLoading) return undefined
    if (txnRows.length === 0) {
      setSearchParams({}, { replace: true })
      return undefined
    }
    setImportToast(IMPORT_WELCOME_COPY)
    setSearchParams({}, { replace: true })
    const tid = window.setTimeout(() => setImportToast(''), 7200)
    return () => window.clearTimeout(tid)
  }, [searchParams, setSearchParams, txnLoading, txnRows.length])

  const since90dIso = useMemo(() => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), [])

  const burnRows = useMemo(
    () =>
      (txnRows ?? []).filter((t) => {
        const amt = Number(t.amount)
        if (!Number.isFinite(amt) || amt >= 0) return false
        const d = t.date ? new Date(t.date).getTime() : 0
        return d >= new Date(since90dIso).getTime()
      }),
    [txnRows, since90dIso],
  )

  const burnSummary = useMemo(() => {
    if (!burnRows?.length) {
      return { monthlyAvg: 0, total: 0 }
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
    const monthlyAvg = total > 0 ? (total / 90) * 30 : 0
    return { monthlyAvg, total }
  }, [burnRows])

  const kpiCash = useMemo(() => computeTotalCashAndMoMNetDelta(txnRows), [txnRows])
  const kpiBurnKpi = useMemo(() => computeBurn30Vs90Pct(txnRows), [txnRows])

  const yieldSummary = useMemo(() => {
    const totalCash =
      kpiCash?.totalCash ??
      (txnRows ?? []).reduce((s, t) => {
        const a = Number(t.amount)
        return s + (Number.isFinite(a) ? a : 0)
      }, 0)
    const annualOppCost = totalCash * YIELD_SPREAD_DEC
    const monthlyOppCost = annualOppCost / 12
    return { totalCash, annualOppCost, monthlyOppCost }
  }, [txnRows, kpiCash])

  const concentration = useMemo(() => computeConcentrationFromTransactions(txnRows), [txnRows])
  const runwayMetrics = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])
  const cashflowSummary = useMemo(() => computeCashflowSummary(txnRows), [txnRows])
  const cashflowLowCash = useMemo(
    () => cashflowWeeklyLowCashWarning(cashflowSummary, 13),
    [cashflowSummary],
  )
  const liquidity = useMemo(() => computeLiquidityBuffer(txnRows), [txnRows])

  const liquidityReserveCash = useMemo(() => {
    if (liquidity.bufferMonths == null || !Number.isFinite(liquidity.bufferMonths)) return 0
    return liquidity.bufferMonths * burnSummary.monthlyAvg
  }, [liquidity.bufferMonths, burnSummary.monthlyAvg])

  const capitalMoveEligibleCash = useMemo(() => {
    const total = kpiCash?.totalCash ?? yieldSummary.totalCash ?? 0
    return Math.round(Math.max(0, total - liquidityReserveCash))
  }, [kpiCash?.totalCash, yieldSummary.totalCash, liquidityReserveCash])

  const capitalMoveAnnualGainGbp = useMemo(
    () => Math.round(Math.max(0, capitalMoveEligibleCash * 0.0515)),
    [capitalMoveEligibleCash],
  )

  const treasuryHealthScore = useMemo(
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

  const kpiMonthKeys = useMemo(() => lastSixMonthKeys(txnRows), [txnRows])
  const sparkCashVals = useMemo(() => computeTotalCashSparkline(txnRows), [txnRows])
  const sparkRunwayVals = useMemo(() => computeRunwaySparkline(txnRows), [txnRows])
  const sparkBurnVals = useMemo(() => computeBurnSparkline(txnRows), [txnRows])
  const sparkTotalPoints = useMemo(
    () => kpiChartPoints(sparkCashVals, kpiMonthKeys),
    [sparkCashVals, kpiMonthKeys],
  )
  const sparkRunwayPoints = useMemo(
    () => kpiChartPoints(sparkRunwayVals, kpiMonthKeys),
    [sparkRunwayVals, kpiMonthKeys],
  )
  const sparkBurnPoints = useMemo(
    () => kpiChartPoints(sparkBurnVals, kpiMonthKeys),
    [sparkBurnVals, kpiMonthKeys],
  )

  const runwaySparklineDistorted = useMemo(() => {
    const pts = sparkRunwayPoints
    if (!pts?.length) return false
    const first = Number(pts[0]?.value)
    const last = Number(pts[pts.length - 1]?.value)
    if (!Number.isFinite(first) || !Number.isFinite(last)) return false
    return first > 2 * last
  }, [sparkRunwayPoints])

  const stateHeadline = useMemo(() => {
    const annual = yieldSummary.annualOppCost
    const burnDelta = kpiBurnKpi?.deltaPct
    if ((Number.isFinite(burnDelta) && burnDelta > 10) || annual > 50_000) {
      return 'Your treasury position needs attention.'
    }
    const runway = runwayMetrics.baseRunwayMo
    if (runway != null && Number.isFinite(runway) && runway > 20 && annual < 20_000) {
      return 'Your treasury position is strong.'
    }
    return 'Your treasury position is stable.'
  }, [yieldSummary.annualOppCost, kpiBurnKpi?.deltaPct, runwayMetrics.baseRunwayMo])

  const showFundraiseAlert =
    !txnLoading &&
    (txnRows?.length ?? 0) > 0 &&
    runwayMetrics.baseRunwayMo != null &&
    Number.isFinite(runwayMetrics.baseRunwayMo) &&
    runwayMetrics.baseRunwayMo < FUNDRAISE_RUNWAY_ALERT_MONTHS

  const showEmptyOnboarding = !txnLoading && !txnError && txnRows.length === 0 && !onboardingSkipped

  useEffect(() => {
    const on = txnLoading
    document.body.classList.toggle('app-data-loading', on)
    return () => document.body.classList.remove('app-data-loading')
  }, [txnLoading])

  if (showEmptyOnboarding) {
    return (
      <div className="tdash tdash--onboarding">
        <TreasuryOnboarding onSkip={skipEmptyOnboarding} />
      </div>
    )
  }

  return (
    <div className="tdash">
      {importToast ? (
        <div className="tdash__toast" role="status">
          <span className="tdash__toast-text">{importToast}</span>
          <button
            type="button"
            className="tdash__toast-dismiss"
            onClick={() => setImportToast('')}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ) : null}
      <header className="tdash__topbar">
        <div className="tdash__title-block">
          <h1 className="tdash__page-title">Treasury Intelligence</h1>
          <p className="tdash__page-subtitle">Where capital is leaking, compounding, and at risk.</p>
        </div>
        <div className="tdash__topbar-actions">
          <TreasuryHealthScoreControl
            score={treasuryHealthScore}
            loading={txnLoading}
            peerAverage={PEER_TREASURY_HEALTH_AVG}
          />
        </div>
      </header>

      <section className="tdash__state-strip" aria-label="Treasury state">
        <div className="tdash__state-left">
          <p className="tdash__state-label">TREASURY STATE</p>
          <p className="tdash__state-headline">{stateHeadline}</p>
          <p className="tdash__state-summary">
            <span style={{ color: '#dc2626' }}>
              £{Math.round(yieldSummary.monthlyOppCost).toLocaleString('en-GB')}/month lost to idle cash.{' '}
            </span>
            {kpiBurnKpi?.deltaPct != null && Number.isFinite(kpiBurnKpi.deltaPct) ? (
              <span style={{ color: kpiBurnKpi.deltaPct > 0 ? '#dc2626' : kpiBurnKpi.deltaPct < 0 ? '#16a34a' : '#374151' }}>
                Burn {kpiBurnKpi.deltaPct > 0 ? 'up' : kpiBurnKpi.deltaPct < 0 ? 'down' : 'flat'}{' '}
                {Math.abs(kpiBurnKpi.deltaPct).toFixed(1)}%.{' '}
              </span>
            ) : null}
            <span style={{ color: concentration.maxPct > 75 ? '#dc2626' : '#374151' }}>
              {concentration.maxPct.toFixed(1)}% concentrated in {concentration.largestInstitution || 'one bank'}.
            </span>
          </p>
          <p className="tdash__state-action-label">TOP CAPITAL MOVE</p>
          <p className="tdash__state-action">
            {capitalMoveEligibleCash <= 0 || capitalMoveAnnualGainGbp <= 0 ? (
              'Maintain liquidity buffer before optimising yield'
            ) : (
              <>
                Move £{capitalMoveEligibleCash.toLocaleString('en-GB')} to UK T-Bills for +£
                <span style={{ color: '#16a34a' }}>{capitalMoveAnnualGainGbp.toLocaleString('en-GB')}</span>/yr.
              </>
            )}
          </p>
        </div>
        <div className="tdash__state-right">
          <button type="button" className="tdash__state-cta" onClick={() => navigate('/app/yield')}>
            Review Capital Moves
          </button>
        </div>
      </section>

      {showFundraiseAlert ? (
        <section className="tdash__alerts" aria-label="Priority alerts">
          <div className="tdash__alert tdash__alert--urgent">
            <div className="tdash__alert-main">
              <span className="tdash__alert-pulse" aria-hidden>
                <span className="tdash__alert-pulse-dot" />
              </span>
              <IconClock />
              <div>
                <p className="tdash__alert-title">Fundraise window tightening</p>
                <p className="tdash__alert-meta">
                  Base-case runway is <strong>{runwayMetrics.baseRunwayMo.toFixed(1)} months</strong> from your
                  uploaded activity — below the <strong>{FUNDRAISE_RUNWAY_ALERT_MONTHS}-month</strong> buffer we use
                  when a raise can take around <strong>6 months</strong> to close. Model timing and cash before you
                  drift into a forced process.
                </p>
              </div>
            </div>
            <Link className="tdash__alert-action tdash__alert-action--red" to="/app/runway" style={{ textAlign: 'center' }}>
              Review runway
            </Link>
          </div>
        </section>
      ) : null}

      <section className="tdash__kpis" aria-label="Key performance indicators">
        <article className="tdash__kpi tdash__kpi--cash">
          <p className="tdash__kpi-label">Total Cash</p>
          {txnLoading ? (
            <div className="tdash__kpi-skel" aria-busy="true" aria-label="Loading total cash">
              <span className="ds-skeleton ds-skeleton--value-lg" />
            </div>
          ) : (
            <KpiAnimatedGbp amount={kpiCash?.totalCash} loading={txnLoading} />
          )}
          <p className="tdash__kpi-delta">
            {txnLoading ? (
              <span className="tdash__kpi-delta-skel ds-skeleton ds-skeleton--line" aria-hidden />
            ) : !kpiCash ? (
              <>
                Upload your data —{' '}
                <Link className="tdash__card-link" to="/upload">
                  add a bank CSV
                </Link>{' '}
                to see totals and trends.
              </>
            ) : kpiCash.deltaNet == null ? (
              <span style={{ color: '#6B7280' }}>Not enough history for month-on-month comparison.</span>
            ) : (
              <span
                className={
                  kpiCash.deltaNet > 0
                    ? 'tdash__kpi-delta--up'
                    : kpiCash.deltaNet < 0
                      ? 'tdash__kpi-delta--down'
                      : ''
                }
              >
                {kpiCash.deltaNet > 0 ? '+' : ''}
                {formatGBP(Math.round(kpiCash.deltaNet))} vs last month&apos;s net position
              </span>
            )}
          </p>
          {txnLoading ? (
            <span
              className="ds-skeleton tdash__kpi-chart-skel"
              aria-hidden
              style={{ display: 'block', height: '88px', width: '100%', marginTop: '0.25rem' }}
            />
          ) : (
            <KpiRechartsArea variant="cash" data={sparkTotalPoints} stroke="#0F0F0F" />
          )}
        </article>
        <article className="tdash__kpi tdash__kpi--yield">
          <p className="tdash__kpi-label">Effective Yield</p>
          {txnLoading ? (
            <div className="tdash__kpi-skel" aria-busy="true" aria-label="Loading effective yield">
              <span className="ds-skeleton ds-skeleton--value-lg" />
            </div>
          ) : (
            <KpiAnimatedPct pct={txnRows.length ? YIELD_CURRENT_PCT : null} loading={txnLoading} />
          )}
          <p className={!txnLoading && txnRows.length ? 'tdash__kpi-delta tdash__kpi-delta--down' : 'tdash__kpi-delta'}>
            {txnLoading ? (
              <span className="tdash__kpi-delta-skel ds-skeleton ds-skeleton--line" aria-hidden />
            ) : !txnRows.length ? (
              <>
                Upload your data —{' '}
                <Link className="tdash__card-link" to="/upload">
                  add a bank CSV
                </Link>{' '}
                to model yield on your balances.
              </>
            ) : (
              <>
                {formatPct(YIELD_CURRENT_PCT - YIELD_BEST_PCT, 2)} below best available · best{' '}
                {formatPct(YIELD_BEST_PCT, 2)}
              </>
            )}
          </p>
          {!txnLoading && txnRows.length ? (
            <p className="tdash__kpi-loss">
              £{Math.round(yieldSummary.monthlyOppCost).toLocaleString('en-GB')}/month lost to idle cash
            </p>
          ) : null}
          {!txnLoading && txnRows.length ? (
            <p className="tdash__kpi-yield-note">Blended rate is flat until live bank rates are connected — trend chart hidden.</p>
          ) : txnLoading ? (
            <span
              className="ds-skeleton tdash__kpi-chart-skel"
              aria-hidden
              style={{ display: 'block', height: '88px', width: '100%', marginTop: '0.25rem' }}
            />
          ) : null}
        </article>
        <article className="tdash__kpi tdash__kpi--runway">
          <p className="tdash__kpi-label">Runway</p>
          {txnLoading ? (
            <div className="tdash__kpi-skel" aria-busy="true" aria-label="Loading runway">
              <span className="ds-skeleton ds-skeleton--value-lg" />
            </div>
          ) : !txnRows.length ? (
            <p className="tdash__kpi-value tdash__kpi-value--muted">—</p>
          ) : (
            <KpiAnimatedRunwayMo
              months={
                txnRows.length && runwayMetrics.baseRunwayMo != null && Number.isFinite(runwayMetrics.baseRunwayMo)
                  ? runwayMetrics.baseRunwayMo
                  : null
              }
              loading={txnLoading}
            />
          )}
          <p className="tdash__kpi-delta">
            {txnLoading ? (
              <span className="tdash__kpi-delta-skel ds-skeleton ds-skeleton--line" aria-hidden />
            ) : !txnRows.length ? (
              <>
                Upload your data —{' '}
                <Link className="tdash__card-link" to="/upload">
                  add a bank CSV
                </Link>{' '}
                for runway from cash ÷ burn.
              </>
            ) : runwayMetrics.bullRunwayMo != null &&
              runwayMetrics.baseRunwayMo != null &&
              Number.isFinite(runwayMetrics.bullRunwayMo) &&
              Number.isFinite(runwayMetrics.baseRunwayMo) ? (
              runwayMetrics.bullRunwayMo > runwayMetrics.baseRunwayMo ? (
                `+${(runwayMetrics.bullRunwayMo - runwayMetrics.baseRunwayMo).toFixed(1)} mo from yield optimisation (bull case)`
              ) : (
                'Cash ÷ average monthly outflow (same as Runway & Burn)'
              )
            ) : (
              'Cash ÷ average monthly outflow (same as Runway & Burn)'
            )}
          </p>
          {txnLoading ? (
            <span
              className="ds-skeleton tdash__kpi-chart-skel"
              aria-hidden
              style={{ display: 'block', height: '88px', width: '100%', marginTop: '0.25rem' }}
            />
          ) : runwaySparklineDistorted ? (
            <p
              style={{
                margin: '0.25rem 0 0',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 12,
                fontWeight: 400,
                color: '#9CA3AF',
                lineHeight: 1.45,
              }}
            >
              Trend reflects opening balance — connect live bank for accurate history.
            </p>
          ) : (
            <KpiRechartsArea variant="runway" data={sparkRunwayPoints} stroke="#1B2B8C" />
          )}
        </article>
        <article className="tdash__kpi tdash__kpi--burn">
          <p className="tdash__kpi-label">Monthly Burn</p>
          {txnLoading ? (
            <div className="tdash__kpi-skel" aria-busy="true" aria-label="Loading burn">
              <span className="ds-skeleton ds-skeleton--value-lg" />
            </div>
          ) : (
            <KpiAnimatedGbp
              amount={txnRows.length && kpiBurnKpi ? kpiBurnKpi.monthlyBurn90 : null}
              loading={txnLoading}
            />
          )}
          <p className="tdash__kpi-delta">
            {txnLoading ? (
              <span className="tdash__kpi-delta-skel ds-skeleton ds-skeleton--line" aria-hidden />
            ) : !txnRows.length || !kpiBurnKpi ? (
              <>
                Upload your data —{' '}
                <Link className="tdash__card-link" to="/upload">
                  add a bank CSV
                </Link>{' '}
                for 90-day burn.
              </>
            ) : kpiBurnKpi.monthlyBurn90 <= 0 ? (
              'No outflows in the last 90 days'
            ) : kpiBurnKpi.deltaPct == null || !Number.isFinite(kpiBurnKpi.deltaPct) ? (
              '90-day average monthly outflow'
            ) : (
              <>
                <span
                  style={{
                    color:
                      kpiBurnKpi.deltaPct > 0 ? '#dc2626' : kpiBurnKpi.deltaPct < 0 ? '#16a34a' : undefined,
                  }}
                >
                  {kpiBurnKpi.deltaPct > 0 ? '+' : ''}
                  {kpiBurnKpi.deltaPct.toFixed(1)}% vs 90-day average
                </span>
                {' '}
                (last 30 days vs trailing 90)
              </>
            )}
          </p>
          {!txnLoading && kpiBurnKpi?.deltaPct != null && Number.isFinite(kpiBurnKpi.deltaPct) && kpiBurnKpi.deltaPct > 10 ? (
            <p className="tdash__kpi-warning">Burn worsening — review spend categories</p>
          ) : null}
          {txnLoading ? (
            <span
              className="ds-skeleton tdash__kpi-chart-skel"
              aria-hidden
              style={{ display: 'block', height: '88px', width: '100%', marginTop: '0.25rem' }}
            />
          ) : (
            <KpiRechartsArea variant="burn" data={sparkBurnPoints} stroke="#6B7280" />
          )}
        </article>
      </section>

      <DashboardSummaryCards
        loading={txnLoading}
        error={txnError}
        hasRows={txnRows.length > 0}
        yieldAnnualOpp={yieldSummary.annualOppCost}
        yieldMonthlyOpp={yieldSummary.monthlyOppCost}
        yieldTotalCash={yieldSummary.totalCash}
        concentrationMaxPct={concentration.maxPct}
        concentrationUnprotected={concentration.unprotectedTotal}
        runwayMo={runwayMetrics.baseRunwayMo}
        monthlyBurn={burnSummary.monthlyAvg}
        burnDeltaPct={kpiBurnKpi?.deltaPct ?? null}
        cfNetMonthly={cashflowSummary.netMonthly}
        cfAvgOut={cashflowSummary.avgMonthlyOut}
        cfLowCash={cashflowLowCash}
        liquidityBufferMo={liquidity.bufferMonths}
        liquidityBand={liquidity.band}
      />

      <section className="tdash__open-banking" aria-label="Open Banking">
        <div className="tdash__open-banking-inner">
          <div className="tdash__open-banking-left">
            <p className="tdash__open-banking-label">COMING SOON</p>
            <p className="tdash__open-banking-heading">Live bank connection via Open Banking</p>
            <p className="tdash__open-banking-copy">
              No CSV uploads. Automatic daily sync. Real-time alerts. Connect Barclays, HSBC, Starling, and Monzo directly.
            </p>
          </div>
          <button type="button" className="tdash__open-banking-btn" onClick={openConnectBankModal}>
            Join the waitlist →
          </button>
        </div>
      </section>
    </div>
  )
}
