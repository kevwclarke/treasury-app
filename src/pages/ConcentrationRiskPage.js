import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { useDaysDataUnaddressed } from '../hooks/useDaysDataUnaddressed'
import { computeConcentrationFromTransactions, FSCS_LIMIT_GBP } from '../utils/treasuryConcentration'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { TermTooltip } from '../components/TermTooltip'
import '../styles/design-system.css'
import './ConcentrationRiskPage.css'

function concentrationStatus(maxInstitutionPct) {
  if (maxInstitutionPct > 75) return { text: 'ACTION REQUIRED', tone: 'action' }
  if (maxInstitutionPct >= 50) return { text: 'REVIEW', tone: 'review' }
  return { text: 'HEALTHY', tone: 'healthy' }
}

function exposureToneClass(pct) {
  if (pct > 75) return 'conc-market-row__fill--red'
  if (pct >= 50) return 'conc-market-row__fill--amber'
  return 'conc-market-row__fill--navy'
}

function rowToneClass(pct) {
  if (pct > 75) return 'conc-opp-row--risk-high'
  if (pct >= 50) return 'conc-opp-row--risk-mid'
  return 'conc-opp-row--risk-low'
}

function ShieldIcon() {
  return (
    <svg className="conc-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function ConcentrationRiskPage() {
  const { rows, loading, error } = useUserTransactions()
  const { days: daysUnaddressed, loading: daysUnaddressedLoading } = useDaysDataUnaddressed()

  const concentration = useMemo(() => computeConcentrationFromTransactions(rows), [rows])

  const {
    totalCash,
    institutionRows,
    maxPct,
    unprotectedTotal,
    protectedTotal,
  } = concentration

  const hasData = rows.length > 0
  const fetchFailed = Boolean(error) && !loading
  const status = concentrationStatus(maxPct)

  const positiveRows = useMemo(() => institutionRows.filter((r) => r.balance > 0.005), [institutionRows])
  const largestInstitution = positiveRows[0]
  const largestInstitutionName = largestInstitution?.name ?? '—'
  const largestInstitutionPct = largestInstitution?.pctOfTotal ?? 0

  const amountToMove = Math.max(0, unprotectedTotal)

  const scrollToFix = useCallback(() => {
    document.getElementById('conc-opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="conc-page">
      {error && !loading ? (
        <div className="conc-error" role="alert">
          <p>{error}</p>
          <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="conc-header">
        <div className="conc-header__titles">
          <h1 className="conc-title">Concentration Risk</h1>
          <p className="conc-subtitle">How your cash is distributed across banks and how much is unprotected</p>
          <div className="conc-dominant-metric" aria-label="Total unprotected cash across institutions">
            <p className="conc-dominant-metric__value">{formatGBP(Math.round(unprotectedTotal))} unprotected</p>
            <p className="conc-dominant-metric__label">Total unprotected cash across all institutions</p>
            <p className="conc-dominant-metric__support">
              <TermTooltip term="fscs" label="FSCS" /> protects only {formatGBP(FSCS_LIMIT_GBP)} per authorised institution —{' '}
              {daysUnaddressedLoading || daysUnaddressed == null ? '—' : daysUnaddressed} days since last review
            </p>
          </div>
        </div>
        {loading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="conc-badge conc-badge--review">REVIEW</span>
        ) : (
          <span className={`conc-badge conc-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      <section className="conc-nba" aria-label="Next best actions">
        {loading ? (
          <div className="conc-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="conc-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="conc-nba-empty">
            Could not load concentration actions.{' '}
            <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="conc-nba-empty">
            Upload transaction data to unlock ranked concentration actions. <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : (
          <div className="conc-nba__row">
            <article className="conc-action-card conc-action-card--primary">
              <p className="conc-action-card__recommended">RECOMMENDED</p>
              <p className="conc-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="conc-action-card__impact">{formatGBP(Math.round(amountToMove))}</p>
              <p className="conc-action-card__title">Diversify across 3 or more banks</p>
              <p className="conc-action-card__desc">
                Spreading cash across multiple institutions reduces your single-point failure risk immediately.
              </p>
              <div className="conc-action-meta">
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Who</span>
                  <span className="conc-action-meta__val">CFO</span>
                </div>
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Time to act</span>
                  <span className="conc-action-meta__val">This week</span>
                </div>
                <div className="conc-action-meta__cell conc-action-meta__cell--wide">
                  <span className="conc-action-meta__label">Annual impact</span>
                  <span className="conc-action-meta__val conc-action-meta__val--gain">
                    Risk eliminated on {formatGBP(Math.round(amountToMove))} if diversified
                  </span>
                </div>
              </div>
              <div className="conc-action-wait">
                <span className="conc-action-wait__label">Cost of waiting</span>
                <span className="conc-action-wait__val">{formatGBP(Math.round(unprotectedTotal))} at risk every day</span>
              </div>
              <div className="conc-action-card__footer">
                <a className="conc-action-card__cta-pill" href="https://www.starling.com/business" target="_blank" rel="noopener noreferrer">
                  Open new account
                </a>
              </div>
            </article>

            <article className="conc-action-card conc-action-card--secondary">
              <p className="conc-action-card__kicker">NEXT BEST ACTION 2</p>
              <p className="conc-action-card__impact">{formatGBP(Math.round(amountToMove))}</p>
              <p className="conc-action-card__title">Move surplus to FSCS-protected products</p>
              <p className="conc-action-card__desc">
                Fixed-term savings accounts at Shawbrook or similar offer FSCS protection up to £85k per institution.
              </p>
              <div className="conc-action-meta">
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Who</span>
                  <span className="conc-action-meta__val">CFO</span>
                </div>
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Time to act</span>
                  <span className="conc-action-meta__val">This week</span>
                </div>
                <div className="conc-action-meta__cell conc-action-meta__cell--wide">
                  <span className="conc-action-meta__label">Annual impact</span>
                  <span className="conc-action-meta__val conc-action-meta__val--gain">Full FSCS protection on moved amount</span>
                </div>
              </div>
              <div className="conc-action-wait">
                <span className="conc-action-wait__label">Cost of waiting</span>
                <span className="conc-action-wait__val">Unprotected exposure continues daily</span>
              </div>
              <div className="conc-action-card__footer">
                <Link className="conc-action-card__cta-pill" to="/app/opportunities">
                  View options
                </Link>
              </div>
            </article>

            <article className="conc-action-card conc-action-card--secondary conc-action-card--tertiary">
              <p className="conc-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="conc-action-card__impact-qual">
                <ShieldIcon />
                <span>Ongoing protection</span>
              </p>
              <p className="conc-action-card__title">Configure concentration alerts</p>
              <p className="conc-action-card__desc">
                Set a threshold so Treasury Autopilot alerts you the moment any single institution exceeds your policy.
              </p>
              <div className="conc-action-meta">
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Who</span>
                  <span className="conc-action-meta__val">CFO</span>
                </div>
                <div className="conc-action-meta__cell">
                  <span className="conc-action-meta__label">Time to act</span>
                  <span className="conc-action-meta__val">2 minutes</span>
                </div>
                <div className="conc-action-meta__cell conc-action-meta__cell--wide">
                  <span className="conc-action-meta__label">Annual impact</span>
                  <span className="conc-action-meta__val conc-action-meta__val--gain">Ongoing protection</span>
                </div>
              </div>
              <div className="conc-action-wait">
                <span className="conc-action-wait__label">Cost of waiting</span>
                <span className="conc-action-wait__val conc-action-wait__val--neutral">Zero — act now</span>
              </div>
              <div className="conc-action-card__footer">
                <Link className="conc-action-card__cta-pill" to="/app/preferences">
                  Configure
                </Link>
              </div>
            </article>
          </div>
        )}
      </section>

      {!loading && !fetchFailed && hasData && unprotectedTotal > FSCS_LIMIT_GBP ? (
        <section className="conc-inaction" aria-label="Cost of inaction">
          <div className="conc-inaction__left">
            <span className="conc-inaction__dot" aria-hidden />
            <p className="conc-inaction__text">
              {formatGBP(Math.round(unprotectedTotal))} is completely unprotected. A bank failure could result in total
              loss of this amount.
            </p>
          </div>
          <button type="button" className="conc-inaction__link" onClick={scrollToFix}>
            See how to fix this ↓
          </button>
        </section>
      ) : null}

      <div className="conc-grid">
        <section className="conc-panel conc-panel--tall" aria-labelledby="conc-position-heading">
          <h2 id="conc-position-heading" className="conc-section-label">
            Your position
          </h2>
          {loading ? (
            <div className="conc-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 12 }} />
              <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 12 }} />
            </div>
          ) : fetchFailed ? (
            <div className="conc-empty">
              <p>
                Could not load your position.{' '}
                <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="conc-empty">
              <p>
                No cash position yet. <Link to="/upload">Upload a bank statement</Link> to see concentration risk.
              </p>
            </div>
          ) : (
            <>
              <p className="conc-cash-hero">{formatGBP(Math.round(unprotectedTotal))}</p>
              <div className="conc-position-loss">
                <p className="conc-position-loss__label">UNPROTECTED CASH</p>
              </div>
              <div className="conc-stat-rows">
                <div className="conc-stat-row">
                  <span className="conc-stat-row__label">Total cash</span>
                  <span className="conc-stat-row__val">{formatGBP(Math.round(totalCash))}</span>
                </div>
                <div className="conc-stat-row">
                  <span className="conc-stat-row__label">Largest institution</span>
                  <span className="conc-stat-row__val">
                    {largestInstitutionName} at {formatPct(largestInstitutionPct, 1)}
                  </span>
                </div>
                <div className="conc-stat-row">
                  <span className="conc-stat-row__label">FSCS protected</span>
                  <span className="conc-stat-row__val">{formatGBP(FSCS_LIMIT_GBP)}</span>
                </div>
                <div className="conc-stat-row">
                  <span className="conc-stat-row__label">Unprotected</span>
                  <span className="conc-stat-row__val conc-stat-row__val--red">{formatGBP(Math.round(unprotectedTotal))}</span>
                </div>
              </div>
              <div className="conc-compare">
                <div className="conc-compare__side conc-compare__side--current">
                  <p className="conc-compare__col-title">CURRENT</p>
                  <p className="conc-compare__body">
                    <span className="conc-rate conc-rate--current">{formatPct(maxPct, 1)}</span> in one institution ·{' '}
                    <span className="conc-money conc-money--loss">{formatGBP(Math.round(unprotectedTotal))}</span>{' '}
                    unprotected
                  </p>
                </div>
                <div className="conc-compare__side conc-compare__side--optimised">
                  <p className="conc-compare__col-title">IMPROVED</p>
                  <p className="conc-compare__body">
                    <span className="conc-rate conc-rate--best">Below 50%</span> per institution ·{' '}
                    <span className="conc-money conc-money--gain">{formatGBP(0)}</span> unprotected
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="conc-panel conc-panel--tall" aria-labelledby="conc-spread-heading">
          <h2 id="conc-spread-heading" className="conc-section-label">
            How your cash is spread
          </h2>
          {loading ? (
            <div className="conc-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 16 }} />
            </div>
          ) : fetchFailed ? (
            <div className="conc-empty">
              <p>
                Could not load institution breakdown.{' '}
                <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="conc-empty">
              <p>
                Breakdown appears once we know your cash balance. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <div className="conc-compare-stack">
              <div className="conc-compare-block" style={{ overflow: 'visible', boxSizing: 'border-box', paddingRight: '14px' }}>
                <div className="conc-market-rows" aria-label="Institution concentration bars">
                  {positiveRows.map((row) => (
                    <div
                      key={row.name}
                      className="conc-market-row"
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
                        <span className="conc-market-row__label">{row.name}</span>
                        <div className="conc-market-row__track">
                          <div
                            className={`conc-market-row__fill ${exposureToneClass(row.pctOfTotal)}`}
                            style={{ width: `${Math.max(2, row.pctOfTotal)}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className="conc-market-row__rate"
                        style={{ flexShrink: 0, width: '88px', textAlign: 'right', whiteSpace: 'nowrap' }}
                      >
                        {formatGBP(Math.round(row.balance))}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="conc-market-row__below">
                  Your largest exposure is {largestInstitutionName} at {formatPct(largestInstitutionPct, 1)} of total
                  cash
                </p>
                <p className="conc-fscs-context">
                  FSCS covers {formatGBP(FSCS_LIMIT_GBP)} · Protected (capped): {formatGBP(Math.round(protectedTotal))} · Your unprotected amount: {formatGBP(Math.round(unprotectedTotal))}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="conc-panel" id="conc-opportunities" aria-labelledby="conc-accounts-heading">
          <h2 id="conc-accounts-heading" className="conc-section-label">
            All accounts
          </h2>
          {loading ? (
            <div className="conc-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="conc-empty">
              <p>
                Could not load accounts.{' '}
                <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="conc-empty">
              <p>
                Accounts need your latest balances. <Link to="/upload">Upload a bank statement</Link>
              </p>
            </div>
          ) : (
            <div className="conc-opp-list">
              {positiveRows.map((row) => (
                <div key={row.name} className={`conc-opp-row ${rowToneClass(row.pctOfTotal)}`}>
                  <div className="conc-opp-row__content">
                    <h3 className="conc-opp-row__title">{row.name}</h3>
                    <p className="conc-opp-row__meta">Account ending: ••••</p>
                    <p className="conc-opp-row__best-for">Current rate: —</p>
                    <p className="conc-opp-row__rationale">
                      FSCS status: {row.unprotectedAmt > 0 ? 'Above £85,000 limit' : 'Within FSCS limit'}
                    </p>
                    <p className="conc-opp-row__gain">{formatGBP(Math.round(row.balance))}</p>
                  </div>
                  <div className="conc-opp-row__actions">
                    <Link className="conc-opp-cta" to="/app/profile">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="conc-panel" aria-labelledby="conc-risk-context-heading">
          <h2 id="conc-risk-context-heading" className="conc-section-label">
            Risk context
          </h2>
          {loading ? (
            <div className="conc-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="conc-empty">
              <p>
                Could not load risk context.{' '}
                <button type="button" className="conc-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="conc-empty">
              <p>
                Risk context is most useful alongside your cash position. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="conc-risk-blocks">
                <div className="conc-risk-block">
                  <p className="conc-risk-block__value">$175B</p>
                  <p className="conc-risk-block__text">
                    SVB collapsed with $175B in deposits in March 2023 — Post-SVB, concentration risk is a board-level
                    concern
                  </p>
                </div>
                <div className="conc-risk-block">
                  <p className="conc-risk-block__value">£20B+</p>
                  <p className="conc-risk-block__text">FSCS paid out £20B+ in claims since 2001</p>
                </div>
                <div className="conc-risk-block">
                  <p className="conc-risk-block__value">25%</p>
                  <p className="conc-risk-block__text">Recommended: no more than 25% in any single institution</p>
                </div>
              </div>
              <div className="conc-compare-chip">Diversifying across 4 banks reduces single-institution risk by 75%</div>
            </>
          )}
        </section>
      </div>

      <p className="conc-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
