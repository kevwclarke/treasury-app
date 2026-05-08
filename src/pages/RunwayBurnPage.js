import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { useDaysDataUnaddressed } from '../hooks/useDaysDataUnaddressed'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatCompactAxisGBP, formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { computeBurn30Vs90Pct } from '../utils/treasuryKpi'
import { TermTooltip } from '../components/TermTooltip'
import '../styles/design-system.css'
import './RunwayBurnPage.css'

function monthKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function last12MonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function runwayStatusLabel(baseRunwayMo) {
  if (baseRunwayMo == null || !Number.isFinite(baseRunwayMo)) {
    return { text: 'REVIEW', tone: 'review' }
  }
  if (baseRunwayMo > 18) return { text: 'HEALTHY', tone: 'healthy' }
  if (baseRunwayMo >= 12) return { text: 'REVIEW', tone: 'review' }
  return { text: 'ACTION REQUIRED', tone: 'action' }
}

function runwayTone(baseRunwayMo) {
  if (baseRunwayMo == null || !Number.isFinite(baseRunwayMo)) return 'review'
  if (baseRunwayMo > 18) return 'healthy'
  if (baseRunwayMo >= 12) return 'review'
  return 'action'
}

function fundraiseConversationByDate(baseRunwayMo) {
  const d = new Date()
  const monthsAhead = Math.floor(Math.max(0, Number(baseRunwayMo) || 0) - 6)
  d.setMonth(d.getMonth() + monthsAhead)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function categoryBorderClass(name) {
  const map = {
    Payroll: 'rnwy-opp-row--cat-payroll',
    Infrastructure: 'rnwy-opp-row--cat-infra',
    Contractors: 'rnwy-opp-row--cat-contractors',
    Travel: 'rnwy-opp-row--cat-infra',
    'Office & Ops': 'rnwy-opp-row--cat-office',
    Marketing: 'rnwy-opp-row--cat-marketing',
    Other: 'rnwy-opp-row--cat-other',
  }
  return map[name] || 'rnwy-opp-row--cat-other'
}

function ShieldIcon() {
  return (
    <svg className="rnwy-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function RunwayBurnPage() {
  const { rows, loading, error } = useUserTransactions()
  const { days: daysUnaddressed, loading: daysUnaddressedLoading } = useDaysDataUnaddressed()

  const runwayCore = useMemo(() => computeRunwayFromTransactions(rows), [rows])
  const burnMom = useMemo(() => computeBurn30Vs90Pct(rows), [rows])

  const monthKeys = useMemo(() => last12MonthKeys(), [])
  const monthlyByMonth = useMemo(() => {
    const m = Object.fromEntries(
      monthKeys.map((k) => [k, { total: 0, byCat: Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0])) }]),
    )
    rows.forEach((t) => {
      const a = Number(t.amount)
      if (!Number.isFinite(a) || a >= 0) return
      const k = monthKey(t.date)
      if (!k || !m[k]) return
      const spend = Math.abs(a)
      const cat = categorisePayee(t.payee)
      m[k].total += spend
      m[k].byCat[cat] += spend
    })
    return m
  }, [rows, monthKeys])

  const burnRollup = useMemo(() => {
    const sixKeys = monthKeys.slice(-6)
    const byCat = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
    let total = 0
    sixKeys.forEach((k) => {
      const cell = monthlyByMonth[k]
      if (!cell) return
      BURN_CATEGORY_ORDER.forEach((c) => {
        byCat[c] += cell.byCat[c] || 0
      })
      total += cell.total
    })
    const rowsOut = BURN_CATEGORY_ORDER.map((name) => ({
      name,
      monthlyAvg: sixKeys.length ? byCat[name] / sixKeys.length : 0,
      totalCat: byCat[name],
      pct: total > 0 ? (byCat[name] / total) * 100 : 0,
    }))
      .filter((r) => r.totalCat > 0)
      .sort((a, b) => b.totalCat - a.totalCat)
      .slice(0, 6)
    const top3Pct = rowsOut.slice(0, 3).reduce((s, r) => s + r.pct, 0)
    return { rows: rowsOut, totalBurnSixMo: total, top3Pct }
  }, [monthKeys, monthlyByMonth])

  const chartSeries = useMemo(() => {
    const sixKeys = monthKeys.slice(-6)
    return sixKeys.map((k) => {
      const cell = monthlyByMonth[k] || { total: 0 }
      const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 1)
      const label = d.toLocaleDateString('en-GB', { month: 'short' })
      return { month: label, burn: cell.total }
    })
  }, [monthKeys, monthlyByMonth])

  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading
  const baseMo = runwayCore.baseRunwayMo
  const hasValidRunway = baseMo != null && Number.isFinite(baseMo)
  const tone = runwayTone(baseMo)
  const status = runwayStatusLabel(baseMo)

  const runwayLiftMo =
    runwayCore.bullRunwayMo != null && runwayCore.baseRunwayMo != null
      ? Math.max(0, runwayCore.bullRunwayMo - runwayCore.baseRunwayMo)
      : 0

  const monthsAdded10PctBurnCut = useMemo(() => {
    const tc = runwayCore.totalCash
    const mb = runwayCore.monthlyBurn
    if (!hasValidRunway || mb <= 0 || !Number.isFinite(tc)) return null
    const added = tc / (mb * 0.9) - tc / mb
    return Math.max(0, added)
  }, [hasValidRunway, runwayCore.monthlyBurn, runwayCore.totalCash])

  const progressPct = hasValidRunway ? Math.min(100, (baseMo / 24) * 100) : 0

  const scrollToRunwayViz = useCallback(() => {
    document.getElementById('rnwy-runway-viz')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const burnTrendSentence = useMemo(() => {
    const d = burnMom?.deltaPct
    if (d == null || !Number.isFinite(d)) {
      return 'Insufficient recent outflows to compare 30-day vs 90-day burn.'
    }
    const dir = d >= 0 ? 'increased' : 'decreased'
    return `Monthly burn has ${dir} ${formatPct(Math.abs(d), 1)} over the last 90 days`
  }, [burnMom?.deltaPct])

  const fmtMo = (v) => (v != null && Number.isFinite(v) ? Number(v).toFixed(1) : '—')

  return (
    <div className="rnwy-page">
      {error && !loading ? (
        <div className="rnwy-error" role="alert">
          <p>{error}</p>
          <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="rnwy-header">
        <div className="rnwy-header__titles">
          <h1 className="rnwy-title">Runway & Burn</h1>
          <p className="rnwy-subtitle">
            How long your cash will last and where it is going
          </p>
          <div className="rnwy-dominant-metric" aria-label="Base case runway at current burn">
            {loading ? (
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '60%', display: 'block' }} />
            ) : (
              <>
                <p className={`rnwy-dominant-metric__value rnwy-dominant-metric__value--${tone}`}>
                  {hasValidRunway ? `${fmtMo(baseMo)} months` : '—'}
                </p>
                <p className="rnwy-dominant-metric__label">Base case runway at current burn</p>
                <p className="rnwy-dominant-metric__support">
                  Bear case {fmtMo(runwayCore.bearRunwayMo)} months · Bull case {fmtMo(runwayCore.bullRunwayMo)} months
                  with yield optimised —{' '}
                  {daysUnaddressedLoading || daysUnaddressed == null ? '—' : daysUnaddressed} days unaddressed
                </p>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="rnwy-badge rnwy-badge--review">REVIEW</span>
        ) : (
          <span className={`rnwy-badge rnwy-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      <section className="rnwy-nba" aria-label="Next best actions">
        {loading ? (
          <div className="rnwy-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rnwy-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="rnwy-nba-empty">
            Could not load runway actions.{' '}
            <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="rnwy-nba-empty">
            Upload transaction data to unlock runway actions. <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : !hasValidRunway ? (
          <div className="rnwy-nba-empty">
            No monthly burn detected in your import — add debits or check column mapping to model runway.
          </div>
        ) : (
          <div className="rnwy-nba__row" style={{ alignItems: 'stretch' }}>
            <article
              className="rnwy-action-card rnwy-action-card--primary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="rnwy-action-card__recommended">RECOMMENDED</p>
              <p className="rnwy-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="rnwy-action-card__impact">+{runwayLiftMo.toFixed(1)} mo</p>
              <p className="rnwy-action-card__title">Extend runway through yield optimisation</p>
              <p className="rnwy-action-card__desc">
                Moving idle cash to higher yield products adds months to your runway without cutting burn.
              </p>
              <div className="rnwy-action-meta">
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Who</span>
                  <span className="rnwy-action-meta__val">CFO</span>
                </div>
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Time to act</span>
                  <span className="rnwy-action-meta__val">This week</span>
                </div>
                <div className="rnwy-action-meta__cell rnwy-action-meta__cell--wide">
                  <span className="rnwy-action-meta__label">Annual impact</span>
                  <span className="rnwy-action-meta__val rnwy-action-meta__val--gain">
                    +{runwayLiftMo.toFixed(1)} months runway
                  </span>
                </div>
              </div>
              <div className="rnwy-action-wait">
                <span className="rnwy-action-wait__label">Cost of waiting</span>
                <span className="rnwy-action-wait__val">
                  Every month costs {formatGBP(Math.round(runwayCore.monthlyBurn))}
                </span>
              </div>
              <div className="rnwy-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="rnwy-action-card__cta-pill" to="/app/yield">
                  Optimise yield
                </Link>
              </div>
            </article>

            <article
              className="rnwy-action-card rnwy-action-card--secondary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="rnwy-action-card__kicker">NEXT BEST ACTION 2</p>
              <p className="rnwy-action-card__impact">
                {monthsAdded10PctBurnCut != null ? `Up to ${monthsAdded10PctBurnCut.toFixed(1)} mo` : '—'}
              </p>
              <p className="rnwy-action-card__title">Review largest burn categories</p>
              <p className="rnwy-action-card__desc">
                Your top spending categories are driving {formatPct(burnRollup.top3Pct, 0)} of total burn. A 10%
                reduction adds {monthsAdded10PctBurnCut != null ? `${monthsAdded10PctBurnCut.toFixed(1)} months` : '—'}{' '}
                to runway.
              </p>
              <div className="rnwy-action-meta">
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Who</span>
                  <span className="rnwy-action-meta__val">CFO</span>
                </div>
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Time to act</span>
                  <span className="rnwy-action-meta__val">This week</span>
                </div>
                <div className="rnwy-action-meta__cell rnwy-action-meta__cell--wide">
                  <span className="rnwy-action-meta__label">Annual impact</span>
                  <span className="rnwy-action-meta__val rnwy-action-meta__val--gain">
                    {monthsAdded10PctBurnCut != null
                      ? `Up to ${monthsAdded10PctBurnCut.toFixed(1)} additional runway`
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="rnwy-action-wait">
                <span className="rnwy-action-wait__label">Cost of waiting</span>
                <span className="rnwy-action-wait__val">
                  {formatGBP(Math.round(runwayCore.monthlyBurn))} per month continuing
                </span>
              </div>
              <div className="rnwy-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="rnwy-action-card__cta-pill" to="/app/burn-intelligence">
                  View burn breakdown
                </Link>
              </div>
            </article>

            <article
              className="rnwy-action-card rnwy-action-card--secondary rnwy-action-card--tertiary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="rnwy-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="rnwy-action-card__impact-qual">
                <ShieldIcon />
                <span>Ongoing protection</span>
              </p>
              <p className="rnwy-action-card__title">Model your next raise timing</p>
              <p className="rnwy-action-card__desc">
                Configure your fundraising timeline to get an alert when you should already be in conversations.
              </p>
              <div className="rnwy-action-meta">
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Who</span>
                  <span className="rnwy-action-meta__val">CFO</span>
                </div>
                <div className="rnwy-action-meta__cell">
                  <span className="rnwy-action-meta__label">Time to act</span>
                  <span className="rnwy-action-meta__val">2 minutes</span>
                </div>
                <div className="rnwy-action-meta__cell rnwy-action-meta__cell--wide">
                  <span className="rnwy-action-meta__label">Annual impact</span>
                  <span className="rnwy-action-meta__val rnwy-action-meta__val--neutral">Ongoing protection</span>
                </div>
              </div>
              <div className="rnwy-action-wait">
                <span className="rnwy-action-wait__label">Cost of waiting</span>
                <span className="rnwy-action-wait__val rnwy-action-wait__val--neutral">Zero — act now</span>
              </div>
              <div className="rnwy-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="rnwy-action-card__cta-pill" to="/app/fundraise">
                  Configure
                </Link>
              </div>
            </article>
          </div>
        )}
      </section>

      {!loading && !fetchFailed && hasData && hasValidRunway && baseMo < 18 ? (
        <section className="rnwy-inaction" aria-label="Cost of inaction">
          <div className="rnwy-inaction__left">
            <span className="rnwy-inaction__dot" aria-hidden />
            <p className="rnwy-inaction__text">
              At current burn rate, you have {fmtMo(baseMo)} months of runway. Fundraising takes 6 months — start
              conversations by {fundraiseConversationByDate(baseMo)}.
            </p>
          </div>
          <button type="button" className="rnwy-inaction__link" onClick={scrollToRunwayViz}>
            Model your runway ↓
          </button>
        </section>
      ) : null}

      <div className="rnwy-grid">
        <section className="rnwy-panel rnwy-panel--tall" aria-labelledby="rnwy-position-heading">
          <h2 id="rnwy-position-heading" className="rnwy-section-label">
            Your position
          </h2>
          {loading ? (
            <div className="rnwy-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 12 }} />
              <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 12 }} />
            </div>
          ) : fetchFailed ? (
            <div className="rnwy-empty">
              <p>
                Could not load your position.{' '}
                <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="rnwy-empty">
              <p>
                No cash position yet. <Link to="/upload">Upload a bank statement</Link> to see runway and burn.
              </p>
            </div>
          ) : !hasValidRunway ? (
            <div className="rnwy-empty">
              <p>No outflows found in your import — add debits or check column mapping.</p>
            </div>
          ) : (
            <>
              <div className="rnwy-position-loss">
                <p className="rnwy-position-loss__label">BASE CASE RUNWAY</p>
              </div>
              <p className={`rnwy-cash-hero rnwy-cash-hero--${tone}`}>{fmtMo(baseMo)} months</p>
              <div className="rnwy-stat-rows">
                <div className="rnwy-stat-row">
                  <span className="rnwy-stat-row__label">Total cash</span>
                  <span className="rnwy-stat-row__val">{formatGBP(Math.round(runwayCore.totalCash))}</span>
                </div>
                <div className="rnwy-stat-row">
                  <span className="rnwy-stat-row__label">
                    <TermTooltip term="burn-rate" label="Monthly burn" />
                  </span>
                  <span className="rnwy-stat-row__val">{formatGBP(Math.round(runwayCore.monthlyBurn))}</span>
                </div>
                <div className="rnwy-stat-row">
                  <span className="rnwy-stat-row__label">Bear case</span>
                  <span className="rnwy-stat-row__val rnwy-stat-row__val--red">{fmtMo(runwayCore.bearRunwayMo)} months</span>
                </div>
                <div className="rnwy-stat-row">
                  <span className="rnwy-stat-row__label">Bull case</span>
                  <span className="rnwy-stat-row__val rnwy-stat-row__val--green">{fmtMo(runwayCore.bullRunwayMo)} months</span>
                </div>
              </div>
              <div className="rnwy-compare">
                <div className="rnwy-compare__side rnwy-compare__side--current">
                  <p className="rnwy-compare__col-title">CURRENT</p>
                  <p className="rnwy-compare__body">
                    <span className="rnwy-rate rnwy-rate--current">{fmtMo(baseMo)} months</span> ·{' '}
                    <span className="rnwy-money rnwy-money--loss">{formatGBP(Math.round(runwayCore.monthlyBurn))}</span>{' '}
                    burn
                  </p>
                </div>
                <div className="rnwy-compare__side rnwy-compare__side--optimised">
                  <p className="rnwy-compare__col-title">OPTIMISED</p>
                  <p className="rnwy-compare__body">
                    <span className="rnwy-rate rnwy-rate--best">{fmtMo(runwayCore.bullRunwayMo)} months</span> ·{' '}
                    <span className="rnwy-money rnwy-money--gain">yield-adjusted</span>
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="rnwy-panel rnwy-panel--tall" id="rnwy-runway-viz" aria-labelledby="rnwy-scenarios-heading">
          <h2 id="rnwy-scenarios-heading" className="rnwy-section-label">
            Runway scenarios
          </h2>
          {loading ? (
            <div className="rnwy-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 16 }} />
            </div>
          ) : fetchFailed ? (
            <div className="rnwy-empty">
              <p>
                Could not load scenarios.{' '}
                <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="rnwy-empty">
              <p>
                Scenarios appear once we know your cash and burn. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : !hasValidRunway ? (
            <div className="rnwy-empty">
              <p>Add debits to your import to plot bear, base, and bull runway.</p>
            </div>
          ) : (
            <>
              <div className="rnwy-scenario-row">
                <div className="rnwy-scenario-cell rnwy-scenario-cell--bear">
                  <p className="rnwy-scenario__mo">{fmtMo(runwayCore.bearRunwayMo)}</p>
                  <p className="rnwy-scenario__lbl">
                    BEAR
                    <br />
                    +15% burn
                  </p>
                </div>
                <div className={`rnwy-scenario-cell rnwy-scenario-cell--base rnwy-scenario-cell--${tone}`}>
                  <p className="rnwy-scenario__mo">{fmtMo(baseMo)}</p>
                  <p className="rnwy-scenario__lbl">
                    BASE
                    <br />
                    current
                  </p>
                </div>
                <div className="rnwy-scenario-cell rnwy-scenario-cell--bull">
                  <p className="rnwy-scenario__mo">{fmtMo(runwayCore.bullRunwayMo)}</p>
                  <p className="rnwy-scenario__lbl">
                    BULL
                    <br />
                    yield optimised
                  </p>
                </div>
              </div>
              <div className="rnwy-runway-target-bar">
                <div
                  className={`rnwy-runway-target-bar__fill rnwy-runway-target-bar__fill--${tone}`}
                  style={{ width: `${progressPct}%` }}
                />
                <div className="rnwy-runway-target-bar__marker" style={{ left: `${(18 / 24) * 100}%` }} aria-hidden />
              </div>
              <div className="rnwy-runway-target-meta">
                <span className="rnwy-runway-target-marker-label">Fundraise threshold</span>
                <span className="rnwy-runway-target-end">24mo target</span>
              </div>
            </>
          )}
        </section>

        <section className="rnwy-panel" aria-labelledby="rnwy-burn-heading">
          <h2 id="rnwy-burn-heading" className="rnwy-section-label">
            Burn breakdown
          </h2>
          {loading ? (
            <div className="rnwy-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="rnwy-empty">
              <p>
                Could not load burn breakdown.{' '}
                <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="rnwy-empty">
              <p>
                Burn breakdown needs transaction history. <Link to="/upload">Upload a bank statement</Link>
              </p>
            </div>
          ) : burnRollup.rows.length === 0 ? (
            <div className="rnwy-empty">
              <p>No spend detected in the last six months of your file.</p>
            </div>
          ) : (
            <div className="rnwy-opp-list">
              {burnRollup.rows.map((r) => {
                const pctWidth = Math.max(0, Math.min(100, Number(r.pct) || 0))
                const barColor =
                  r.name === 'Payroll'
                    ? '#1B2F8C'
                    : r.name === 'Infrastructure'
                      ? '#9CA3AF'
                      : r.name === 'Contractors'
                        ? '#F59E0B'
                        : r.name === 'Office & Ops'
                          ? '#16A34A'
                          : r.name === 'Marketing'
                            ? '#3B82F6'
                            : '#D1D5DB'

                return (
                  <div key={r.name} className={`rnwy-opp-row ${categoryBorderClass(r.name)}`}>
                    <div className="rnwy-opp-row__content">
                      <h3 className="rnwy-opp-row__title">{r.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="rnwy-market-row__track">
                            <div
                              className="rnwy-market-row__fill"
                              style={{ width: `${pctWidth}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            width: '48px',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#6B7280',
                          }}
                        >
                          {formatPct(r.pct, 1)}
                        </span>
                      </div>
                      <p className="rnwy-opp-row__meta">Monthly average over last 6 months</p>
                      <p className="rnwy-opp-row__rationale">{formatPct(r.pct, 1)} of total burn</p>
                      <p className="rnwy-opp-row__gain">{formatGBP(Math.round(r.monthlyAvg))}/mo</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rnwy-panel" aria-labelledby="rnwy-trend-heading">
          <h2 id="rnwy-trend-heading" className="rnwy-section-label">
            Burn trend
          </h2>
          {loading ? (
            <div className="rnwy-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="rnwy-empty">
              <p>
                Could not load burn trend.{' '}
                <button type="button" className="rnwy-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="rnwy-empty">
              <p>
                Trend charts appear once we have outflows. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="rnwy-chart-h">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickFormatter={(v) => formatCompactAxisGBP(v)}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v) => [formatGBP(Math.round(Number(v))), 'Burn']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Line type="monotone" dataKey="burn" stroke="#1b2f8c" strokeWidth={2} dot={{ r: 3, fill: '#1b2f8c' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="rnwy-insight">{burnTrendSentence}</p>
              {hasValidRunway ? (
                <p className="rnwy-monthly-cost">
                  Current burn rate: {formatGBP(Math.round(runwayCore.monthlyBurn))} per month
                </p>
              ) : (
                <p className="rnwy-monthly-cost">Current burn rate: not enough outflows to estimate</p>
              )}
            </>
          )}
        </section>
      </div>

      <p className="rnwy-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
