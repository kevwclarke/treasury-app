import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { computeConcentrationFromTransactions } from '../utils/treasuryConcentration'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeBurn30Vs90Pct, computeTotalCashAndMoMNetDelta } from '../utils/treasuryKpi'
import {
  computeBurnSparkline,
  computeRunwaySparkline,
  computeTotalCashSparkline,
  computeYieldSparklineFlat,
  kpiChartPoints,
} from '../utils/treasuryKpiSparklines'
import {
  computeRunwayFromTransactions,
  FUNDRAISE_RUNWAY_ALERT_MONTHS,
} from '../utils/treasuryRunway'
import {
  buildCashflowMonthlySeries,
  cashflowWeeklyLowCashWarning,
  computeCashflowSummary,
  detectRecurringTransactions,
  seriesToBarHeights,
} from '../utils/treasuryCashflow'
import {
  computeLiquidityBuffer,
  LIQUIDITY_MIN_MONTHS,
  LIQUIDITY_TARGET_MONTHS,
} from '../utils/treasuryLiquidity'
import { YIELD_BEST_PCT, YIELD_CURRENT_DEC, YIELD_CURRENT_PCT, YIELD_SPREAD_DEC } from '../utils/treasuryYield'
import { getYieldGapDashboardApplyProducts } from '../data/yieldMarketplace'
import { YieldApplyConfirmModal } from './YieldApplyConfirmModal'
import { useCountUp } from '../hooks/useCountUp'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { useTreasuryAutopilotPolicy } from '../hooks/useTreasuryAutopilotPolicy'
import {
  readTreasuryDashboardView,
  TREASURY_VIEW_CONTROL,
  TREASURY_VIEW_FULL,
  writeTreasuryDashboardView,
} from '../constants/treasuryDashboardView'
import { TreasuryControlPanel } from './TreasuryControlPanel'
import { buildTreasuryReportPdfPayload } from '../utils/treasuryReportPayload'
import { computeTreasuryHealthScore100 } from '../utils/treasuryHealthScore'
import { AiTreasuryActions } from './AiTreasuryActions'
import { TreasuryHealthScoreControl } from './TreasuryHealthScoreControl'
import { KpiRechartsArea } from './KpiRechartsArea'
import { LiquidityBufferGauge } from './LiquidityBufferGauge'
import { TreasuryOnboarding } from './TreasuryOnboarding'
import './TreasuryDashboard.css'
import './TreasuryControlPanel.css'

const SESSION_SKIP_EMPTY_ONBOARD = 'treasury_skip_empty_onboarding'
const YIELD_GAP_DASHBOARD_APPLY_ROWS = getYieldGapDashboardApplyProducts()

function DashboardViewToggle({ value, onChange }) {
  return (
    <div className="tdash__view-toggle" role="radiogroup" aria-label="Treasury Autopilot layout">
      <button
        type="button"
        role="radio"
        aria-checked={value === TREASURY_VIEW_FULL}
        className={`tdash__view-toggle-btn${value === TREASURY_VIEW_FULL ? ' tdash__view-toggle-btn--active' : ''}`}
        onClick={() => onChange(TREASURY_VIEW_FULL)}
      >
        Full view
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === TREASURY_VIEW_CONTROL}
        className={`tdash__view-toggle-btn${
          value === TREASURY_VIEW_CONTROL ? ' tdash__view-toggle-btn--active' : ''
        }`}
        onClick={() => onChange(TREASURY_VIEW_CONTROL)}
      >
        Control panel
      </button>
    </div>
  )
}

const IMPORT_WELCOME_COPY = 'Your data is ready — Treasury Autopilot is live'

function liquidityCurrentCaption(liq) {
  if (liq.monthlyBurn <= 0) return 'No outflows in last 90 days'
  if (liq.bufferMonths == null) return '—'
  if (liq.bufferMonths < LIQUIDITY_MIN_MONTHS) return 'Below minimum'
  if (liq.bufferMonths <= LIQUIDITY_TARGET_MONTHS) return 'Between min & target'
  return 'Above target'
}

function liquidityThreshClass(band) {
  if (band === 'red') return 'tdash__thresh--liq-risk'
  if (band === 'amber') return 'tdash__thresh--liq-warn'
  return 'tdash__thresh--liq-ok'
}

