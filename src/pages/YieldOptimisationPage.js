import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { useDaysDataUnaddressed } from '../hooks/useDaysDataUnaddressed'
import { computeYieldSummary } from '../utils/treasuryReportPayload'
import { computeLiquidityBuffer, LIQUIDITY_TARGET_MONTHS } from '../utils/treasuryLiquidity'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { YIELD_BEST_DEC, YIELD_BEST_PCT } from '../utils/treasuryYield'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../styles/design-system.css'
import './YieldOptimisationPage.css'

/** Reference rate for bar chart scale (UK T-Bills headline). */
const RATE_CHART_REF_PCT = 5.25
const RATE_MARKET_AVG_PCT = 4.5
const TBILL_ANNUAL_MULT = 0.0515
const BR_MMF_ANNUAL_MULT = 0.0502
const SHAW_ANNUAL_MULT = 0.0485
const FLAG_ANNUAL_MULT = 0.047
const PEER_AVG_PCT = 1.8

const BOE_RATE_SERIES = [
  { month: 'Nov', rate: 5.25 },
  { month: 'Dec', rate: 5.25 },
  { month: 'Jan', rate: 5.0 },
  { month: 'Feb', rate: 5.0 },
  { month: 'Mar', rate: 4.75 },
  { month: 'Apr', rate: 4.75 },
]

const OPP_ROWS = [
  {
    key: 'tbills',
    rank: '#1 BEST OPTION',
    title: 'UK T-Bills 91-day',
    meta: 'HM Treasury · Rate: 5.25% · Access: Quarterly · Not FSCS',
    bestFor: 'Best for: idle cash above your liquidity buffer',
    mult: TBILL_ANNUAL_MULT,
    basis: 'eligible',
    borderClass: 'yld-opp-row--tbills',
    rationale: 'Government-backed — zero credit risk',
    href: 'https://www.hl.co.uk/shares/i-want-to-buy/gilts',
    cta: 'Buy via HL →',
  },
  {
    key: 'blackrock',
    rank: '#2 ALTERNATIVE',
    title: 'BlackRock Liquidity Fund',
    meta: 'BlackRock · Rate: 5.12% · Access: Same day · Not FSCS',
    bestFor: 'Best for: operating cash requiring same-day access',
    mult: BR_MMF_ANNUAL_MULT,
    basis: 'total',
    borderClass: 'yld-opp-row--blackrock',
    rationale: 'Same-day access — no lock-in risk',
    href: 'https://www.blackrock.com/uk',
    cta: 'Apply — BlackRock',
  },
  {
    key: 'shawbrook',
    rank: '#3 FIXED RETURN',
    title: 'Shawbrook 12-mo Fixed',
    meta: 'Shawbrook Bank · Rate: 4.95% · Access: 12 months · FSCS protected',
    bestFor: 'Best for: locked-in yield certainty on surplus cash',
    mult: SHAW_ANNUAL_MULT,
    basis: 'eligible',
    borderClass: 'yld-opp-row--shawbrook',
    rationale: 'FSCS protected up to £120k',
    href: 'https://www.shawbrook.co.uk',
    cta: 'Apply — Shawbrook',
  },
  {
    key: 'flagstone',
    rank: '#4 PLATFORM',
    title: 'Flagstone Platform',
    meta: 'Flagstone · Rate: 4.80% · Access: Varies · FSCS per institution',
    bestFor: 'Best for: FSCS-protected diversification across banks',
    mult: FLAG_ANNUAL_MULT,
    basis: 'eligible',
    borderClass: 'yld-opp-row--flagstone',
    rationale: 'Platform access — diversify institutional exposure',
    href: 'https://www.flagstone.com',
    cta: 'Apply — Flagstone',
  },
]

function yieldStatusBadge(annualOppCost) {
  const n = Number(annualOppCost) || 0
  if (n < 10_000) return { text: 'Healthy', tone: 'healthy' }
  if (n > 50_000) return { text: 'Action required', tone: 'action' }
  return { text: 'Review', tone: 'review' }
}

