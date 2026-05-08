import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatCompactAxisGBP, formatGBP, formatPct } from '../utils/treasuryFormat'
import {
  buildCashflowMonthlySeries,
  cashflowWeeklyLowCashWarning,
  computeCashflowSummary,
  detectRecurringTransactions,
  seriesToBarHeights,
} from '../utils/treasuryCashflow'
import { buildCashflowCapitalMoves } from '../utils/capitalMovesFromData'
import { TransactionList, TransactionRow } from '../components/TransactionRow'
import '../styles/design-system.css'
import './CashFlowPage.css'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function startOfWeekMonday(d) {
  const x = new Date(d)
  const dow = x.getDay()
  const diff = (dow + 6) % 7
  x.setDate(x.getDate() - diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Weekly cumulative cash position: actual weekly nets from data, then projected using average net. */
function buildWeeklyCashChartData(rows, summary, numWeeks = 13) {
  const list = (rows || []).filter((r) => r?.date)
  if (!list.length) return []

  const times = list.map((r) => new Date(r.date).getTime()).filter(Number.isFinite)
  const maxT = Math.max(...times)

  const weeklyNetAvg = summary.netMonthly * (7 / 30.437)

  let ws = startOfWeekMonday(new Date(Math.min(...times)))
  const projectionEnd = addDays(startOfWeekMonday(new Date(maxT)), numWeeks * 7)

  const raw = []
  while (ws.getTime() <= projectionEnd.getTime()) {
    const we = addDays(ws, 7)
    let net = 0
    let isProj = false

    if (ws.getTime() > maxT) {
      net = weeklyNetAvg
      isProj = true
    } else {
      for (const r of list) {
        const t = new Date(r.date).getTime()
        if (t >= ws.getTime() && t < we.getTime()) {
          const a = Number(r.amount)
          if (Number.isFinite(a)) net += a
        }
      }
    }

    raw.push({
      label: ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      net,
      isProj,
    })
    ws = addDays(ws, 7)
  }

  let cum = 0
  const withCum = raw.map((p) => {
    cum += p.net
    return { ...p, cum }
  })

  const chartData = withCum.map((p) => ({
    label: p.label,
    act: p.isProj ? null : p.cum,
    proj: p.isProj ? p.cum : null,
  }))

  let lastAct = -1
  withCum.forEach((p, i) => {
    if (!p.isProj) lastAct = i
  })
  if (lastAct >= 0 && lastAct < chartData.length - 1 && chartData[lastAct].act != null) {
    chartData[lastAct].proj = chartData[lastAct].act
  }

  return chartData
}

function lastThreeCalendarMonthsInOut(rows, n = 3) {
  const now = new Date()
  const keys = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  const inBy = Object.fromEntries(keys.map((k) => [k, 0]))
  const outBy = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const r of rows || []) {
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) continue
    const k = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    if (!(k in inBy)) continue
    const a = Number(r.amount)
    if (!Number.isFinite(a)) continue
    if (a > 0) inBy[k] += a
    else outBy[k] += -a
  }
  return keys.map((k) => {
    const [y, m] = k.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
    return { key: k, label, in: inBy[k], out: outBy[k] }
  })
}

function cashflowStatus(summary, lowCash) {
  if (lowCash) return { text: 'ACTION REQUIRED', tone: 'action' }
  if (summary.netMonthly >= 0) return { text: 'HEALTHY', tone: 'healthy' }
  const burnMo = summary.avgMonthlyOut > 0 ? summary.totalCash / summary.avgMonthlyOut : Infinity
  if (burnMo >= 3) return { text: 'REVIEW', tone: 'review' }
  return { text: 'ACTION REQUIRED', tone: 'action' }
}