function IconClock() {
  return (
    <svg className="tdash__alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg className="tdash__alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 10v6M12 8h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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

const TIME_FILTERS = ['1M', '3M', '6M', '1Y']

const PEER_BENCHMARK_ROWS = [
  {
    metric: 'Liquidity Buffer',
    yours: '4.2 mo',
    peer: '5.1 mo',
    position: 'Below peer',
    tone: 'amber',
  },
  {
    metric: 'Effective Yield',
    yours: '0.10%',
    peer: '1.85%',
    position: 'Below peer',
    tone: 'salmon',
  },
  {
    metric: 'Concentration',
    yours: '78%',
    peer: '42%',
    position: 'High risk',
    tone: 'red',
  },
  {
    metric: 'Runway',
    yours: '18.4 mo',
    peer: '16.2 mo',
    position: 'Above peer',
    tone: 'green',
  },
  {
    metric: 'Burn Growth MoM',
    yours: '+6.1%',
    peer: '+2.4%',
    position: 'Above peer',
    tone: 'amber',
  },
]

const TERM_STRUCTURES = ['Equity', 'SAFE', 'Convertible Note']

const BASE_CASH_GBP = 4_820_000
const BASE_MONTHLY_BURN = 265_000
const BASE_TREASURY_HEALTH = 72

function parseMoneyInput(raw) {
  const cleaned = String(raw).replace(/[£,\s]/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function analyseTermSheet(amountGbp, structure) {
  const invest = Math.max(0, amountGbp)
  const netCashMultiplier = structure === 'Convertible Note' ? 0.97 : 1
  const postCloseCash = Math.round(BASE_CASH_GBP + invest * netCashMultiplier)
  const runwayImpactMo = invest / BASE_MONTHLY_BURN
  let health = BASE_TREASURY_HEALTH + Math.min(14, runwayImpactMo * 1.85)
  if (structure === 'Equity') health += 2.5
  if (structure === 'SAFE') health += 1.5
  if (structure === 'Convertible Note') health += 0.5
  const postMoneyHealth = Math.min(96, Math.round(health))
  return { postCloseCash, runwayImpactMo, postMoneyHealth }
}

export function TreasuryDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [timeFilter, setTimeFilter] = useState('3M')
  const [burnSlider, setBurnSlider] = useState(8)
  const [hireSlider, setHireSlider] = useState(3)
  const [arrSlider, setArrSlider] = useState(42)

  const [tsAmount, setTsAmount] = useState('2,500,000')
  const [tsStructure, setTsStructure] = useState('SAFE')
  const [tsCloseDate, setTsCloseDate] = useState('')
  const [tsResults, setTsResults] = useState(null)

  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()
  const [cfChartReady, setCfChartReady] = useState(false)
  const [burnBarsReady, setBurnBarsReady] = useState(false)
  const [onboardingSkipped, setOnboardingSkipped] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SESSION_SKIP_EMPTY_ONBOARD) === '1',
  )
  const [importToast, setImportToast] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const pdfLockRef = useRef(false)
  const autopilot = useTreasuryAutopilotPolicy()
  const [dashboardView, setDashboardView] = useState(() =>
    typeof window !== 'undefined' ? readTreasuryDashboardView() : TREASURY_VIEW_FULL,
  )
  const [yieldApplyProduct, setYieldApplyProduct] = useState(null)

  const handleDashboardViewChange = useCallback((mode) => {
    setDashboardView(mode)
    writeTreasuryDashboardView(mode)
  }, [])

  const skipEmptyOnboarding = useCallback(() => {
    sessionStorage.setItem(SESSION_SKIP_EMPTY_ONBOARD, '1')
    setOnboardingSkipped(true)
  }, [])

  const handleGenerateInvestorPdf = useCallback(async () => {
    if (pdfLockRef.current) return
    pdfLockRef.current = true
    setPdfLoading(true)
    try {
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve())
      })
      const payload = buildTreasuryReportPdfPayload(txnRows)
      const { downloadTreasuryInvestorPdf } = await import('../utils/treasuryInvestorPdf')
      downloadTreasuryInvestorPdf(payload)
    } catch (e) {
      window.alert(e?.message ?? 'Could not generate PDF. Please try again.')
    } finally {
      setPdfLoading(false)
      pdfLockRef.current = false
    }
  }, [txnRows])

  const { runwayMo, burnModel } = useMemo(() => {
    const baseRunway = 18.4
    const baseBurn = 265_000
    const runway = Math.max(
      4.5,
      baseRunway - burnSlider * 0.22 - hireSlider * 0.85 + arrSlider * 0.06,
    )
    const burn = baseBurn * (1 + burnSlider / 100) + hireSlider * 8_200 - arrSlider * 1_400
    return { runwayMo: runway, burnModel: Math.max(195_000, burn) }
  }, [burnSlider, hireSlider, arrSlider])

  useEffect(() => {
    if (txnLoading || !txnRows.length) {
      setCfChartReady(false)
      return undefined
    }
    const t = window.setTimeout(() => setCfChartReady(true), 120)
    return () => window.clearTimeout(t)
  }, [txnLoading, txnRows.length])

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

    // Last 90 days → monthly average (30-day equivalent)
    const monthlyAvg = total > 0 ? (total / 90) * 30 : 0

    return { monthlyAvg, categories, total }
  }, [burnRows])

  const yieldSummary = useMemo(() => {
    const totalCash = (txnRows ?? []).reduce((s, t) => {
      const a = Number(t.amount)
      return s + (Number.isFinite(a) ? a : 0)
    }, 0)
    const annualOppCost = totalCash * YIELD_SPREAD_DEC
    const monthlyOppCost = annualOppCost / 12

    return {
      totalCash,
      annualOppCost,
      monthlyOppCost,
    }
  }, [txnRows])

  const concentration = useMemo(() => computeConcentrationFromTransactions(txnRows), [txnRows])

  const runwayMetrics = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])

  const cashflowSummary = useMemo(() => computeCashflowSummary(txnRows), [txnRows])

  const cashflowMonthlySeries = useMemo(
    () => buildCashflowMonthlySeries(txnRows, cashflowSummary, 90),
    [txnRows, cashflowSummary],
  )

  const cashflowBars = useMemo(() => seriesToBarHeights(cashflowMonthlySeries), [cashflowMonthlySeries])

  const recurringTxns = useMemo(() => detectRecurringTransactions(txnRows), [txnRows])

  const cashflowLowCash = useMemo(
    () => cashflowWeeklyLowCashWarning(cashflowSummary, 13),
    [cashflowSummary],
  )

  const liquidity = useMemo(() => computeLiquidityBuffer(txnRows), [txnRows])

  const kpiCash = useMemo(() => computeTotalCashAndMoMNetDelta(txnRows), [txnRows])

  const kpiBurnKpi = useMemo(() => computeBurn30Vs90Pct(txnRows), [txnRows])

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

  const sparkTotalPoints = useMemo(
    () => kpiChartPoints(computeTotalCashSparkline(txnRows)),
    [txnRows],
  )

  const sparkRunwayPoints = useMemo(() => kpiChartPoints(computeRunwaySparkline(txnRows)), [txnRows])

  const sparkBurnPoints = useMemo(() => kpiChartPoints(computeBurnSparkline(txnRows)), [txnRows])

  const sparkYieldPoints = useMemo(() => kpiChartPoints(computeYieldSparklineFlat()), [])

  const showFundraiseAlert =
    !txnLoading &&
    (txnRows?.length ?? 0) > 0 &&
    runwayMetrics.baseRunwayMo != null &&
    Number.isFinite(runwayMetrics.baseRunwayMo) &&
    runwayMetrics.baseRunwayMo < FUNDRAISE_RUNWAY_ALERT_MONTHS

  useEffect(() => {
    if (txnLoading || burnSummary.total === 0) {
      setBurnBarsReady(false)
      return undefined
    }
    const t = window.setTimeout(() => setBurnBarsReady(true), 100)
    return () => window.clearTimeout(t)
  }, [txnLoading, burnSummary.total])

  const showEmptyOnboarding = !txnLoading && !txnError && txnRows.length === 0 && !onboardingSkipped

  useEffect(() => {
    const on = txnLoading || pdfLoading
    document.body.classList.toggle('app-data-loading', on)
    return () => document.body.classList.remove('app-data-loading')
  }, [txnLoading, pdfLoading])

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
          <h1 className="tdash__page-title">Treasury Autopilot</h1>
          <p className="tdash__page-subtitle">Maintaining your runway. Automatically.</p>
          <DashboardViewToggle value={dashboardView} onChange={handleDashboardViewChange} />
        </div>
        <div className="tdash__topbar-actions">
          {dashboardView === TREASURY_VIEW_FULL ? (
            <div className="tdash__filters" role="group" aria-label="Time range">
              {TIME_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tdash__filter-btn${timeFilter === t ? ' tdash__filter-btn--active' : ''}`}
                  onClick={() => setTimeFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          <TreasuryHealthScoreControl score={treasuryHealthScore} loading={txnLoading} />
          <button type="button" className="tdash__btn tdash__btn--primary">
            Connect Bank
          </button>
        </div>
      </header>

      {dashboardView === TREASURY_VIEW_CONTROL ? (
        <TreasuryControlPanel
          txnLoading={txnLoading}
          txnError={txnError}
          txnRows={txnRows}
          autopilot={autopilot}
        />
      ) : (
        <>
      <section className="tdash__alerts" aria-label="Priority alerts">
        {showFundraiseAlert ? (
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
        ) : null}
        <div className="tdash__alert tdash__alert--amber">
          <div className="tdash__alert-main">
            <IconClock />
            <div>
              <p className="tdash__alert-title">Idle cash opportunity cost</p>
              <p className="tdash__alert-meta">
                {txnLoading ? (
                  <>Loading idle-cash signal…</>
                ) : txnRows.length ? (
                  <>
                    <strong>{formatGBP(Math.round(yieldSummary.annualOppCost))}</strong> annual opportunity cost
                    (≈ <strong>{formatGBP(Math.round(yieldSummary.monthlyOppCost))}</strong> / month) on{' '}
                    <strong>{formatGBP(Math.round(yieldSummary.totalCash))}</strong> net cash at{' '}
                    <strong>{formatPct(YIELD_CURRENT_PCT, 2)}</strong> vs <strong>{formatPct(YIELD_BEST_PCT, 2)}</strong>{' '}
                    best-available.
                  </>
                ) : (
                  <>
                    <strong>{formatGBP(428_000)}</strong> at 0.10% for <strong>94 days</strong> vs best-available
                    benchmarks. <Link to="/upload">Upload statement</Link> for your numbers.
                  </>
                )}
              </p>
            </div>
          </div>
          <button type="button" className="tdash__alert-action tdash__alert-action--amber">
            Fix This
          </button>
        </div>
        <div className="tdash__alert tdash__alert--info">
          <div className="tdash__alert-main">
            <IconInfo />
            <div>
              <p className="tdash__alert-title">Bank feed health</p>
              <p className="tdash__alert-meta">
                Primary Barclays connection is stable. Secondary Starling token renews in <strong>18 days</strong> — no
                action required.
              </p>
            </div>
          </div>
          <button type="button" className="tdash__alert-action tdash__alert-action--blue">
            View connections
          </button>
        </div>
      </section>

      <section className="tdash__autopilot" aria-label="Treasury Autopilot">
        <div className="tdash__autopilot-head">
          <div>
            <h2 className="tdash__autopilot-title">Treasury Autopilot</h2>
            <p className="tdash__autopilot-sub">Set your policies and we maintain them automatically</p>
          </div>
          <Link className="tdash__autopilot-link" to="/app/burn-intelligence">
            Configure Autopilot
          </Link>
        </div>

        {!autopilot.loading && !autopilot.configured ? (
          <p className="tdash__autopilot-empty">
            Autopilot not configured — set your treasury policies to activate.
          </p>
        ) : (
          <div className="tdash__autopilot-rows">
            <div className="tdash__autopilot-row">
              <span
                className={[
                  'tdash__autopilot-dot',
                  runwayMetrics.baseRunwayMo != null &&
                  Number.isFinite(runwayMetrics.baseRunwayMo) &&
                  runwayMetrics.baseRunwayMo >= autopilot.minRunwayMonths
                    ? 'tdash__autopilot-dot--good'
                    : 'tdash__autopilot-dot--risk',
                ].join(' ')}
                aria-hidden
              />
              <span className="tdash__autopilot-label">Minimum runway {autopilot.minRunwayMonths} months</span>
              <span className="tdash__autopilot-val">
                current{' '}
                {runwayMetrics.baseRunwayMo != null && Number.isFinite(runwayMetrics.baseRunwayMo)
                  ? `${runwayMetrics.baseRunwayMo.toFixed(1)} months`
                  : '—'}
              </span>
            </div>
            <div className="tdash__autopilot-row">
              <span
                className={[
                  'tdash__autopilot-dot',
                  concentration.maxPct <= 75 ? 'tdash__autopilot-dot--good' : 'tdash__autopilot-dot--risk',
                ].join(' ')}
                aria-hidden
              />
              <span className="tdash__autopilot-label">Maximum concentration 75%</span>
              <span className="tdash__autopilot-val">current {formatPct(concentration.maxPct, 1)}</span>
            </div>
            <div className="tdash__autopilot-row">
              <span
                className={[
                  'tdash__autopilot-dot',
                  YIELD_CURRENT_PCT >= 4 ? 'tdash__autopilot-dot--good' : 'tdash__autopilot-dot--risk',
                ].join(' ')}
                aria-hidden
              />
              <span className="tdash__autopilot-label">Minimum yield 4%</span>
              <span className="tdash__autopilot-val">current {formatPct(YIELD_CURRENT_PCT, 2)}</span>
            </div>
          </div>
        )}
      </section>

      <section className="tdash__promo" aria-label="Investor-ready report">
        <div className="tdash__promo-copy">
          <h2 className="tdash__promo-title">Investor-Ready Treasury Report</h2>
          <p className="tdash__promo-desc">
            Five-page investor pack: health score, cash, runway, concentration, and capital moves — from live data.
          </p>
        </div>
        <div className="tdash__promo-preview" aria-hidden />
        <div className="tdash__promo-side">
          <button
            type="button"
            className="tdash__btn tdash__btn--primary"
            onClick={handleGenerateInvestorPdf}
            disabled={pdfLoading}
            aria-busy={pdfLoading}
          >
            {pdfLoading ? 'Generating…' : 'Generate PDF'}
          </button>
        </div>
      </section>

      <section className="tdash__kpis" aria-label="Key performance indicators">
        <article className="tdash__kpi">
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
        <article className="tdash__kpi">
          <p className="tdash__kpi-label">Effective Yield</p>
          {txnLoading ? (
            <div className="tdash__kpi-skel" aria-busy="true" aria-label="Loading effective yield">
              <span className="ds-skeleton ds-skeleton--value-lg" />
            </div>
          ) : (
            <KpiAnimatedPct pct={txnRows.length ? YIELD_CURRENT_PCT : null} loading={txnLoading} />
          )}
          <p
            className={
              !txnLoading && txnRows.length
                ? 'tdash__kpi-delta tdash__kpi-delta--down'
                : 'tdash__kpi-delta'
            }
          >
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
          {txnLoading ? (
            <span
              className="ds-skeleton tdash__kpi-chart-skel"
              aria-hidden
              style={{ display: 'block', height: '88px', width: '100%', marginTop: '0.25rem' }}
            />
          ) : (
            <KpiRechartsArea variant="yield" data={sparkYieldPoints} stroke="#DC2626" />
          )}
        </article>
        <article className="tdash__kpi">
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
              `+${(runwayMetrics.bullRunwayMo - runwayMetrics.baseRunwayMo).toFixed(1)} mo from yield optimisation (bull case)`
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
          ) : (
            <KpiRechartsArea variant="runway" data={sparkRunwayPoints} stroke="#1B2B8C" />
          )}
        </article>
        <article className="tdash__kpi">
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
                  className={
                    kpiBurnKpi.deltaPct > 0
                      ? 'tdash__kpi-delta--down'
                      : kpiBurnKpi.deltaPct < 0
                        ? 'tdash__kpi-delta--up'
                        : ''
                  }
                >
                  {kpiBurnKpi.deltaPct > 0 ? '+' : ''}
                  {kpiBurnKpi.deltaPct.toFixed(1)}% vs 90-day average
                </span>
                {' '}
                (last 30 days vs trailing 90)
              </>
            )}
          </p>
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

      <AiTreasuryActions
        txnLoading={txnLoading}
        txnError={txnError}
        txnRows={txnRows}
        runwayMetrics={runwayMetrics}
        yieldSummary={yieldSummary}
        concentration={concentration}
        burnSummary={burnSummary}
      />

      <div className="tdash__grid">
        {/* Yield gap */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Yield Gap Analysis</h2>
            <a className="tdash__card-link" href="#optimise">
              Optimise
            </a>
          </div>
          <p className="tdash__card-sub">Idle cash earnings vs. best available — monthly recalculated</p>
          {txnLoading ? (
            <div className="tdash__yield-skel" aria-busy="true" aria-label="Loading yield gap">
              <span className="ds-skeleton ds-skeleton--title" />
              <span className="ds-skeleton ds-skeleton--value-lg" />
              <div className="ds-skeleton-grid">
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line" />
              </div>
            </div>
          ) : txnError ? (
            <div className="tdash__msg--error">{txnError}</div>
          ) : txnRows.length === 0 ? (
            <div className="tdash__burn-warn">
              Upload a bank statement to see your yield gap.{' '}
              <Link className="tdash__card-link" to="/upload">
                Go to upload
              </Link>
            </div>
          ) : (
            <>
              <p className="tdash__yield-total-cash">
                <span className="tdash__yield-total-cash-label">Total cash (net)</span>
                <span className="tdash__yield-total-cash-val">{formatGBP(Math.round(yieldSummary.totalCash))}</span>
                <span className="tdash__yield-total-cash-note">
                  Sum of all transaction amounts · updates when you import a new CSV
                </span>
              </p>
              <div className="tdash__yield-stats">
                <div>
                  <p className="tdash__stat-cap">Annual opportunity cost</p>
                  <p className="tdash__stat-big tdash__stat-big--salmon">
                    {formatGBP(Math.round(yieldSummary.annualOppCost))}
                  </p>
                  <p className="tdash__stat-note">
                    Total cash × (0.0512 − 0.001) · ≈ {formatGBP(Math.round(yieldSummary.monthlyOppCost))} / month
                  </p>
                </div>
                <div>
                  <p className="tdash__stat-cap">Earning now</p>
                  <p className="tdash__stat-big tdash__stat-big--salmon">{formatPct(YIELD_CURRENT_PCT, 2)}</p>
                  <p className="tdash__stat-note">Barclays Business Current (default)</p>
                </div>
                <div>
                  <p className="tdash__stat-cap">Best available</p>
                  <p className="tdash__stat-big tdash__stat-big--green">{formatPct(YIELD_BEST_PCT, 2)}</p>
                  <p className="tdash__stat-note">BlackRock Liquidity Fund (placeholder)</p>
                </div>
              </div>
              <table className="tdash__table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Rate</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Barclays Business Current</td>
                    <td className="tdash__rate-current">{formatPct(YIELD_CURRENT_PCT, 2)}</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td>BoE Base Rate</td>
                    <td className="tdash__rate-bench">{formatPct(4.75, 2)}</td>
                    <td />
                  </tr>
                  {YIELD_GAP_DASHBOARD_APPLY_ROWS.map((p) => (
                    <tr key={p.name}>
                      <td>
                        {p.name}
                        {p.name === 'BlackRock Liquidity Fund' ? (
                          <span className="tdash__tag-rec">Recommended</span>
                        ) : null}
                      </td>
                      <td className="tdash__rate-best">{formatPct(p.ratePct, 2)}</td>
                      <td>
                        <button
                          type="button"
                          className="tdash__apply"
                          onClick={() => setYieldApplyProduct(p)}
                        >
                          Apply
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </article>

        {/* Concentration */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Concentration Risk</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {txnLoading ? (
                <span className="tdash__badge tdash__badge--neutral">…</span>
              ) : txnRows.length === 0 ? null : (
                <span
                  className={`tdash__badge${
                    concentration.riskTone === 'red'
                      ? ' tdash__badge--red'
                      : concentration.riskTone === 'amber'
                        ? ' tdash__badge--amber'
                        : ' tdash__badge--neutral'
                  }`}
                >
                  {concentration.riskLabel} · top {formatPct(concentration.maxPct, 1)}
                </span>
              )}
              <Link className="tdash__card-link" to="/app/concentration">
                Full detail
              </Link>
            </div>
          </div>
          <p className="tdash__card-sub">
            Single-institution exposure vs policy and FSCS limits. Each row uses the bank you chose when importing the CSV.
          </p>
          {txnLoading ? (
            <div className="tdash__burn-skel" aria-busy="true" aria-label="Loading concentration">
              <span className="ds-skeleton ds-skeleton--line" />
              <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" />
            </div>
          ) : txnRows.length === 0 ? (
            <div className="tdash__burn-warn">
              Upload a bank statement to see concentration by institution.{' '}
              <Link className="tdash__card-link" to="/upload">
                Go to upload
              </Link>
            </div>
          ) : concentration.totalCash <= 0 ? (
            <p className="tdash__card-sub" style={{ marginTop: '0.5rem' }}>
              Net cash from transactions is not positive — add inflows or check your import.
            </p>
          ) : (
            <>
              <div className="tdash__stack" aria-hidden>
                {concentration.barSegments.map((seg) => (
                  <div
                    key={seg.name}
                    className="tdash__stack-seg"
                    style={{ width: `${seg.widthPct}%`, background: seg.color }}
                  />
                ))}
              </div>
              <div className="tdash__stack-labels">
                {concentration.barSegments.map((seg) => (
                  <span key={seg.name}>
                    {formatPct((seg.balance / concentration.totalCash) * 100, 1)} {seg.name}
                  </span>
                ))}
              </div>
              <div>
                {concentration.institutionRows
                  .filter((r) => Math.abs(r.balance) > 0.005)
                  .map((r) => (
                    <div key={r.name} className="tdash__acct-row tdash__acct-row--concentration">
                      <span className="tdash__bank-badge">{r.badge}</span>
                      <span className="tdash__acct-name">{r.name}</span>
                      <span className="tdash__acct-bal">{formatGBP(Math.round(r.balance))}</span>
                      <span className="tdash__acct-pct">{formatPct(r.pctOfTotal, 1)}</span>
                    </div>
                  ))}
              </div>
              <p className="tdash__warn-foot">
                <strong>{formatGBP(Math.round(concentration.unprotectedTotal))}</strong> total unprotected above FSCS
                (£85,000 per institution). Review sweeps and second-bank structures if material.
              </p>
            </>
          )}
        </article>

        {/* Runway */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Runway</h2>
            <Link className="tdash__card-link" to="/app/runway">
              Full model
            </Link>
          </div>
          <p className="tdash__card-sub">
            Net cash ÷ average monthly outflow from your CSV date range. Bear +15% burn; bull adds monthly yield gap
            to cash.
          </p>
          {txnLoading ? (
            <div className="tdash__burn-skel" aria-busy="true" aria-label="Loading runway">
              <span className="ds-skeleton ds-skeleton--value-lg" />
              <span className="ds-skeleton ds-skeleton--line" />
            </div>
          ) : !txnRows.length ? (
            <div className="tdash__burn-warn">
              Upload transactions to see runway scenarios.{' '}
              <Link className="tdash__card-link" to="/upload">
                Go to upload
              </Link>
            </div>
          ) : runwayMetrics.baseRunwayMo == null || !Number.isFinite(runwayMetrics.baseRunwayMo) ? (
            <p className="tdash__card-sub" style={{ marginTop: '0.5rem' }}>
              No negative outflows in your data — runway cannot be calculated.
            </p>
          ) : (
            <>
              <p className="tdash__runway-hero">
                {runwayMetrics.baseRunwayMo.toFixed(1)}
                <span>mo remaining (base)</span>
              </p>
              <div className="tdash__scenarios">
                <div className="tdash__scenario tdash__scenario--bear">
                  <p className="tdash__scenario-label">Bear</p>
                  <p className="tdash__scenario-mo" style={{ color: 'var(--td-red)' }}>
                    {runwayMetrics.bearRunwayMo != null ? runwayMetrics.bearRunwayMo.toFixed(1) : '—'}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}> mo</span>
                  </p>
                  <p className="tdash__scenario-note">+15% burn vs base</p>
                </div>
                <div className="tdash__scenario tdash__scenario--base">
                  <p className="tdash__scenario-label">Base</p>
                  <p className="tdash__scenario-mo" style={{ color: 'var(--td-amber)' }}>
                    {runwayMetrics.baseRunwayMo.toFixed(1)}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}> mo</span>
                  </p>
                  <p className="tdash__scenario-note">Current trajectory</p>
                </div>
                <div className="tdash__scenario tdash__scenario--bull">
                  <p className="tdash__scenario-label">Bull</p>
                  <p className="tdash__scenario-mo" style={{ color: 'var(--td-green)' }}>
                    {runwayMetrics.bullRunwayMo != null ? runwayMetrics.bullRunwayMo.toFixed(1) : '—'}
                    <span style={{ fontSize: '0.75rem', fontWeight: 500 }}> mo</span>
                  </p>
                  <p className="tdash__scenario-note">Yield optimised (+ monthly opp. cost to cash)</p>
                </div>
              </div>
              <div className="tdash__timeline" aria-hidden>
                <div className="tdash__timeline-track" />
                <div
                  className="tdash__timeline-fill"
                  style={{
                    width: `${Math.min(100, (runwayMetrics.baseRunwayMo / 24) * 100)}%`,
                  }}
                />
                <div className="tdash__timeline-mark" style={{ left: '0%' }}>
                  Now
                </div>
                <div className="tdash__timeline-mark" style={{ left: '25%' }}>
                  6mo
                </div>
                <div className="tdash__timeline-mark" style={{ left: '50%' }}>
                  12mo
                </div>
                <div className="tdash__timeline-mark tdash__timeline-mark--fundraise" style={{ left: '75%' }}>
                  18mo · raise
                </div>
                <div className="tdash__timeline-mark" style={{ left: '100%' }}>
                  24mo
                </div>
              </div>
            </>
          )}
        </article>

        {/* Scenario modeller */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Scenario Modeller</h2>
            <span className="tdash__badge tdash__badge--neutral">Interactive</span>
          </div>
          <p className="tdash__card-sub">Move assumptions — outputs refresh instantly (illustrative).</p>
          <div className="tdash__slider-block">
            <div className="tdash__slider-label">
              <span>Burn rate change</span>
              <span className="tdash__slider-val">{formatPct(burnSlider, 0)}</span>
            </div>
            <input
              className="tdash__slider"
              type="range"
              min="-5"
              max="25"
              value={burnSlider}
              onChange={(e) => setBurnSlider(Number(e.target.value))}
              aria-valuetext={`${burnSlider}%`}
            />
          </div>
          <div className="tdash__slider-block">
            <div className="tdash__slider-label">
              <span>New hires</span>
              <span className="tdash__slider-val">{hireSlider} people</span>
            </div>
            <input
              className="tdash__slider"
              type="range"
              min="0"
              max="12"
              value={hireSlider}
              onChange={(e) => setHireSlider(Number(e.target.value))}
            />
          </div>
          <div className="tdash__slider-block">
            <div className="tdash__slider-label">
              <span>New ARR closed (monthly)</span>
              <span className="tdash__slider-val">{formatGBP(arrSlider * 1_000)}</span>
            </div>
            <input
              className="tdash__slider"
              type="range"
              min="0"
              max="120"
              value={arrSlider}
              onChange={(e) => setArrSlider(Number(e.target.value))}
            />
          </div>
          <div className="tdash__outputs">
            <div className="tdash__out-box">
              <p className="tdash__out-cap">Modelled Runway</p>
              <p className="tdash__out-val">{runwayMo.toLocaleString('en-GB', { maximumFractionDigits: 1 })} mo</p>
            </div>
            <div className="tdash__out-box">
              <p className="tdash__out-cap">Monthly Burn</p>
              <p className="tdash__out-val">{formatGBP(burnModel)}</p>
            </div>
          </div>
        </article>

        {/* Burn breakdown */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <div className="tdash__burn-head">
              <h2 className="tdash__card-title">Burn Rate Breakdown</h2>
              <span className="tdash__trend" aria-label="Rising trend">
                ↗ Rising
              </span>
            </div>
          </div>
          <p className="tdash__card-sub">Where your cash is going, month by month</p>
          {txnLoading ? (
            <div className="tdash__burn-skel" aria-busy="true" aria-label="Loading burn breakdown">
              <span className="ds-skeleton ds-skeleton--value-lg" />
              <span className="ds-skeleton ds-skeleton--line" />
              <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" />
              <span className="ds-skeleton ds-skeleton--line" />
            </div>
          ) : txnError ? (
            <div className="tdash__msg--error">{txnError}</div>
          ) : burnSummary.total === 0 ? (
            <div className="tdash__burn-warn">
              Upload a bank statement to see your burn breakdown.{' '}
              <Link className="tdash__card-link" to="/upload">
                Go to upload
              </Link>
            </div>
          ) : (
            <>
              <p className="tdash__burn-avg">{formatGBP(Math.round(burnSummary.monthlyAvg))}</p>
              <div className={burnBarsReady ? 'tdash__burn-bars tdash__burn-bars--ready' : 'tdash__burn-bars'}>
                {burnSummary.categories.map((c) => (
                  <div key={c.name} className="tdash__cat-row">
                    <div className="tdash__cat-top">
                      <span className="tdash__cat-name">{c.name}</span>
                      <span>
                        <span className="tdash__cat-amt">{formatGBP(Math.round(c.amount))}</span>
                        <span className="tdash__cat-pct">{c.pct}%</span>
                      </span>
                    </div>
                    <div className="tdash__cat-bar-wrap">
                      <div className="tdash__cat-bar" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        {/* Cash flow forecast */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Cash Flow Forecast</h2>
          </div>
          <p className="tdash__card-sub">
            Monthly net movement from your import, then a 90-day projection using average inflow and outflow.
          </p>
          {txnLoading ? (
            <div className="tdash__burn-skel" aria-busy="true" aria-label="Loading cash flow">
              <span className="ds-skeleton ds-skeleton--value-lg" />
              <span className="ds-skeleton ds-skeleton--line" />
            </div>
          ) : !txnRows.length ? (
            <p className="detail-muted" style={{ margin: 0 }}>
              Upload a bank statement to see cash flow.{' '}
              <Link className="tdash__card-link" to="/upload">
                Upload statement
              </Link>
            </p>
          ) : (
            <>
              <div className="tdash__cf-stats">
                <div className="tdash__cf-stat">
                  <p className="tdash__cf-stat-cap">Avg Monthly In</p>
                  <p className="tdash__cf-stat-val tdash__cf-stat-val--in">
                    {formatGBP(Math.round(cashflowSummary.avgMonthlyIn))}
                  </p>
                </div>
                <div className="tdash__cf-stat">
                  <p className="tdash__cf-stat-cap">Avg Monthly Out</p>
                  <p className="tdash__cf-stat-val tdash__cf-stat-val--out">
                    {formatGBP(Math.round(cashflowSummary.avgMonthlyOut))}
                  </p>
                </div>
                <div className="tdash__cf-stat">
                  <p className="tdash__cf-stat-cap">Net Monthly</p>
                  <p className="tdash__cf-stat-val tdash__cf-stat-val--net">
                    {formatGBP(Math.round(cashflowSummary.netMonthly))}
                  </p>
                </div>
              </div>
              {cashflowLowCash ? (
                <div
                  className="tdash__alert tdash__alert--amber"
                  style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}
                  role="status"
                >
                  <div className="tdash__alert-main">
                    <IconClock />
                    <div>
                      <p className="tdash__alert-title">Low cash trajectory</p>
                      <p className="tdash__alert-meta">
                        Projected balance within the next ~90 days falls below one month of average outflow (
                        {formatGBP(Math.round(cashflowSummary.avgMonthlyOut))}). Review timing of inflows and liquidity
                        buffers.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div
                className={`tdash__cf-chart${cfChartReady ? ' tdash__cf-chart--ready' : ''}`}
                role="img"
                aria-label="Monthly net cash movement; shaded bars are projected from averages"
              >
                {cashflowBars.map((m, i) => (
                  <div key={m.key} className="tdash__cf-col">
                    <div
                      className={`tdash__cf-bar${m.proj ? ' tdash__cf-bar--proj' : ''}${m.neg ? ' tdash__cf-bar--neg' : ''}`}
                      style={{
                        height: `${m.hPct}%`,
                        animationDelay: cfChartReady ? `${i * 0.04}s` : undefined,
                      }}
                    />
                    <span className="tdash__cf-month">{m.label}</span>
                  </div>
                ))}
              </div>
              {recurringTxns.length > 0 ? (
                <div style={{ marginTop: '1rem' }}>
                  <p
                    className="tdash__stat-cap"
                    style={{ marginBottom: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
                  >
                    Recurring transactions
                  </p>
                  <table className="detail-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th>Payee</th>
                        <th>Amount</th>
                        <th>Frequency</th>
                        <th>Next expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringTxns.map((r) => (
                        <tr key={r.payee}>
                          <td>{r.payee}</td>
                          <td>{formatGBP(Math.round(r.amount))}</td>
                          <td>{r.frequency}</td>
                          <td>{r.nextExpected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}
        </article>

        {/* Liquidity buffer */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Liquidity Buffer</h2>
            <Link className="tdash__card-link" to="/app/liquidity">
              Full detail
            </Link>
          </div>
          <p className="tdash__card-sub">
            Accessible cash from your import vs average monthly outflow (last 90 days). Ring ticks:{' '}
            {LIQUIDITY_MIN_MONTHS} mo minimum and {LIQUIDITY_TARGET_MONTHS} mo target on a {LIQUIDITY_TARGET_MONTHS}
            -month scale.
          </p>
          {txnLoading ? (
            <div className="tdash__burn-skel" aria-busy="true" aria-label="Loading liquidity">
              <span className="ds-skeleton ds-skeleton--value-lg" />
              <span className="ds-skeleton ds-skeleton--line" />
            </div>
          ) : !txnRows.length ? (
            <p className="detail-muted" style={{ margin: 0 }}>
              Upload a bank statement to model your liquidity buffer.{' '}
              <Link className="tdash__card-link" to="/upload">
                Upload statement
              </Link>
            </p>
          ) : (
            <>
              <div className="tdash__liq-gauge-wrap">
                <LiquidityBufferGauge bufferMonths={liquidity.bufferMonths} band={liquidity.band} size={80} />
                <div className="tdash__thresholds">
                  <div className="tdash__thresh">
                    <span className="tdash__thresh-cap">{LIQUIDITY_MIN_MONTHS} mo minimum</span>
                    <span className="tdash__thresh-val">{formatGBP(Math.round(liquidity.minCash3mo))}</span>
                  </div>
                  <div className="tdash__thresh">
                    <span className="tdash__thresh-cap">{LIQUIDITY_TARGET_MONTHS} mo target</span>
                    <span className="tdash__thresh-val">{formatGBP(Math.round(liquidity.targetCash6mo))}</span>
                  </div>
                  <div className={`tdash__thresh ${liquidityThreshClass(liquidity.band)}`}>
                    <span className="tdash__thresh-cap">
                      Current ·{' '}
                      {liquidity.bufferMonths != null && Number.isFinite(liquidity.bufferMonths)
                        ? `${liquidity.bufferMonths.toLocaleString('en-GB', { maximumFractionDigits: 1 })} mo`
                        : liquidity.monthlyBurn <= 0
                          ? '∞'
                          : '—'}
                    </span>
                    <span className="tdash__thresh-val">{formatGBP(Math.round(liquidity.totalCash))}</span>
                  </div>
                </div>
              </div>
              <p className="tdash__liq-foot">{liquidityCurrentCaption(liquidity)}</p>
              <div className="tdash__liq-rows">
                <div className="tdash__liq-row">
                  <span>3-month obligations</span>
                  <strong>{formatGBP(Math.round(liquidity.obligations3mo))}</strong>
                </div>
                <div className="tdash__liq-row">
                  <span>Buffer excess</span>
                  <strong
                    style={{
                      color: liquidity.bufferExcess < 0 ? '#DC2626' : '#1B2B8C',
                    }}
                  >
                    {formatGBP(Math.round(liquidity.bufferExcess))}
                  </strong>
                </div>
              </div>
              <p className="tdash__liq-yield-msg">
                {liquidity.eligibleForYield > 0 ? (
                  <>
                    Only cash above the {LIQUIDITY_TARGET_MONTHS}-month target buffer is eligible for yield
                    optimisation: <strong>{formatGBP(Math.round(liquidity.eligibleForYield))}</strong>.
                  </>
                ) : (
                  <>
                    Cash above the {LIQUIDITY_TARGET_MONTHS}-month target buffer is eligible for yield optimisation.
                    On your current import that amount is <strong>{formatGBP(0)}</strong> (target buffer{' '}
                    {formatGBP(Math.round(liquidity.targetCash6mo))}).
                  </>
                )}
              </p>
            </>
          )}
        </article>

        {/* FX */}
        <article className="tdash__card">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">FX Exposure</h2>
            <span className="tdash__badge tdash__badge--amber">Monitor</span>
          </div>
          <p className="tdash__card-sub">Recurring USD/EUR receipts re-measured monthly at spot</p>
          <div>
            <div className="tdash__fx-row">
              <span className="tdash__fx-code" aria-hidden>
                USD
              </span>
              <span className="tdash__fx-pair">USD → GBP</span>
              <span className="tdash__fx-amt">$182,000 / mo</span>
              <span className="tdash__fx-amt">{formatGBP(142_600)}</span>
              <span className="tdash__fx-risk">{formatGBP(7130)}</span>
            </div>
            <div className="tdash__fx-row">
              <span className="tdash__fx-code" aria-hidden>
                EUR
              </span>
              <span className="tdash__fx-pair">EUR → GBP</span>
              <span className="tdash__fx-amt">€96,400 / mo</span>
              <span className="tdash__fx-amt">{formatGBP(82_900)}</span>
              <span className="tdash__fx-risk">{formatGBP(4145)}</span>
            </div>
          </div>
          <p className="tdash__fx-foot">
            Impact of a <strong>5%</strong> GBP move on effective monthly burn: <strong>{formatGBP(11_275)}</strong>{' '}
            (illustrative, 1-month VaR-style).
          </p>
        </article>

        {/* Peer Benchmarks */}
        <article className="tdash__card tdash__card--wide">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Peer Benchmarks</h2>
            <Link className="tdash__card-link" to="/app/benchmarks">
              Full report
            </Link>
          </div>
          <p className="tdash__card-sub">
            Anonymous aggregate vs. UK Series A–B SaaS cohort (similar headcount, burn, cash). Updated monthly.
          </p>
          <div className="tdash__peer-table-wrap">
            <table className="tdash__peer-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Your value</th>
                  <th>Peer average</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {PEER_BENCHMARK_ROWS.map((row) => (
                  <tr key={row.metric}>
                    <td className="tdash__peer-metric">{row.metric}</td>
                    <td className="tdash__peer-val">{row.yours}</td>
                    <td className="tdash__peer-val tdash__peer-val--muted">{row.peer}</td>
                    <td>
                      <span className={`tdash__peer-position tdash__peer-position--${row.tone}`}>
                        {row.position}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {/* Term Sheet Cash Impact */}
        <article className="tdash__card tdash__card--wide">
          <div className="tdash__card-head">
            <h2 className="tdash__card-title">Term Sheet Cash Impact</h2>
          </div>
          <p className="tdash__card-sub">
            Model post-close liquidity and runway from headline terms — illustrative; excludes fees, FX, and
            tranched closes.
          </p>
          <div className="tdash__ts-form">
            <label className="tdash__field">
              <span className="tdash__field-label">Investment amount</span>
              <input
                className="tdash__field-input"
                type="text"
                inputMode="decimal"
                value={tsAmount}
                onChange={(e) => setTsAmount(e.target.value)}
                placeholder="e.g. 2,500,000"
                autoComplete="off"
              />
            </label>
            <label className="tdash__field">
              <span className="tdash__field-label">Structure</span>
              <select
                className="tdash__field-input tdash__field-select"
                value={tsStructure}
                onChange={(e) => setTsStructure(e.target.value)}
              >
                {TERM_STRUCTURES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="tdash__field">
              <span className="tdash__field-label">Expected close date</span>
              <input
                className="tdash__field-input"
                type="date"
                value={tsCloseDate}
                onChange={(e) => setTsCloseDate(e.target.value)}
              />
            </label>
          </div>
          <div className="tdash__ts-actions">
            <button
              type="button"
              className="tdash__btn tdash__btn--salmon"
              onClick={() => {
                const amt = parseMoneyInput(tsAmount)
                setTsResults(analyseTermSheet(amt, tsStructure))
              }}
            >
              Analyse Term Sheet
            </button>
          </div>
          <div className="tdash__ts-outputs">
            <div className="tdash__ts-out">
              <p className="tdash__ts-out-cap">Post-Close Cash Position</p>
              <p className="tdash__ts-out-val">
                {tsResults ? formatGBP(tsResults.postCloseCash) : '—'}
              </p>
            </div>
            <div className="tdash__ts-out">
              <p className="tdash__ts-out-cap">Runway Impact</p>
              <p className="tdash__ts-out-val">
                {tsResults
                  ? `+${tsResults.runwayImpactMo.toLocaleString('en-GB', { maximumFractionDigits: 1 })} mo`
                  : '—'}
              </p>
            </div>
            <div className="tdash__ts-out">
              <p className="tdash__ts-out-cap">Post-Money Treasury Health Score</p>
              <p className="tdash__ts-out-val">
                {tsResults ? (
                  <>
                    {tsResults.postMoneyHealth}
                    <span className="tdash__ts-out-max">/ 100</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
          </div>
        </article>
      </div>
        </>
      )}
      {yieldApplyProduct ? (
        <YieldApplyConfirmModal
          open
          product={yieldApplyProduct}
          liquidity={liquidity}
          currentYieldDec={YIELD_CURRENT_DEC}
          source="dashboard_yield_gap"
          onClose={() => setYieldApplyProduct(null)}
        />
      ) : null}
    </div>
  )
}
