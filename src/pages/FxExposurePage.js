import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { summarizeFxExposure } from '../utils/treasuryFxExposure'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../styles/design-system.css'
import './FxExposurePage.css'

/** Illustrative GBP/USD spot — rate chart + rough FC conversions (not live data). */
const GBPUSD_ILLUSTRATIVE_SERIES = [
  { month: 'Nov', rate: 1.27 },
  { month: 'Dec', rate: 1.28 },
  { month: 'Jan', rate: 1.27 },
  { month: 'Feb', rate: 1.26 },
  { month: 'Mar', rate: 1.29 },
  { month: 'Apr', rate: 1.28 },
]

const ILL_SPOT_USD = 1.27
const ILL_SPOT_EUR = 1.17

function fxCurrencyFromPayee(payeeRaw) {
  const p = String(payeeRaw ?? '').toLowerCase()
  if (/\busd\b|\$|dollar/.test(p)) return 'USD'
  if (/\beur\b|€|euro/.test(p)) return 'EUR'
  return null
}

function fxExposureStatus(totalUnhedgedGbp) {
  const n = Number(totalUnhedgedGbp) || 0
  if (n < 10_000) return { text: 'HEALTHY', tone: 'healthy' }
  if (n <= 50_000) return { text: 'MONITOR', tone: 'monitor' }
  return { text: 'ACTION REQUIRED', tone: 'action' }
}

function currencyBarFillClass(code) {
  if (code === 'USD') return 'fx-market-row__fill--usd'
  if (code === 'EUR') return 'fx-market-row__fill--eur'
  return 'fx-market-row__fill--fx-grey'
}

function txnRowBorderClass(code) {
  if (code === 'USD') return 'fx-opp-row--usd'
  if (code === 'EUR') return 'fx-opp-row--eur'
  return 'fx-opp-row--fx-other'
}

function formatIllustrativeOriginal(gbpAbs, code) {
  if (code === 'USD') return `$${Math.round(gbpAbs * ILL_SPOT_USD).toLocaleString('en-GB')} USD`
  if (code === 'EUR') return `€${Math.round(gbpAbs * ILL_SPOT_EUR).toLocaleString('en-GB')} EUR`
  return '—'
}

function illustrativeSpotLabel(code) {
  if (code === 'USD') return `~${ILL_SPOT_USD} GBP/USD`
  if (code === 'EUR') return `~${ILL_SPOT_EUR} GBP/EUR`
  return '—'
}

