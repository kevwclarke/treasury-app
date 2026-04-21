import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTreasuryAnthropicActions } from '../api/treasuryAnthropicActions'
import { formatGBP } from '../utils/treasuryFormat'
import { YIELD_BEST_PCT, YIELD_CURRENT_PCT } from '../utils/treasuryYield'
import './AiTreasuryActions.css'

function fmtComma(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-GB')
}

/** Payload for POST /api/treasury-actions (must match lib/treasuryAnthropicServer.cjs). */
function buildTreasuryActionMetrics({ yieldSummary, concentration, runwayMetrics, burnSummary }) {
  const topInstRow =
    concentration.institutionRows?.find((r) => r.balance > 0) ?? concentration.institutionRows?.[0]
  const concentrationPct =
    topInstRow && concentration.totalCash !== 0
      ? Math.min(100, Math.max(0, Math.abs(topInstRow.pctOfTotal))).toFixed(1)
      : '0.0'
  const topInstitution = topInstRow?.name && topInstRow.balance !== 0 ? topInstRow.name : 'None'
  const cats = burnSummary.categories || []
  const topCat = cats.reduce((best, c) => (c.amount > (best?.amount ?? 0) ? c : best), cats[0])

  return {
    totalCash: fmtComma(yieldSummary.totalCash),
    currentYield: YIELD_CURRENT_PCT.toFixed(2),
    bestRate: YIELD_BEST_PCT.toFixed(2),
    annualOppCost: fmtComma(yieldSummary.annualOppCost),
    concentrationPct,
    topInstitution,
    unprotectedAmount: fmtComma(concentration.unprotectedTotal),
    monthlyBurn: fmtComma(Math.round(runwayMetrics.monthlyBurn || 0)),
    runway:
      runwayMetrics.baseRunwayMo != null && Number.isFinite(runwayMetrics.baseRunwayMo)
        ? runwayMetrics.baseRunwayMo.toFixed(1)
        : '0',
    topCategory: topCat?.amount > 0 ? topCat.name : 'None',
    topCategoryPct: topCat?.amount > 0 ? topCat.pct : 0,
  }
}

function effortClass(effort) {
  if (effort === 'Low') return 'ai-actions__effort ai-actions__effort--low'
  if (effort === 'High') return 'ai-actions__effort ai-actions__effort--high'
  return 'ai-actions__effort ai-actions__effort--medium'
}

const ERR_GENERIC = 'Unable to generate actions, please try again.'

export function AiTreasuryActions({
  txnLoading,
  txnError,
  txnRows,
  runwayMetrics,
  yieldSummary,
  concentration,
  burnSummary,
}) {
  const [actions, setActions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const didAutoFetchRef = useRef(false)

  const metrics = useMemo(
    () => buildTreasuryActionMetrics({ yieldSummary, concentration, runwayMetrics, burnSummary }),
    [yieldSummary, concentration, runwayMetrics, burnSummary],
  )

  const hasTxn = (txnRows?.length ?? 0) > 0
  const canRequest = hasTxn && !txnLoading && !txnError

  const runFetch = useCallback(
    async (isManual) => {
      if (!canRequest) return
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError('')
      if (isManual) setActions(null)
      try {
        const next = await fetchTreasuryAnthropicActions({ metrics, signal: ac.signal })
        setActions(next)
      } catch (e) {
        if (e?.name === 'AbortError') return
        setActions(null)
        setError(ERR_GENERIC)
      } finally {
        setLoading(false)
      }
    },
    [canRequest, metrics],
  )

  useEffect(() => {
    if (!canRequest) {
      didAutoFetchRef.current = false
      return
    }
    if (didAutoFetchRef.current) return
    didAutoFetchRef.current = true
    runFetch(false)
  }, [canRequest, runFetch])

  const showSkeleton = canRequest && (loading || (actions === null && !error))
  const showPlaceholder = !hasTxn && !txnLoading

  return (
    <section className="ai-actions" aria-labelledby="ai-treasury-actions-heading">
      <div className="ai-actions__head">
        <div>
          <h2 id="ai-treasury-actions-heading" className="ai-actions__title">
            AI Treasury Actions
          </h2>
          <p className="ai-actions__lead">
            Ranked moves from your live balances, yield gap, concentration, runway, and burn — with estimated annual
            impact in GBP.
          </p>
        </div>
        <button
          type="button"
          className="tdash__btn tdash__btn--primary ai-actions__refresh"
          onClick={() => runFetch(true)}
          disabled={!canRequest || loading}
        >
          {loading ? 'Loading…' : 'Refresh Actions'}
        </button>
      </div>

      {txnLoading ? <p className="ai-actions__hint">Loading your financial data…</p> : null}
      {txnError ? <p className="ai-actions__error">{txnError}</p> : null}

      {showPlaceholder ? (
        <p className="ai-actions__hint">
          Upload transactions to generate AI treasury actions. <Link to="/upload">Upload statement</Link>
        </p>
      ) : null}

      {error && !loading ? <p className="ai-actions__error">{error}</p> : null}

      <div className="ai-actions__cards">
        {showSkeleton
          ? [1, 2, 3].map((i) => (
              <div
                key={i}
                className="ai-actions__card ai-actions__card--loading"
                aria-busy="true"
                aria-label="Loading action"
              >
                <span className="ai-actions__rank">Action {i}</span>
                <div
                  className="ai-actions__card-title"
                  style={{
                    height: '1.1rem',
                    width: '70%',
                    opacity: 0.35,
                    borderRadius: 4,
                    background: 'rgba(26,22,20,0.08)',
                  }}
                />
                <div style={{ marginTop: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ height: 10, width: '100%', borderRadius: 4, background: 'rgba(26,22,20,0.06)' }} />
                  <div style={{ height: 10, width: '92%', borderRadius: 4, background: 'rgba(26,22,20,0.06)' }} />
                  <div style={{ height: 10, width: '55%', borderRadius: 4, background: 'rgba(26,22,20,0.06)' }} />
                </div>
                <div className="ai-actions__foot">
                  <span style={{ height: 22, width: '5.5rem', borderRadius: 6, background: 'rgba(45,106,79,0.12)' }} />
                  <span className={effortClass('Medium')} style={{ opacity: 0.35 }} aria-hidden>
                    …
                  </span>
                </div>
              </div>
            ))
          : (actions ?? []).map((a) => (
              <article key={a.rank} className="ai-actions__card">
                <p className="ai-actions__rank">Action {a.rank}</p>
                <h3 className="ai-actions__card-title">{a.title}</h3>
                <p className="ai-actions__card-body">{a.action}</p>
                <div>
                  <span className="ai-actions__impact">{formatGBP(Math.round(a.impactGbpPerYear))}</span>
                  <span className="ai-actions__impact-cap">estimated impact / year</span>
                </div>
                <div className="ai-actions__foot">
                  <span className={effortClass(a.effort)}>{a.effort}</span>
                </div>
              </article>
            ))}
      </div>
    </section>
  )
}