function ShieldIcon() {
  return (
    <svg className="cf-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function CashFlowPage() {
  const { rows, loading, error } = useUserTransactions()

  const summary = useMemo(() => computeCashflowSummary(rows), [rows])
  const monthlySeries = useMemo(() => buildCashflowMonthlySeries(rows, summary, 90), [rows, summary])
  const barHeightSeries = useMemo(() => seriesToBarHeights(monthlySeries), [monthlySeries])
  const lowCash = useMemo(() => cashflowWeeklyLowCashWarning(summary, 13), [summary])
  const recurringDetected = useMemo(() => detectRecurringTransactions(rows), [rows])

  const capitalMoves = useMemo(() => buildCashflowCapitalMoves({ summary, lowCash }), [lowCash, summary])

  const weeklyChartData = useMemo(() => buildWeeklyCashChartData(rows, summary, 13), [rows, summary])
  const last3Months = useMemo(() => lastThreeCalendarMonthsInOut(rows, 3), [rows])

  const maxInOut = useMemo(() => {
    const vals = last3Months.flatMap((m) => [m.in, m.out])
    return Math.max(1, ...vals)
  }, [last3Months])

  const summaryInsight = useMemo(() => {
    if (last3Months.length < 2) return 'Add more history to compare month-on-month inflows and outflows.'
    const a = last3Months[last3Months.length - 1]
    const b = last3Months[last3Months.length - 2]
    const netA = a.in - a.out
    const netB = b.in - b.out
    const delta = netA - netB
    const dir = delta >= 0 ? 'improved' : 'softened'
    return `Net cash movement ${dir} by ${formatGBP(Math.round(Math.abs(delta)))} vs the prior month (${a.label} vs ${b.label}).`
  }, [last3Months])

  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading
  const status = cashflowStatus(summary, lowCash)
  const netTone = summary.netMonthly >= 0 ? 'positive' : 'negative'
  const improvedNetMonthly = summary.netMonthly + summary.avgMonthlyIn * 0.1

  const scrollToForecast = useCallback(() => {
    document.getElementById('cf-forecast-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="cf-page" data-capital-moves={capitalMoves.length}>
      {error && !loading ? (
        <div className="cf-error" role="alert">
          <p>{error}</p>
          <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="cf-header">
        <div className="cf-header__titles">
          <h1 className="cf-title">Cash Flow</h1>
          <p className="cf-subtitle">Your 90-day cash projection and recurring payment patterns</p>
          <div className="cf-dominant-metric" aria-label="Average net monthly cash position">
            {loading ? (
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '55%', display: 'block' }} />
            ) : !hasData ? (
              <p className="cf-dominant-metric__support">
                Upload transactions to calculate average inflows, outflows, and net position.
              </p>
            ) : (
              <>
                <p className={`cf-dominant-metric__value cf-dominant-metric__value--${netTone}`}>
                  {formatGBP(Math.round(summary.netMonthly))} / month
                </p>
                <p className="cf-dominant-metric__label">Average net monthly position</p>
                <p className="cf-dominant-metric__support">
                  {formatGBP(Math.round(summary.avgMonthlyIn))} average inflows ·{' '}
                  {formatGBP(Math.round(summary.avgMonthlyOut))} average outflows
                </p>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="cf-badge cf-badge--review">REVIEW</span>
        ) : (
          <span className={`cf-badge cf-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      <section className="cf-nba" aria-label="Next best actions">
        {loading ? (
          <div className="cf-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="cf-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="cf-nba-empty">
            Could not load cash flow actions.{' '}
            <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="cf-nba-empty">
            Upload transaction data to unlock cash flow actions. <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : (
          <div className="cf-nba__row" style={{ alignItems: 'stretch' }}>
            <article
              className="cf-action-card cf-action-card--primary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="cf-action-card__recommended">RECOMMENDED</p>
              <p className="cf-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="cf-action-card__impact">{formatGBP(Math.round(summary.avgMonthlyIn))}</p>
              <p className="cf-action-card__title">Chase overdue receivables</p>
              <p className="cf-action-card__desc">
                Outstanding invoices are delaying inflows. Collecting overdue amounts improves your cash position
                immediately.
              </p>
              <div className="cf-action-meta">
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Who</span>
                  <span className="cf-action-meta__val">CFO</span>
                </div>
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Time to act</span>
                  <span className="cf-action-meta__val">Today</span>
                </div>
                <div className="cf-action-meta__cell cf-action-meta__cell--wide">
                  <span className="cf-action-meta__label">Annual impact</span>
                  <span className="cf-action-meta__val cf-action-meta__val--gain">Improved cash position</span>
                </div>
              </div>
              <div className="cf-action-wait">
                <span className="cf-action-wait__label">Cost of waiting</span>
                <span className="cf-action-wait__val">Cash gap widens daily</span>
              </div>
              <div className="cf-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="cf-action-card__cta-pill" to="/app/ar">
                  View AR
                </Link>
              </div>
            </article>

            <article
              className="cf-action-card cf-action-card--secondary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="cf-action-card__kicker">NEXT BEST ACTION 2</p>
              <p
                className="cf-action-card__impact-qual"
                style={{
                  color: '#16a34a',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Real-time forecast accuracy
              </p>
              <p className="cf-action-card__title">Connect Xero for live forecasting</p>
              <p className="cf-action-card__desc">
                Connecting Xero adds outstanding invoices and bills to your forecast, making it significantly more accurate.
              </p>
              <div className="cf-action-meta">
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Who</span>
                  <span className="cf-action-meta__val">CFO</span>
                </div>
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Time to act</span>
                  <span className="cf-action-meta__val">10 minutes</span>
                </div>
                <div className="cf-action-meta__cell cf-action-meta__cell--wide">
                  <span className="cf-action-meta__label">Annual impact</span>
                  <span className="cf-action-meta__val cf-action-meta__val--gain">Real-time forecast accuracy</span>
                </div>
              </div>
              <div className="cf-action-wait">
                <span className="cf-action-wait__label">Cost of waiting</span>
                <span className="cf-action-wait__val">Forecast based on patterns only</span>
              </div>
              <div className="cf-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="cf-action-card__cta-pill" to="/app/integrations">
                  Connect Xero
                </Link>
              </div>
            </article>

            <article
              className="cf-action-card cf-action-card--secondary cf-action-card--tertiary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="cf-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="cf-action-card__impact-qual">
                <ShieldIcon />
                <span>Ongoing protection</span>
              </p>
              <p className="cf-action-card__title">Set low-cash alert threshold</p>
              <p className="cf-action-card__desc">
                Configure an alert so Treasury Autopilot warns you before cash drops below your minimum operating level.
              </p>
              <div className="cf-action-meta">
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Who</span>
                  <span className="cf-action-meta__val">CFO</span>
                </div>
                <div className="cf-action-meta__cell">
                  <span className="cf-action-meta__label">Time to act</span>
                  <span className="cf-action-meta__val">2 minutes</span>
                </div>
                <div className="cf-action-meta__cell cf-action-meta__cell--wide">
                  <span className="cf-action-meta__label">Annual impact</span>
                  <span className="cf-action-meta__val cf-action-meta__val--neutral">Ongoing protection</span>
                </div>
              </div>
              <div className="cf-action-wait">
                <span className="cf-action-wait__label">Cost of waiting</span>
                <span className="cf-action-wait__val cf-action-wait__val--neutral">Zero — act now</span>
              </div>
              <div className="cf-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="cf-action-card__cta-pill" to="/app/preferences">
                  Configure
                </Link>
              </div>
            </article>
          </div>
        )}
      </section>

      {!loading && !fetchFailed && lowCash && hasData ? (
        <section className="cf-inaction" aria-label="Cost of inaction">
          <div className="cf-inaction__left">
            <span className="cf-inaction__dot" aria-hidden />
            <p className="cf-inaction__text">
              A low-cash week is projected within your 90-day forecast. Review your upcoming commitments immediately.
            </p>
          </div>
          <button type="button" className="cf-inaction__link" onClick={scrollToForecast}>
            View projection ↓
          </button>
        </section>
      ) : null}

      {/* Hidden hook: keeps monthly bar scaling utility wired for QA / parity with prior chart */}
      <div style={{ display: 'none' }} aria-hidden data-cf-bars={JSON.stringify(barHeightSeries.map((x) => x.key))} />

      <div className="cf-grid">
        <section className="cf-panel cf-panel--tall" aria-labelledby="cf-position-heading">
          <h2 id="cf-position-heading" className="cf-section-label">
            Your position
          </h2>
          {loading ? (
            <div className="cf-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
            </div>
          ) : fetchFailed ? (
            <div className="cf-empty">
              <p>
                Could not load cash position.{' '}
                <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="cf-empty">
              <p>
                No transactions yet. <Link to="/upload">Upload a bank statement</Link> to model cash flow.
              </p>
            </div>
          ) : (
            <>
              <p className={`cf-cash-hero cf-cash-hero--${netTone}`}>{formatGBP(Math.round(summary.netMonthly))} / month</p>
              <div className="cf-position-loss">
                <p className="cf-position-loss__label">NET MONTHLY POSITION</p>
              </div>
              <div className="cf-stat-rows">
                <div className="cf-stat-row">
                  <span className="cf-stat-row__label">Avg inflows</span>
                  <span className="cf-stat-row__val cf-stat-row__val--green">{formatGBP(Math.round(summary.avgMonthlyIn))}</span>
                </div>
                <div className="cf-stat-row">
                  <span className="cf-stat-row__label">Avg outflows</span>
                  <span className="cf-stat-row__val cf-stat-row__val--red">{formatGBP(Math.round(summary.avgMonthlyOut))}</span>
                </div>
                <div className="cf-stat-row">
                  <span className="cf-stat-row__label">Net position</span>
                  <span className={`cf-stat-row__val ${netTone === 'positive' ? 'cf-stat-row__val--green' : 'cf-stat-row__val--red'}`}>
                    {formatGBP(Math.round(summary.netMonthly))}
                  </span>
                </div>
                <div className="cf-stat-row">
                  <span className="cf-stat-row__label">Low cash warning</span>
                  <span className="cf-stat-row__val">{lowCash ? 'Triggered' : 'Not triggered'}</span>
                </div>
              </div>
              <div className="cf-compare">
                <div className="cf-compare__side cf-compare__side--current">
                  <p className="cf-compare__col-title">CURRENT</p>
                  <p className="cf-compare__body">
                    <span className={netTone === 'positive' ? 'cf-money cf-money--gain' : 'cf-money cf-money--loss'}>
                      {formatGBP(Math.round(summary.netMonthly))}
                    </span>{' '}
                    net / mo
                  </p>
                </div>
                <div className="cf-compare__side cf-compare__side--optimised">
                  <p className="cf-compare__col-title">IMPROVED</p>
                  <p className="cf-compare__body">
                    <span className="cf-rate cf-rate--best cf-money--gain">{formatGBP(Math.round(improvedNetMonthly))}</span> net / mo
                    if overdue AR collected (~10% of avg inflows)
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="cf-panel cf-panel--tall" id="cf-forecast-chart" aria-labelledby="cf-projection-heading">
          <h2 id="cf-projection-heading" className="cf-section-label">
            90-day projection
          </h2>
          {loading ? (
            <div className="cf-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="cf-empty">
              <p>
                Could not load projection.{' '}
                <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="cf-empty">
              <p>Projection appears once we have dated transactions.</p>
            </div>
          ) : weeklyChartData.length === 0 ? (
            <div className="cf-empty">
              <p>Not enough dated movements to plot weekly cash.</p>
            </div>
          ) : (
            <div className="cf-chart-h">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weeklyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(v) => formatCompactAxisGBP(v)}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v) => [formatGBP(Math.round(Number(v))), 'Balance']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  {lowCash && summary.avgMonthlyOut > 0 ? (
                    <ReferenceLine
                      y={summary.avgMonthlyOut}
                      stroke="#dc2626"
                      strokeDasharray="5 5"
                      strokeWidth={1}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="act"
                    name="Actual"
                    stroke="#1b2f8c"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#1b2f8c' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="proj"
                    name="Projected"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="cf-panel" aria-labelledby="cf-rec-heading">
          <h2 id="cf-rec-heading" className="cf-section-label">
            Recurring commitments
          </h2>
          {loading ? (
            <div className="cf-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="cf-empty">
              <p>
                Could not load recurring patterns.{' '}
                <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="cf-empty">
              <p>Recurring payments are inferred once transaction history exists.</p>
            </div>
          ) : recurringDetected.length ? (
            <div className="cf-opp-list">
              {recurringDetected.map((r) => (
                <div key={r.payee} className="cf-opp-row cf-opp-row--recurring">
                  <div className="cf-opp-row__content">
                    <h3 className="cf-opp-row__title">{r.payee}</h3>
                    <p className="cf-opp-row__meta">
                      {r.frequency} · Next expected {r.nextExpected}
                    </p>
                    <p className="cf-opp-row__gain">{formatGBP(Math.round(r.amount))}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TransactionList>
              <TransactionRow
                direction="out"
                payee="No recurring commitments detected"
                meta="Need repeating monthly anchors in your import window"
                amountText="—"
              />
            </TransactionList>
          )}
        </section>

        <section className="cf-panel" aria-labelledby="cf-month-heading">
          <h2 id="cf-month-heading" className="cf-section-label">
            Monthly summary
          </h2>
          {loading ? (
            <div className="cf-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 160, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="cf-empty">
              <p>
                Could not load monthly summary.{' '}
                <button type="button" className="cf-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="cf-empty">
              <p>Monthly inflows and outflows appear after you upload data.</p>
            </div>
          ) : (
            <>
              <div className="cf-monthly-summary">
                {last3Months.map((m) => (
                  <div key={m.key} className="cf-monthly-summary__group">
                    <p className="cf-monthly-summary__month">{m.label}</p>
                    <div className="cf-monthly-summary__bars">
                      <div className="cf-monthly-summary__col">
                        <div
                          className="cf-monthly-summary__bar cf-monthly-summary__bar--in"
                          style={{ height: `${5 + (m.in / maxInOut) * 120}px` }}
                        />
                        <span className="cf-monthly-summary__tag">In</span>
                      </div>
                      <div className="cf-monthly-summary__col">
                        <div
                          className="cf-monthly-summary__bar cf-monthly-summary__bar--out"
                          style={{ height: `${5 + (m.out / maxInOut) * 120}px` }}
                        />
                        <span className="cf-monthly-summary__tag">Out</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="cf-insight">{summaryInsight}</p>
              <p className="cf-monthly-cost">
                Latest month net:{' '}
                {formatGBP(
                  Math.round(last3Months[last3Months.length - 1].in - last3Months[last3Months.length - 1].out),
                )}{' '}
                · Outflows{' '}
                {last3Months[last3Months.length - 1].in > 0
                  ? formatPct((last3Months[last3Months.length - 1].out / last3Months[last3Months.length - 1].in) * 100, 0)
                  : '—'}{' '}
                of inflows
              </p>
            </>
          )}
        </section>
      </div>

      <p className="cf-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