function ShieldIcon() {
  return (
    <svg className="fx-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function FxExposurePage() {
  const { rows, loading, error } = useUserTransactions()

  const summary = useMemo(() => summarizeFxExposure(rows), [rows])
  const { pairs, totalUnhedgedGbp, fivePctOnMonthlyBurn } = summary

  const hasFx = pairs.length > 0
  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading

  const usdGbp = pairs.find((p) => p.code === 'USD')?.gbp ?? 0
  const eurGbp = pairs.find((p) => p.code === 'EUR')?.gbp ?? 0

  const leadPair = useMemo(() => {
    const usd = pairs.find((p) => p.code === 'USD')
    if (usd) return usd
    const eur = pairs.find((p) => p.code === 'EUR')
    if (eur) return eur
    return pairs[0] ?? null
  }, [pairs])

  const leadCode = leadPair?.code ?? 'USD'
  const leadGbp = leadPair?.gbp ?? 0
  const annualRiskEliminated = leadGbp * 0.05 * 12
  const monthlyVarianceRisk = leadGbp * 0.05

  const status = fxExposureStatus(totalUnhedgedGbp)

  const sortedPairs = useMemo(() => [...pairs].sort((a, b) => b.gbp - a.gbp), [pairs])

  const fxTransactions = useMemo(() => {
    const hits = rows
      .map((r) => ({ r, cur: fxCurrencyFromPayee(r.payee) }))
      .filter((x) => x.cur != null && Number(x.r.amount) < 0)
      .sort((a, b) => new Date(b.r.date).getTime() - new Date(a.r.date).getTime())
      .slice(0, 15)
    return hits
  }, [rows])

  const gbpUsdPctMove = useMemo(() => {
    const s = GBPUSD_ILLUSTRATIVE_SERIES
    const a = s[0]?.rate
    const b = s[s.length - 1]?.rate
    if (!a || !b) return null
    return ((b - a) / a) * 100
  }, [])

  const scrollToBreakdown = useCallback(() => {
    document.getElementById('fx-currency-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chartRateDomain = useMemo(() => {
    const vals = GBPUSD_ILLUSTRATIVE_SERIES.map((d) => d.rate)
    const lo = Math.min(...vals) - 0.02
    const hi = Math.max(...vals) + 0.02
    return [lo, hi]
  }, [])

  if (!loading && !fetchFailed && hasData && !hasFx) {
    return (
      <div className="fx-page">
        <header className="fx-header">
          <div className="fx-header__titles">
            <h1 className="fx-title">FX Exposure</h1>
            <p className="fx-subtitle">Your unhedged foreign currency risk and its impact on effective burn</p>
          </div>
          <span className="fx-badge fx-badge--healthy">{fxExposureStatus(0).text}</span>
        </header>
        <div className="fx-empty fx-empty--prominent" role="status">
          <p>
            No foreign currency transactions detected. This module activates automatically when multi-currency payments
            appear in your data.
          </p>
        </div>
        <p className="fx-trust-signal">
          Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
        </p>
      </div>
    )
  }

  if (!loading && !fetchFailed && !hasData) {
    return (
      <div className="fx-page">
        <header className="fx-header">
          <div className="fx-header__titles">
            <h1 className="fx-title">FX Exposure</h1>
            <p className="fx-subtitle">Your unhedged foreign currency risk and its impact on effective burn</p>
          </div>
          <span className="fx-badge fx-badge--healthy">HEALTHY</span>
        </header>
        <div className="fx-empty fx-empty--prominent">
          <p>
            Upload transaction data to analyse FX exposure. <Link to="/upload">Upload bank statement</Link>
          </p>
        </div>
        <p className="fx-trust-signal">
          Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
        </p>
      </div>
    )
  }

  const showFxChrome = loading || hasFx || fetchFailed

  return (
    <div className="fx-page">
      {error && !loading ? (
        <div className="fx-error" role="alert">
          <p>{error}</p>
          <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="fx-header">
        <div className="fx-header__titles">
          <h1 className="fx-title">FX Exposure</h1>
          <p className="fx-subtitle">Your unhedged foreign currency risk and its impact on effective burn</p>
          {showFxChrome ? (
            <div className="fx-dominant-metric" aria-label="Total unhedged monthly FX exposure">
              {loading ? (
                <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '55%', display: 'block' }} />
              ) : hasFx ? (
                <>
                  <p className="fx-dominant-metric__value">{formatGBP(Math.round(totalUnhedgedGbp))} / month</p>
                  <p className="fx-dominant-metric__label">Total unhedged monthly FX exposure</p>
                  <p className="fx-dominant-metric__support">
                    A 5% currency move would cost you {formatGBP(Math.round(fivePctOnMonthlyBurn))} per month
                  </p>
                </>
              ) : fetchFailed ? (
                <p className="fx-dominant-metric__support">Unable to load transactions — retry to see FX exposure.</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="fx-badge fx-badge--monitor">MONITOR</span>
        ) : (
          <span className={`fx-badge fx-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      {showFxChrome ? (
        <section className="fx-nba" aria-label="Next best actions">
          {loading ? (
            <div className="fx-nba__row">
              {[1, 2, 3].map((i) => (
                <div key={i} className="fx-skel-card">
                  <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                  <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                  <span className="ds-skeleton ds-skeleton--line" />
                  <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
                </div>
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="fx-nba-empty">
              Could not load FX actions.{' '}
              <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : (
            <div className="fx-nba__row">
              <article className="fx-action-card fx-action-card--primary">
                <p className="fx-action-card__recommended">RECOMMENDED</p>
                <p className="fx-action-card__kicker">NEXT BEST ACTION 1</p>
                <p className="fx-action-card__impact">{formatGBP(Math.round(annualRiskEliminated))}</p>
                <p className="fx-action-card__title">
                  Hedge {leadCode} exposure with a forward contract
                </p>
                <p className="fx-action-card__desc">
                  Your largest FX exposure is {leadCode}. A forward contract locks in the current rate and eliminates
                  monthly variance.
                </p>
                <div className="fx-action-meta">
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Who</span>
                    <span className="fx-action-meta__val">CFO</span>
                  </div>
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Time to act</span>
                    <span className="fx-action-meta__val">This week</span>
                  </div>
                  <div className="fx-action-meta__cell fx-action-meta__cell--wide">
                    <span className="fx-action-meta__label">Annual impact</span>
                    <span className="fx-action-meta__val fx-action-meta__val--gain">
                      Up to {formatGBP(Math.round(annualRiskEliminated))} risk eliminated
                    </span>
                  </div>
                </div>
                <div className="fx-action-wait">
                  <span className="fx-action-wait__label">Cost of waiting</span>
                  <span className="fx-action-wait__val">{formatGBP(Math.round(monthlyVarianceRisk))} variance risk per month</span>
                </div>
                <div className="fx-action-card__footer">
                  <a
                    className="fx-action-card__cta-pill"
                    href="https://www.currenciesdirect.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more
                  </a>
                </div>
              </article>

              <article className="fx-action-card fx-action-card--secondary">
                <p className="fx-action-card__kicker">NEXT BEST ACTION 2</p>
                <p className="fx-action-card__impact">{formatGBP(Math.round(usdGbp || totalUnhedgedGbp))}</p>
                <p className="fx-action-card__title">Open a USD account to reduce conversion costs</p>
                <p className="fx-action-card__desc">
                  Paying USD costs from a USD account eliminates conversion fees and reduces FX exposure.
                </p>
                <div className="fx-action-meta">
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Who</span>
                    <span className="fx-action-meta__val">CFO</span>
                  </div>
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Time to act</span>
                    <span className="fx-action-meta__val">This week</span>
                  </div>
                  <div className="fx-action-meta__cell fx-action-meta__cell--wide">
                    <span className="fx-action-meta__label">Annual impact</span>
                    <span className="fx-action-meta__val fx-action-meta__val--gain">Reduced conversion costs</span>
                  </div>
                </div>
                <div className="fx-action-wait">
                  <span className="fx-action-wait__label">Cost of waiting</span>
                  <span className="fx-action-wait__val">Conversion costs continue</span>
                </div>
                <div className="fx-action-card__footer">
                  <a
                    className="fx-action-card__cta-pill"
                    href="https://www.wise.com/gb/business"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View options
                  </a>
                </div>
              </article>

              <article className="fx-action-card fx-action-card--secondary fx-action-card--tertiary">
                <p className="fx-action-card__kicker">NEXT BEST ACTION 3</p>
                <p className="fx-action-card__impact-qual">
                  <ShieldIcon />
                  <span>Ongoing monitoring</span>
                </p>
                <p className="fx-action-card__title">Set FX rate alert</p>
                <p className="fx-action-card__desc">
                  Get alerted when GBP/USD or GBP/EUR moves more than 2% so you can act before it impacts burn.
                </p>
                <div className="fx-action-meta">
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Who</span>
                    <span className="fx-action-meta__val">CFO</span>
                  </div>
                  <div className="fx-action-meta__cell">
                    <span className="fx-action-meta__label">Time to act</span>
                    <span className="fx-action-meta__val">2 minutes</span>
                  </div>
                  <div className="fx-action-meta__cell fx-action-meta__cell--wide">
                    <span className="fx-action-meta__label">Annual impact</span>
                    <span className="fx-action-meta__val fx-action-meta__val--neutral">Ongoing monitoring</span>
                  </div>
                </div>
                <div className="fx-action-wait">
                  <span className="fx-action-wait__label">Cost of waiting</span>
                  <span className="fx-action-wait__val fx-action-wait__val--neutral">Zero — act now</span>
                </div>
                <div className="fx-action-card__footer">
                  <Link className="fx-action-card__cta-pill" to="/app/preferences">
                    Configure
                  </Link>
                </div>
              </article>
            </div>
          )}
        </section>
      ) : null}

      {!loading && hasFx && totalUnhedgedGbp > 10_000 ? (
        <section className="fx-inaction" aria-label="Cost of inaction">
          <div className="fx-inaction__left">
            <span className="fx-inaction__dot" aria-hidden />
            <p className="fx-inaction__text">
              You have {formatGBP(Math.round(totalUnhedgedGbp))} in unhedged monthly FX exposure. Currency moves directly
              increase your effective burn rate.
            </p>
          </div>
          <button type="button" className="fx-inaction__link" onClick={scrollToBreakdown}>
            See exposure breakdown ↓
          </button>
        </section>
      ) : null}

      {showFxChrome ? (
        <div className="fx-grid">
          <section className="fx-panel fx-panel--tall" aria-labelledby="fx-position-heading">
            <h2 id="fx-position-heading" className="fx-section-label">
              Your position
            </h2>
            {loading ? (
              <div className="fx-skel-panel">
                <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              </div>
            ) : fetchFailed ? (
              <div className="fx-empty">
                <p>
                  Could not load FX position.{' '}
                  <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </p>
              </div>
            ) : (
              <>
                <p className="fx-cash-hero fx-cash-hero--fx">{formatGBP(Math.round(totalUnhedgedGbp))}</p>
                <div className="fx-position-loss">
                  <p className="fx-position-loss__label">MONTHLY UNHEDGED EXPOSURE</p>
                </div>
                <div className="fx-stat-rows">
                  <div className="fx-stat-row">
                    <span className="fx-stat-row__label">USD exposure</span>
                    <span className="fx-stat-row__val">{formatGBP(Math.round(usdGbp))}</span>
                  </div>
                  <div className="fx-stat-row">
                    <span className="fx-stat-row__label">EUR exposure</span>
                    <span className="fx-stat-row__val">{formatGBP(Math.round(eurGbp))}</span>
                  </div>
                  <div className="fx-stat-row">
                    <span className="fx-stat-row__label">Total unhedged</span>
                    <span className="fx-stat-row__val fx-stat-row__val--opp">{formatGBP(Math.round(totalUnhedgedGbp))}</span>
                  </div>
                  <div className="fx-stat-row">
                    <span className="fx-stat-row__label">5% move impact</span>
                    <span className="fx-stat-row__val fx-stat-row__val--red">{formatGBP(Math.round(fivePctOnMonthlyBurn))}</span>
                  </div>
                </div>
                <div className="fx-compare">
                  <div className="fx-compare__side fx-compare__side--current">
                    <p className="fx-compare__col-title">CURRENT</p>
                    <p className="fx-compare__body">
                      <span className="fx-money fx-money--loss">{formatGBP(Math.round(totalUnhedgedGbp))}</span> unhedged
                      monthly FX
                    </p>
                  </div>
                  <div className="fx-compare__side fx-compare__side--optimised">
                    <p className="fx-compare__col-title">HEDGED</p>
                    <p className="fx-compare__body">
                      <span className="fx-money fx-money--gain">{formatGBP(0)}</span> exposure · variance locked
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="fx-panel fx-panel--tall" id="fx-currency-breakdown" aria-labelledby="fx-ccy-heading">
            <h2 id="fx-ccy-heading" className="fx-section-label">
              Exposure by currency
            </h2>
            {loading ? (
              <div className="fx-skel-panel">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
              </div>
            ) : fetchFailed ? (
              <div className="fx-empty">
                <p>
                  Could not load breakdown.{' '}
                  <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </p>
              </div>
            ) : (
              <div
                className="fx-compare-block"
                style={{ overflow: 'visible', boxSizing: 'border-box', paddingRight: '14px' }}
              >
                <div className="fx-market-rows" aria-label="Exposure by currency">
                  {sortedPairs.map((row) => (
                    <div
                      key={row.code}
                      className="fx-market-row"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        boxSizing: 'border-box',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span className="fx-market-row__label">{row.code}</span>
                        <div className="fx-market-row__track">
                          <div
                            className={`fx-market-row__fill ${currencyBarFillClass(row.code)}`}
                            style={{
                              width: `${Math.max(2, totalUnhedgedGbp > 0 ? (row.gbp / totalUnhedgedGbp) * 100 : 0)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        className="fx-market-row__rate"
                        style={{ flexShrink: 0, width: '88px', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {formatGBP(Math.round(row.gbp))}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="fx-market-row__below">
                  {usdGbp > 0 ? (
                    <>
                      A 1% move in GBP/USD costs you {formatGBP(Math.round(usdGbp * 0.01))} per month
                    </>
                  ) : eurGbp > 0 ? (
                    <>
                      A 1% move in GBP/EUR costs you {formatGBP(Math.round(eurGbp * 0.01))} per month
                    </>
                  ) : (
                    <>Illustrative sensitivity scales with each currency row above.</>
                  )}
                </p>
              </div>
            )}
          </section>

          <section className="fx-panel" aria-labelledby="fx-txn-heading">
            <h2 id="fx-txn-heading" className="fx-section-label">
              FX transactions
            </h2>
            {loading ? (
              <div className="fx-skel-panel">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="ds-skeleton ds-skeleton--line"
                    style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                  />
                ))}
              </div>
            ) : fetchFailed ? (
              <div className="fx-empty">
                <p>
                  Could not load transactions.{' '}
                  <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </p>
              </div>
            ) : fxTransactions.length === 0 ? (
              <div className="fx-empty">
                <p>No matching debit transactions with FX cues in payee text.</p>
              </div>
            ) : (
              <div className="fx-opp-list">
                {fxTransactions.map(({ r, cur }) => {
                  const gbpAbs = Math.abs(Number(r.amount))
                  return (
                    <div key={`${r.id}-${String(r.date)}-${String(r.payee)}`} className={`fx-opp-row ${txnRowBorderClass(cur)}`}>
                      <div className="fx-opp-row__content">
                        <h3 className="fx-opp-row__title">{String(r.payee || '—')}</h3>
                        <p className="fx-opp-row__meta">
                          {String(r.date).slice(0, 10)} · {cur}
                        </p>
                        <p className="fx-opp-row__rationale">
                          Original (illustrative): {formatIllustrativeOriginal(gbpAbs, cur)} · Rate {illustrativeSpotLabel(cur)}
                        </p>
                        <p className="fx-opp-row__gain" style={{ color: '#dc2626' }}>
                          {formatGBP(Math.round(gbpAbs))} GBP
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="fx-panel" aria-labelledby="fx-rate-heading">
            <h2 id="fx-rate-heading" className="fx-section-label">
              Rate environment
            </h2>
            {loading ? (
              <div className="fx-skel-panel">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
              </div>
            ) : fetchFailed ? (
              <div className="fx-empty">
                <p>
                  Could not load chart.{' '}
                  <button type="button" className="fx-error__retry" onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </p>
              </div>
            ) : (
              <>
                <div className="fx-chart-h">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={GBPUSD_ILLUSTRATIVE_SERIES} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis
                        domain={chartRateDomain}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickFormatter={(v) => Number(v).toFixed(2)}
                        width={44}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v).toFixed(2)}`, 'GBP/USD']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#1b2f8c" strokeWidth={2} dot={{ r: 3, fill: '#1b2f8c' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="fx-insight">
                  GBP/USD has moved{' '}
                  {gbpUsdPctMove != null ? `${formatPct(gbpUsdPctMove, 2)}` : '—'} over the last 6 months (illustrative)
                </p>
                <p className="fx-monthly-cost">
                  At current exposure, a 5% GBP weakening costs {formatGBP(Math.round(fivePctOnMonthlyBurn))} per month
                </p>
              </>
            )}
          </section>
        </div>
      ) : null}

      <p className="fx-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
