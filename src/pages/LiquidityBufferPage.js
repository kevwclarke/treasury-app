import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import {
  computeLiquidityBuffer,
  LIQUIDITY_MIN_MONTHS,
  LIQUIDITY_TARGET_MONTHS,
} from '../utils/treasuryLiquidity'
import { computeConcentrationFromTransactions } from '../utils/treasuryConcentration'
import { computeYieldSummary } from '../utils/treasuryReportPayload'
import { detectRecurringTransactions } from '../utils/treasuryCashflow'
import { buildLiquidityCapitalMoves } from '../utils/capitalMovesFromData'
import { YIELD_CURRENT_PCT } from '../utils/treasuryYield'
import '../styles/design-system.css'
import './LiquidityBufferPage.css'

const BR_BUFFER_ANNUAL_MULT = 0.0502

function fmtBufferMonths(liq) {
  if (liq.monthlyBurn <= 0) return '∞'
  if (liq.bufferMonths == null || !Number.isFinite(liq.bufferMonths)) return '—'
  return liq.bufferMonths.toLocaleString('en-GB', { maximumFractionDigits: 1 })
}

function liquidityStatus(liq) {
  if (liq.monthlyBurn <= 0) return { text: 'HEALTHY', tone: 'healthy' }
  const bm = liq.bufferMonths
  if (bm == null || !Number.isFinite(bm)) return { text: 'REVIEW', tone: 'review' }
  if (bm > LIQUIDITY_TARGET_MONTHS) return { text: 'HEALTHY', tone: 'healthy' }
  if (bm >= LIQUIDITY_MIN_MONTHS) return { text: 'REVIEW', tone: 'review' }
  return { text: 'ACTION REQUIRED', tone: 'action' }
}

function dominantTone(liq) {
  if (liq.monthlyBurn <= 0) return 'healthy'
  const bm = liq.bufferMonths
  if (bm == null || !Number.isFinite(bm)) return 'review'
  if (bm > LIQUIDITY_TARGET_MONTHS) return 'healthy'
  if (bm >= LIQUIDITY_MIN_MONTHS) return 'review'
  return 'action'
}

function monthsMoneyClass(tone) {
  if (tone === 'healthy') return 'liq-money liq-money--gain'
  if (tone === 'review') return 'liq-money liq-money--warn'
  return 'liq-money liq-money--loss'
}

function recurringOutflowObligations(rows) {
  const rec = detectRecurringTransactions(rows)
  return rec.filter((item) => {
    const samePayee = rows.filter((r) => String(r.payee ?? '').trim() === item.payee)
    const outs = samePayee.filter((r) => Number(r.amount) < 0).length
    const ins = samePayee.filter((r) => Number(r.amount) > 0).length
    return outs >= ins && outs > 0
  })
}

function obligationRowClass(nextIso) {
  const d = new Date(nextIso)
  if (Number.isNaN(d.getTime())) return 'liq-opp-row--near'
  const t = d.setHours(0, 0, 0, 0)
  const today = new Date().setHours(0, 0, 0, 0)
  if (t < today) return 'liq-opp-row--overdue'
  const days = (t - today) / 86400000
  if (days <= 14) return 'liq-opp-row--near'
  return 'liq-opp-row--navy'
}