function ShieldIcon() {
  return (
    <svg className="yld-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function YieldOptimisationPage() {
  const { rows, loading, error } = useUserTransactions()
  const { days: daysUnaddressed, loading: daysUnaddressedLoading } = useDaysDataUnaddressed()

  const liq = useMemo(() => computeLiquidityBuffer(rows), [rows])
  const yieldSummary = useMemo(() => computeYieldSummary(rows), [rows])
  const runway = useMemo(() => computeRunwayFromTransactions(rows), [rows])

  const totalCash = useMemo(() => {
    const withBalance = rows.filter(
      (r) => r.running_balance != null && Number.isFinite(Number(r.running_balance)),
    )
    if (withBalance.length) {
      const latest = withBalance.reduce((best, r) => {
        const t = new Date(String(r.date).trim()).getTime()
        const bestT = new Date(String(best.date).trim()).getTime()
        return t > bestT ? r : best
      })
      return Number(latest.running_balance)
    }
    return rows.reduce((s, r) => {
      const a = Number(r.amount)
      return s + (Number.isFinite(a) ? a : 0)
    }, 0)
  }, [rows])

  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading
  const blendedDec = yieldSummary.currentYieldDec
  const blendedPct = blendedDec * 100
  const annualOpp = useMemo(() => totalCash * yieldSummary.spreadDec, [totalCash, yieldSummary.spreadDec])
  const monthlyOpp = useMemo(() => annualOpp / 12, [annualOpp])
  const eligible = liq.eligibleForYield
  const bufferCash = Math.max(0, totalCash - eligible)
  const residualGap = bufferCash * Math.max(0, YIELD_BEST_DEC - blendedDec)
  const liquidityBufferGbp = liq.targetCash6mo

  const nba1Impact = eligible * TBILL_ANNUAL_MULT
  const nba1Daily = nba1Impact / 365
  const nba2Impact = liquidityBufferGbp * BR_MMF_ANNUAL_MULT
  const nba2Daily = nba2Impact / 365

  const status = yieldStatusBadge(annualOpp)
  const gapFillWidthPct = `${Math.max(2, RATE_CHART_REF_PCT > 0 ? (blendedPct / RATE_CHART_REF_PCT) * 100 : 0)}%`
  const marketBestFillPct = '100%'
  const marketAvgFillPct = `${RATE_CHART_REF_PCT > 0 ? (RATE_MARKET_AVG_PCT / RATE_CHART_REF_PCT) * 100 : 0}%`
  const marketCurrentFillPct = `${Math.max(2, RATE_CHART_REF_PCT > 0 ? (blendedPct / RATE_CHART_REF_PCT) * 100 : 0)}%`
  const yieldBelowMult =
    blendedPct > 0 && RATE_CHART_REF_PCT > 0 ? Math.round(RATE_CHART_REF_PCT / blendedPct) : null

  const spectrumPctYou = RATE_CHART_REF_PCT > 0 ? Math.max(0, Math.min(100, (blendedPct / RATE_CHART_REF_PCT) * 100)) : 0
  /** Min % so translateX(-50%) does not push the "You" label past the bar's left edge. */
  const spectrumPctYouLayout = Math.max(8, Math.min(100, spectrumPctYou))
  const spectrumPctPeers = RATE_CHART_REF_PCT > 0 ? Math.max(0, Math.min(100, (PEER_AVG_PCT / RATE_CHART_REF_PCT) * 100)) : 0
  const spectrumPctBest = 100

  const topQuartileAddAnnual = totalCash * Math.max(0, (RATE_CHART_REF_PCT - PEER_AVG_PCT) / 100)

  const yCurrentClamped = Math.max(4.4, Math.min(5.4, blendedPct))

  const scrollToOpportunities = useCallback(() => {
    document.getElementById('yld-opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const captionParts = [
    `Based on moving ${formatGBP(Math.round(eligible))} above your ${LIQUIDITY_TARGET_MONTHS}-month liquidity buffer.`,
  ]
  if (runway.baseRunwayMo != null && liq.monthlyBurn > 0) {
    captionParts.push(
      ` Runway is ${runway.baseRunwayMo.toLocaleString('en-GB', { maximumFractionDigits: 1 })} months at current burn.`,
    )
  }

  return (
    <div className="yld-page">
      {error && !loading ? (
        <div className="yld-error" role="alert">
          <p>{error}</p>
          <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="yld-header">
        <div className="yld-header__titles">
          <h1 className="yld-title">Yield Optimisation</h1>
          <p className="yld-subtitle">Maximise return on idle cash while preserving liquidity</p>
          <div className="yld-dominant-metric" aria-label="Annual yield opportunity cost">
            <p className="yld-dominant-metric__value">{formatGBP(Math.round(annualOpp))} / yr</p>
            <p className="yld-dominant-metric__label">Annual yield opportunity lost</p>
            <p className="yld-dominant-metric__support">
              You are earning {formatPct(blendedPct, 2)} vs {formatPct(RATE_CHART_REF_PCT, 2)} available —{' '}
              {daysUnaddressedLoading || daysUnaddressed == null ? '—' : daysUnaddressed} days unaddressed
            </p>
          </div>
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="yld-badge yld-badge--review">Review</span>
        ) : (
          <span className={`yld-badge yld-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      <section className="yld-nba" aria-label="Next best actions">
        {loading ? (
          <div className="yld-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="yld-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="yld-nba-empty">
            Could not load yield actions.{' '}
            <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="yld-nba-empty">
            Upload transaction data to unlock ranked yield actions.{' '}
            <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : (
          <div className="yld-nba__row">
            <article className="yld-action-card yld-action-card--primary">
              <p className="yld-action-card__recommended">RECOMMENDED</p>
              <p className="yld-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="yld-action-card__impact">{formatGBP(Math.round(nba1Impact))}/yr</p>
              <p className="yld-action-card__rate-shift">
                <span style={{ color: '#DC2626' }}>0.10%</span>
                <span style={{ color: '#9CA3AF' }}> → </span>
                <span style={{ color: '#16A34A' }}>5.25%</span>
              </p>
              <p className="yld-action-card__title">Move idle cash to UK Government Gilts at 5.25%</p>
              <p className="yld-action-card__confidence">Lowest risk, highest return</p>
              <p className="yld-action-card__desc">
                UK Gilts (Government bonds) are the safest sterling investment available. Move your idle cash above the
                liquidity buffer into 91-day Gilts at 5.25% — government-backed, no credit risk, quarterly liquidity.
              </p>
              <div className="yld-action-meta">
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Who</span>
                  <span className="yld-action-meta__val">CFO</span>
                </div>
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Time to act</span>
                  <span className="yld-action-meta__val">This week</span>
                </div>
              </div>
              <div className="yld-action-wait">
                <span className="yld-action-wait__label">Cost of waiting</span>
                <span className="yld-action-wait__val">{formatGBP(Math.round(nba1Daily))}/day</span>
              </div>
              <div className="yld-action-card__footer">
                <a
                  className="yld-action-card__cta-pill"
                  href="https://www.hl.co.uk/shares/i-want-to-buy/gilts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buy via Hargreaves Lansdown →
                </a>
              </div>
            </article>

            <article className="yld-action-card yld-action-card--secondary">
              <p className="yld-action-card__kicker">NEXT BEST ACTION 2</p>
              <p className="yld-action-card__impact">{formatGBP(Math.round(nba2Impact))}/yr</p>
              <p className="yld-action-card__rate-shift">
                <span style={{ color: '#DC2626' }}>0.10%</span>
                <span style={{ color: '#9CA3AF' }}> → </span>
                <span style={{ color: '#16A34A' }}>5.12%</span>
              </p>
              <p className="yld-action-card__title">Earn 5.12% with same-day access</p>
              <p className="yld-action-card__desc">
                Park your operating reserves at 5.12% with same-day access. Replaces your Barclays current account
                yield immediately.
              </p>
              <div className="yld-action-meta">
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Who</span>
                  <span className="yld-action-meta__val">CFO</span>
                </div>
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Time to act</span>
                  <span className="yld-action-meta__val">Within 3 days</span>
                </div>
              </div>
              <div className="yld-action-wait">
                <span className="yld-action-wait__label">Cost of waiting</span>
                <span className="yld-action-wait__val">{formatGBP(Math.round(nba2Daily))}/day</span>
              </div>
              <div className="yld-action-card__footer">
                <a className="yld-action-card__cta-pill" href="https://www.blackrock.com/uk" target="_blank" rel="noopener noreferrer">
                  Apply — BlackRock
                </a>
              </div>
            </article>

            <article className="yld-action-card yld-action-card--secondary yld-action-card--tertiary">
              <p className="yld-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="yld-action-card__impact-qual">
                <ShieldIcon />
                <span>Ongoing protection</span>
              </p>
              <p className="yld-action-card__title">Set minimum yield policy in Autopilot</p>
              <p className="yld-action-card__desc">
                Configure a 4% minimum yield threshold. Autopilot alerts you the moment any account drops below your
                policy.
              </p>
              <div className="yld-action-meta">
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Who</span>
                  <span className="yld-action-meta__val">CFO</span>
                </div>
                <div className="yld-action-meta__cell">
                  <span className="yld-action-meta__label">Time to act</span>
                  <span className="yld-action-meta__val">2 minutes</span>
                </div>
              </div>
              <div className="yld-action-wait">
                <span className="yld-action-wait__label">Cost of waiting</span>
                <span className="yld-action-wait__val yld-action-wait__val--neutral">Zero — act now</span>
              </div>
              <div className="yld-action-card__footer">
                <Link className="yld-action-card__cta-pill" to="/app/preferences">
                  Configure Autopilot
                </Link>
              </div>
            </article>
          </div>
        )}
      </section>

      {!loading && !fetchFailed && hasData ? (
        <section className="yld-inaction" aria-label="Cost of inaction">
          <div className="yld-inaction__left">
            <span className="yld-inaction__dot" aria-hidden />
            <p className="yld-inaction__text">
              At your current yield, you are losing {formatGBP(Math.round(monthlyOpp))} every month —{' '}
              {daysUnaddressedLoading || daysUnaddressed == null ? '—' : daysUnaddressed} days unaddressed.
            </p>
          </div>
          <button type="button" className="yld-inaction__link" onClick={scrollToOpportunities}>
            See your options ↓
          </button>
        </section>
      ) : null}

      <div className="yld-grid">
        <section className="yld-panel yld-panel--tall" aria-labelledby="yld-position-heading">
          <h2 id="yld-position-heading" className="yld-section-label">
            Your position
          </h2>
          {loading ? (
            <div className="yld-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 12 }} />
              <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 12 }} />
            </div>
          ) : fetchFailed ? (
            <div className="yld-empty">
              <p>
                Could not load your position.{' '}
                <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="yld-empty">
              <p>
                No cash position yet. <Link to="/upload">Upload a bank statement</Link> to see yield and opportunity
                cost.
              </p>
            </div>
          ) : (
            <>
              <p className="yld-cash-hero">{formatGBP(Math.round(totalCash))}</p>
              <div className="yld-position-loss">
                <p className="yld-position-loss__label">ANNUAL OPPORTUNITY COST</p>
                <p className="yld-position-loss__value">{formatGBP(Math.round(annualOpp))} / yr lost</p>
                <p className="yld-position-loss__cause">Most of your cash is sitting in near-zero yield accounts</p>
              </div>
              <div className="yld-stat-rows">
                <div className="yld-stat-row">
                  <span className="yld-stat-row__label">Current yield</span>
                  <span className="yld-stat-row__val yld-stat-row__val--red">{formatPct(blendedPct, 2)}</span>
                </div>
                <div className="yld-stat-row">
                  <span className="yld-stat-row__label">Market benchmark</span>
                  <span className="yld-stat-row__val yld-stat-row__val--green">{formatPct(YIELD_BEST_PCT, 2)}</span>
                </div>
                <div className="yld-stat-row">
                  <span className="yld-stat-row__label">Annual opportunity cost</span>
                  <span className="yld-stat-row__val yld-stat-row__val--opp">{formatGBP(Math.round(annualOpp))}</span>
                </div>
              </div>
              <div className="yld-gap-progress" aria-label="Yield gap progress">
                <div className="yld-gap-progress__track yld-gap-progress__track--simple">
                  <div className="yld-gap-progress__fill" style={{ width: gapFillWidthPct }} />
                </div>
                <p className="yld-gap-progress__caption">
                  <span>Current yield · {formatPct(blendedPct, 2)}</span>
                  <span className="yld-gap-progress__rule" aria-hidden>
                    ——————————————
                  </span>
                  <span>Best available · {formatPct(RATE_CHART_REF_PCT, 2)}</span>
                </p>
              </div>
              <div className="yld-compare">
                <div className="yld-compare__side yld-compare__side--current">
                  <p className="yld-compare__col-title">CURRENT</p>
                  <p className="yld-compare__body">
                    <span className="yld-rate yld-rate--current">{formatPct(blendedPct, 2)}</span> yield ·{' '}
                    <span className="yld-money yld-money--loss">{formatGBP(Math.round(annualOpp))}</span> annual
                    gap
                  </p>
                </div>
                <div className="yld-compare__side yld-compare__side--optimised">
                  <p className="yld-compare__col-title">OPTIMISED</p>
                  <p className="yld-compare__body">
                    <span className="yld-rate yld-rate--best">{formatPct(YIELD_BEST_PCT, 2)}</span> yield ·{' '}
                    <span className="yld-money yld-money--gain">{formatGBP(Math.round(residualGap))}</span> annual
                    gap
                  </p>
                </div>
              </div>
              <p className="yld-caption">{captionParts.join('')}</p>
            </>
          )}
        </section>

        <section className="yld-panel yld-panel--tall" aria-labelledby="yld-compare-heading">
          <h2 id="yld-compare-heading" className="yld-section-label">
            How you compare
          </h2>
          {loading ? (
            <div className="yld-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 16 }} />
            </div>
          ) : fetchFailed ? (
            <div className="yld-empty">
              <p>
                Could not load benchmarks.{' '}
                <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="yld-empty">
              <p>
                Benchmarks appear once we know your cash balance. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <div className="yld-compare-stack">
              <div
                className="yld-compare-block"
                style={{ overflow: 'visible', boxSizing: 'border-box', paddingRight: '14px' }}
              >
                <h3 className="yld-subsection-label">Market rates</h3>
                <div className="yld-market-rows" aria-label="Market rates comparison">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="yld-market-row__label">Best available</span>
                      <div className="yld-market-row__track">
                        <div
                          className="yld-market-row__fill yld-market-row__fill--navy"
                          style={{ width: marketBestFillPct }}
                        />
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, width: '48px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: '13px', fontWeight: 600, color: '#0f0f0f' }}>
                      {formatPct(RATE_CHART_REF_PCT, 2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="yld-market-row__label">Market average</span>
                      <div className="yld-market-row__track">
                        <div
                          className="yld-market-row__fill yld-market-row__fill--grey"
                          style={{ width: marketAvgFillPct }}
                        />
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, width: '48px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: '13px', fontWeight: 600, color: '#0f0f0f' }}>
                      {formatPct(RATE_MARKET_AVG_PCT, 2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="yld-market-row__label">Your current</span>
                      <div className="yld-market-row__track">
                        <div
                          className="yld-market-row__fill yld-market-row__fill--red"
                          style={{ width: marketCurrentFillPct }}
                        />
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, width: '48px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: '13px', fontWeight: 600, color: '#0f0f0f' }}>
                      {formatPct(blendedPct, 2)}
                    </span>
                  </div>
                </div>
                {yieldBelowMult != null ? (
                  <p className="yld-market-row__below">You're earning ~{yieldBelowMult}x less than available rates</p>
                ) : null}
              </div>

              <div className="yld-compare-block">
                <h3 className="yld-subsection-label">Peer comparison</h3>
                <div className="yld-peer-spectrum" aria-label="Peer yield spectrum">
                  <div className="yld-peer-spectrum__bar" />
                  <div
                    className="yld-peer-spectrum__marker yld-peer-spectrum__marker--you"
                    style={{ left: `${spectrumPctYouLayout}%` }}
                  >
                    <span className="yld-peer-spectrum__dot yld-peer-spectrum__dot--red" />
                    <span className="yld-peer-spectrum__lbl">You {formatPct(blendedPct, 2)}</span>
                  </div>
                  <div
                    className="yld-peer-spectrum__marker yld-peer-spectrum__marker--peers"
                    style={{ left: `${spectrumPctPeers}%` }}
                  >
                    <span className="yld-peer-spectrum__dot yld-peer-spectrum__dot--grey" />
                    <span className="yld-peer-spectrum__lbl">Peers {formatPct(PEER_AVG_PCT, 1)}</span>
                  </div>
                  <div
                    className="yld-peer-spectrum__marker yld-peer-spectrum__marker--best"
                    style={{ left: `${spectrumPctBest}%` }}
                  >
                    <span className="yld-peer-spectrum__dot yld-peer-spectrum__dot--green" />
                    <span className="yld-peer-spectrum__lbl">Best {formatPct(RATE_CHART_REF_PCT, 2)}</span>
                  </div>
                </div>
              </div>

              <div className="yld-compare-chip">
                Moving to top quartile would add {formatGBP(Math.round(topQuartileAddAnnual))} to your annual position
              </div>
            </div>
          )}
        </section>

        <section className="yld-panel" id="yld-opportunities" aria-labelledby="yld-opp-heading">
          <h2 id="yld-opp-heading" className="yld-section-label">
            Top opportunities
          </h2>
          {loading ? (
            <div className="yld-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="yld-empty">
              <p>
                Could not load opportunities.{' '}
                <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="yld-empty">
              <p>
                Opportunities need your latest balances. <Link to="/upload">Upload a bank statement</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="yld-opp-list">
                {OPP_ROWS.map((row) => {
                  const basisAmt = row.basis === 'total' ? totalCash : eligible
                  const gain = basisAmt * row.mult
                  return (
                    <div key={row.key} className={`yld-opp-row ${row.borderClass}`}>
                      <div className="yld-opp-row__content">
                        <p className="yld-opp-row__rank">
                          {row.rank}
                          {row.key === 'tbills' ? <span className="yld-opp-row__impact-tag">Highest impact</span> : null}
                        </p>
                        <h3 className="yld-opp-row__title">{row.title}</h3>
                        <p className="yld-opp-row__meta">{row.meta}</p>
                        <p className="yld-opp-row__best-for">{row.bestFor}</p>
                        <p className="yld-opp-row__rationale">{row.rationale}</p>
                        <p className="yld-opp-row__gain">{formatGBP(Math.round(gain))} / yr</p>
                      </div>
                      <div className="yld-opp-row__actions">
                        <a
                          className="yld-opp-cta"
                          href={row.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.cta}
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="yld-opp-disclaimer">
                Estimated gains are calculated independently on your eligible cash position and are not additive.
              </p>
            </>
          )}
        </section>

        <section className="yld-panel" aria-labelledby="yld-rate-heading">
          <h2 id="yld-rate-heading" className="yld-section-label">
            Rate environment
          </h2>
          {loading ? (
            <div className="yld-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="yld-empty">
              <p>
                Could not load rate context.{' '}
                <button type="button" className="yld-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="yld-empty">
              <p>
                Rate context is most useful alongside your cash position. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="yld-chart-h">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={BOE_RATE_SERIES} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis
                      domain={[4.4, 5.4]}
                      ticks={[4.5, 4.75, 5.0, 5.25]}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v) => [`${v}%`, 'BoE base']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <ReferenceLine
                      y={yCurrentClamped}
                      stroke="#dc2626"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      label={{
                        value: 'Your current yield',
                        position: 'right',
                        fill: '#dc2626',
                        fontSize: 11,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: 400,
                      }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#1b2f8c" strokeWidth={2} dot={{ r: 3, fill: '#1b2f8c' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="yld-insight">
                Rates remain elevated — idle cash drag is near peak levels
              </p>
              <p className="yld-monthly-cost">
                Every month unaddressed costs you {formatGBP(Math.round(monthlyOpp))}.
              </p>
            </>
          )}
        </section>
      </div>
      <p className="yld-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