function ShieldIcon() {
  return (
    <svg className="liq-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function LiquidityBufferPage() {
  const { rows, loading, error } = useUserTransactions()

  const liq = useMemo(() => computeLiquidityBuffer(rows), [rows])
  const concentration = useMemo(() => computeConcentrationFromTransactions(rows), [rows])
  const yieldSummary = useMemo(() => computeYieldSummary(rows), [rows])
  const capitalMoves = useMemo(() => buildLiquidityCapitalMoves({ liq }), [liq])

  const obligationCandidates = useMemo(() => recurringOutflowObligations(rows), [rows])
  const obligationRows = useMemo(
    () => [...obligationCandidates].sort((a, b) => String(a.nextExpected).localeCompare(String(b.nextExpected))),
    [obligationCandidates],
  )

  const liquidAccounts = useMemo(
    () => concentration.institutionRows.filter((r) => r.balance > 0),
    [concentration.institutionRows],
  )

  const blendedPct = yieldSummary.currentYieldDec * 100
  const eligible = liq.eligibleForYield
  const bufferCash = Math.max(0, liq.totalCash - eligible)
  const instantlyLiquidCash = Math.max(0, liq.totalCash)
  const nba2Annual = bufferCash * BR_BUFFER_ANNUAL_MULT
  const nba2Daily = nba2Annual / 365

  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading
  const status = liquidityStatus(liq)
  const tone = dominantTone(liq)

  const barFillPct = useMemo(() => {
    if (liq.monthlyBurn <= 0) return 100
    const bm = liq.bufferMonths
    if (bm == null || !Number.isFinite(bm) || bm < 0) return 0
    return Math.min(100, (bm / LIQUIDITY_TARGET_MONTHS) * 100)
  }, [liq.monthlyBurn, liq.bufferMonths])

  const gaugeTone = tone

  const criticalBuffer =
    liq.monthlyBurn > 0 &&
    liq.bufferMonths != null &&
    Number.isFinite(liq.bufferMonths) &&
    liq.bufferMonths < LIQUIDITY_MIN_MONTHS

  const obligationsInsight = useMemo(() => {
    const n = obligationRows.length
    if (n === 0) {
      return 'No repeating outflows matched yet — add more history or connect accounting data for upcoming bills.'
    }
    return `${n} repeating obligation${n === 1 ? '' : 's'} detected from your transaction patterns.`
  }, [obligationRows])

  const scrollToGauge = useCallback(() => {
    document.getElementById('liq-buffer-gauge')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const fmtNext = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="liq-page" data-capital-moves={capitalMoves.length}>
      {error && !loading ? (
        <div className="liq-error" role="alert">
          <p>{error}</p>
          <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="liq-header">
        <div className="liq-header__titles">
          <h1 className="liq-title">Liquidity Buffer</h1>
          <p className="liq-subtitle">Instantly accessible cash versus your operational obligations</p>
          <div className="liq-dominant-metric" aria-label="Months of instantly accessible cash">
            {loading ? (
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '55%', display: 'block' }} />
            ) : !hasData ? (
              <p className="liq-dominant-metric__support">
                Upload transactions to estimate how many months of obligations your accessible cash covers.
              </p>
            ) : (
              <>
                <p className={`liq-dominant-metric__value liq-dominant-metric__value--${tone}`}>
                  {fmtBufferMonths(liq)} months
                </p>
                <p className="liq-dominant-metric__label">Months of instantly accessible cash</p>
                <p className="liq-dominant-metric__support">
                  Minimum {LIQUIDITY_MIN_MONTHS} months · Target {LIQUIDITY_TARGET_MONTHS} months · Your position{' '}
                  {fmtBufferMonths(liq)} months
                </p>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="liq-badge liq-badge--review">REVIEW</span>
        ) : (
          <span className={`liq-badge liq-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      {!loading && !fetchFailed && criticalBuffer && hasData ? (
        <section className="liq-inaction" aria-label="Cost of inaction">
          <div className="liq-inaction__left">
            <span className="liq-inaction__dot" aria-hidden />
            <p className="liq-inaction__text">
              Your liquidity buffer is critically low. You may not be able to meet operational obligations in the next 3
              months.
            </p>
          </div>
          <button type="button" className="liq-inaction__link" onClick={scrollToGauge}>
            Buffer status ↓
          </button>
        </section>
      ) : null}

      <section className="liq-nba" aria-label="Next best actions">
        {loading ? (
          <div className="liq-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="liq-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="liq-nba-empty">
            Could not load liquidity actions.{' '}
            <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="liq-nba-empty">
            Upload transaction data to unlock liquidity actions. <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : (
          <div className="liq-nba__row" style={{ alignItems: 'stretch' }}>
            <article
              className="liq-action-card liq-action-card--primary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="liq-action-card__recommended">RECOMMENDED</p>
              <p className="liq-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="liq-action-card__impact--qual">6 months operational security</p>
              <p className="liq-action-card__title">Top up liquidity buffer to 6 months</p>
              <p className="liq-action-card__desc">
                Move funds from lower-priority accounts to instantly accessible accounts to reach your target buffer.
              </p>
              <div className="liq-action-meta">
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Who</span>
                  <span className="liq-action-meta__val">CFO</span>
                </div>
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Time to act</span>
                  <span className="liq-action-meta__val">This week</span>
                </div>
                <div className="liq-action-meta__cell liq-action-meta__cell--wide">
                  <span className="liq-action-meta__label">Annual impact</span>
                  <span
                    style={{
                      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#16a34a',
                    }}
                  >
                    {formatGBP(Math.round(instantlyLiquidCash))} protected
                  </span>
                </div>
              </div>
              <div className="liq-action-wait">
                <span className="liq-action-wait__label">Cost of waiting</span>
                <span className="liq-action-wait__val">Operational risk continues</span>
              </div>
              <div className="liq-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="liq-action-card__cta-pill" to="/app/concentration">
                  Review accounts
                </Link>
              </div>
            </article>

            <article
              className="liq-action-card liq-action-card--secondary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="liq-action-card__kicker">NEXT BEST ACTION 2</p>
              <p className="liq-action-card__impact">{formatGBP(Math.round(nba2Annual))}/yr</p>
              <p className="liq-action-card__title">Optimise yield on buffer cash</p>
              <p className="liq-action-card__desc">
                Your buffer cash can earn 5.12% in a same-day access money market fund without sacrificing liquidity.
              </p>
              <div className="liq-action-meta">
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Who</span>
                  <span className="liq-action-meta__val">CFO</span>
                </div>
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Time to act</span>
                  <span className="liq-action-meta__val">This week</span>
                </div>
                <div className="liq-action-meta__cell liq-action-meta__cell--wide">
                  <span className="liq-action-meta__label">Annual impact</span>
                  <span className="liq-action-meta__val liq-action-meta__val--gain">
                    {formatGBP(Math.round(nba2Annual))}/yr
                  </span>
                </div>
              </div>
              <div className="liq-action-wait">
                <span className="liq-action-wait__label">Cost of waiting</span>
                <span className="liq-action-wait__val">{formatGBP(Math.round(nba2Daily))}/day</span>
              </div>
              <div className="liq-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="liq-action-card__cta-pill" to="/app/yield">
                  View options
                </Link>
              </div>
            </article>

            <article
              className="liq-action-card liq-action-card--secondary liq-action-card--tertiary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="liq-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="liq-action-card__impact-qual">
                <ShieldIcon />
                <span>Ongoing protection</span>
              </p>
              <p className="liq-action-card__title">Set buffer alert threshold</p>
              <p className="liq-action-card__desc">
                Get alerted the moment your buffer drops below your minimum threshold.
              </p>
              <div className="liq-action-meta">
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Who</span>
                  <span className="liq-action-meta__val">CFO</span>
                </div>
                <div className="liq-action-meta__cell">
                  <span className="liq-action-meta__label">Time to act</span>
                  <span className="liq-action-meta__val">2 minutes</span>
                </div>
                <div className="liq-action-meta__cell liq-action-meta__cell--wide">
                  <span className="liq-action-meta__label">Annual impact</span>
                  <span className="liq-action-meta__val liq-action-meta__val--neutral">Ongoing protection</span>
                </div>
              </div>
              <div className="liq-action-wait">
                <span className="liq-action-wait__label">Cost of waiting</span>
                <span className="liq-action-wait__val liq-action-wait__val--neutral">Zero — act now</span>
              </div>
              <div className="liq-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="liq-action-card__cta-pill" to="/app/preferences">
                  Configure
                </Link>
              </div>
            </article>
          </div>
        )}
      </section>

      <div className="liq-grid">
        <section className="liq-panel liq-panel--tall" aria-labelledby="liq-position-heading">
          <h2 id="liq-position-heading" className="liq-section-label">
            Your position
          </h2>
          {loading ? (
            <div className="liq-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 12 }} />
            </div>
          ) : fetchFailed ? (
            <div className="liq-empty">
              <p>
                Could not load your position.{' '}
                <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="liq-empty">
              <p>
                No liquidity view yet. <Link to="/upload">Upload a bank statement</Link> to model your buffer.
              </p>
            </div>
          ) : (
            <>
              <p className={`liq-cash-hero liq-cash-hero--${tone}`}>{fmtBufferMonths(liq)} months</p>
              <div className="liq-position-loss">
                <p className="liq-position-loss__label">LIQUIDITY BUFFER</p>
                <p className="liq-position-loss__cause">
                  Instantly accessible cash versus {LIQUIDITY_MIN_MONTHS}-month obligations derived from your recent burn.
                </p>
              </div>
              <div className="liq-stat-rows">
                <div className="liq-stat-row">
                  <span className="liq-stat-row__label">Instantly liquid cash</span>
                  <span className="liq-stat-row__val">{formatGBP(Math.round(liq.totalCash))}</span>
                </div>
                <div className="liq-stat-row">
                  <span className="liq-stat-row__label">3-month obligations</span>
                  <span className="liq-stat-row__val">{formatGBP(Math.round(liq.obligations3mo))}</span>
                </div>
                <div className="liq-stat-row">
                  <span className="liq-stat-row__label">Buffer excess</span>
                  <span
                    className={`liq-stat-row__val ${liq.bufferExcess < 0 ? 'liq-stat-row__val--red' : 'liq-stat-row__val--green'}`}
                  >
                    {formatGBP(Math.round(liq.bufferExcess))}
                  </span>
                </div>
                <div className="liq-stat-row">
                  <span className="liq-stat-row__label">Buffer months</span>
                  <span
                    className={`liq-stat-row__val ${
                      tone === 'healthy'
                        ? 'liq-stat-row__val--green'
                        : tone === 'review'
                          ? 'liq-stat-row__val--amber'
                          : 'liq-stat-row__val--red'
                    }`}
                  >
                    {fmtBufferMonths(liq)} mo
                  </span>
                </div>
              </div>
              <div className="liq-compare">
                <div className="liq-compare__side liq-compare__side--current">
                  <p className="liq-compare__col-title">CURRENT</p>
                  <p className="liq-compare__body">
                    <span className={monthsMoneyClass(tone)}>{fmtBufferMonths(liq)} months</span> cover ·{' '}
                    {formatGBP(Math.round(liq.totalCash))} accessible
                  </p>
                </div>
                <div className="liq-compare__side liq-compare__side--optimised">
                  <p className="liq-compare__col-title">TARGET</p>
                  <p className="liq-compare__body">
                    <span className="liq-money liq-money--gain">{LIQUIDITY_TARGET_MONTHS} months</span> ·{' '}
                    {formatGBP(Math.round(liq.targetCash6mo))} policy buffer
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="liq-panel liq-panel--tall" id="liq-buffer-gauge" aria-labelledby="liq-buffer-heading">
          <h2 id="liq-buffer-heading" className="liq-section-label">
            Buffer status
          </h2>
          {loading ? (
            <div className="liq-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 16 }} />
            </div>
          ) : fetchFailed ? (
            <div className="liq-empty">
              <p>
                Could not load buffer status.{' '}
                <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="liq-empty">
              <p>
                Buffer thresholds appear once balances load. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="liq-scenario-row">
                <div className="liq-scenario-cell liq-scenario-cell--min">
                  <p className="liq-scenario__mo">{LIQUIDITY_MIN_MONTHS}mo</p>
                  <p className="liq-scenario__lbl">Minimum · {formatGBP(Math.round(liq.minCash3mo))}</p>
                </div>
                <div className="liq-scenario-cell liq-scenario-cell--target">
                  <p className="liq-scenario__mo">{LIQUIDITY_TARGET_MONTHS}mo</p>
                  <p className="liq-scenario__lbl">Target · {formatGBP(Math.round(liq.targetCash6mo))}</p>
                </div>
                <div className={`liq-scenario-cell liq-scenario-cell--current liq-scenario-cell--${gaugeTone}`}>
                  <p className="liq-scenario__mo">{fmtBufferMonths(liq)}mo</p>
                  <p className="liq-scenario__lbl">Current · {formatGBP(Math.round(liq.totalCash))}</p>
                </div>
              </div>
              <div className="liq-buffer-target-bar" aria-label="Progress toward six-month buffer">
                <div
                  className={`liq-buffer-target-bar__fill liq-buffer-target-bar__fill--${gaugeTone}`}
                  style={{ width: `${barFillPct}%` }}
                />
                <div className="liq-buffer-target-bar__marker" style={{ left: '50%' }} aria-hidden />
              </div>
              <div className="liq-buffer-target-meta">
                <span>3-month minimum marker</span>
                <span>{LIQUIDITY_TARGET_MONTHS}-month target (100%)</span>
              </div>
              <p className="liq-insight">
                {liq.monthlyBurn <= 0
                  ? 'No recent outflows in your import window — buffer months read as unlimited until burn restarts.'
                  : `You are at ${fmtBufferMonths(liq)} months versus the ${LIQUIDITY_TARGET_MONTHS}-month operating target.`}
              </p>
            </>
          )}
        </section>

        <section className="liq-panel" aria-labelledby="liq-liquid-heading">
          <h2 id="liq-liquid-heading" className="liq-section-label">
            Instantly accessible
          </h2>
          {loading ? (
            <div className="liq-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="liq-empty">
              <p>
                Could not load accounts.{' '}
                <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="liq-empty">
              <p>
                Institution balances require uploaded activity. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : liquidAccounts.length === 0 ? (
            <div className="liq-empty">
              <p>No positive balances tagged by institution yet — totals still roll into aggregate cash above.</p>
            </div>
          ) : (
            <div className="liq-opp-list">
              {liquidAccounts.map((acc) => {
                const fscs = acc.unprotectedAmt <= 0 && acc.balance > 0
                const border = fscs ? 'liq-opp-row--fscs' : 'liq-opp-row--navy'
                return (
                  <div key={acc.name} className={`liq-opp-row liq-opp-row--fluid ${border}`}>
                    <div className="liq-opp-row__content">
                      <p className="liq-opp-row__rank">{fscs ? 'FSCS protected' : 'Review protection'}</p>
                      <h3 className="liq-opp-row__title">{acc.name}</h3>
                      <p className="liq-opp-row__meta">
                        Balance {formatGBP(Math.round(acc.balance))} · Estimated yield{' '}
                        {Number.isFinite(blendedPct) ? formatPct(blendedPct, 2) : formatPct(YIELD_CURRENT_PCT, 2)} · Access:
                        Same day
                      </p>
                      <p className="liq-opp-row__best-for">
                        {fscs
                          ? 'Within £85k FSCS coverage per banking licence on this import.'
                          : `${formatGBP(Math.round(acc.unprotectedAmt))} sits above typical FSCS limits — diversify where needed.`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="liq-panel" aria-labelledby="liq-obligations-heading">
          <h2 id="liq-obligations-heading" className="liq-section-label">
            Upcoming obligations
          </h2>
          {loading ? (
            <div className="liq-skel-panel">
              {[1, 2].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="liq-empty">
              <p>
                Could not load obligations.{' '}
                <button type="button" className="liq-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="liq-empty">
              <p>
                Obligations need transaction history. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : obligationRows.length === 0 ? (
            <div className="liq-empty">
              <p>No repeating payable patterns detected in this import window.</p>
            </div>
          ) : (
            <>
              <div className="liq-opp-list">
                {obligationRows.map((row) => {
                  const border = obligationRowClass(row.nextExpected)
                  return (
                    <div key={row.payee} className={`liq-opp-row liq-opp-row--fluid ${border}`}>
                      <div className="liq-opp-row__content">
                        <p className="liq-opp-row__rank">{row.frequency}</p>
                        <h3 className="liq-opp-row__title">{row.payee}</h3>
                        <p className="liq-opp-row__meta">
                          {formatGBP(Math.round(row.amount))} · Next expected {fmtNext(row.nextExpected)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="liq-insight">{obligationsInsight}</p>
            </>
          )}
        </section>
      </div>

      <p className="liq-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
