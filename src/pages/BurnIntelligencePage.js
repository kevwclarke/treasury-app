import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { computeBurn30Vs90Pct } from '../utils/treasuryKpi'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { BURN_CATEGORY_ORDER, burnCategoryMomTrend, categorisePayee } from '../utils/treasuryBurn'
import { formatCompactAxisGBP, formatGBP, formatPct } from '../utils/treasuryFormat'
import '../styles/design-system.css'
import './BurnIntelligencePage.css'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function monthKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function lastNDaysRows(rows, days, nowMs = Date.now()) {
  const since = nowMs - days * 86400000
  return rows.filter((r) => {
    const t = new Date(r.date).getTime()
    return Number.isFinite(t) && t >= since
  })
}

function splitLast30VsPrior30(rows, nowMs = Date.now()) {
  const start30 = nowMs - 30 * 86400000
  const start60 = nowMs - 60 * 86400000
  const last = []
  const prior = []
  rows.forEach((r) => {
    const t = new Date(r.date).getTime()
    if (!Number.isFinite(t)) return
    if (t >= start30) last.push(r)
    else if (t >= start60) prior.push(r)
  })
  return { last, prior }
}

function burnByCategory(rows) {
  const byCat = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
  let total = 0
  rows.forEach((r) => {
    const a = Number(r.amount)
    if (!Number.isFinite(a) || a >= 0) return
    const spend = Math.abs(a)
    const cat = categorisePayee(r.payee)
    byCat[cat] = (byCat[cat] || 0) + spend
    total += spend
  })
  return { total, byCat }
}

/** Signed display for 30d vs 90d burn delta; avoids broken extremes when data is sparse. */
function formatBurnDeltaPctSigned(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  if (deltaPct < -99) return '-99%+'
  if (deltaPct > 999) return '999%+'
  return formatPct(deltaPct, 1)
}

/** Magnitude for “increased/decreased … over 90 days” copy. */
function formatBurnDeltaPctAbsTrend(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  if (deltaPct < -99) return '99%+'
  if (deltaPct > 999) return '999%+'
  return formatPct(Math.abs(deltaPct), 1)
}

function burnIntelStatus(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return { text: 'REVIEW', tone: 'review' }
  if (deltaPct < 5) return { text: 'HEALTHY', tone: 'healthy' }
  if (deltaPct <= 12) return { text: 'REVIEW', tone: 'review' }
  return { text: 'ACTION REQUIRED', tone: 'action' }
}

function categoryFillClass(name) {
  const map = {
    Payroll: 'burn-market-row__fill--payroll',
    Infrastructure: 'burn-market-row__fill--infra',
    Contractors: 'burn-market-row__fill--contractors',
    Travel: 'burn-market-row__fill--travel',
    'Office & Ops': 'burn-market-row__fill--office',
    Marketing: 'burn-market-row__fill--marketing',
    Capital: 'burn-market-row__fill--other',
    Legal: 'burn-market-row__fill--other',
    'Professional Services': 'burn-market-row__fill--office',
    Culture: 'burn-market-row__fill--marketing',
    People: 'burn-market-row__fill--contractors',
    Other: 'burn-market-row__fill--other',
  }
  return map[name] || 'burn-market-row__fill--other'
}

function ShieldIcon() {
  return (
    <svg className="burn-shield" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

export function BurnIntelligencePage() {
  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()

  const burnKpi = useMemo(() => computeBurn30Vs90Pct(txnRows), [txnRows])
  const runwayCore = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])

  const rows90 = useMemo(() => lastNDaysRows(txnRows, 90), [txnRows])
  const { last: last30, prior: prior30 } = useMemo(() => splitLast30VsPrior30(txnRows), [txnRows])

  const burn90 = useMemo(() => burnByCategory(rows90), [rows90])
  const burnLast30 = useMemo(() => burnByCategory(last30), [last30])
  const burnPrior30 = useMemo(() => burnByCategory(prior30), [prior30])

  const monthlyBurn90 = burnKpi?.monthlyBurn90 ?? 0
  const monthlyImplied30 = burnKpi?.monthlyImplied30 ?? 0
  const deltaPct = burnKpi?.deltaPct

  const hasData = txnRows.length > 0
  const fetchFailed = Boolean(txnError) && !txnLoading
  const status = burnIntelStatus(deltaPct)

  const topCategoryEntry = useMemo(() => {
    let best = null
    let maxAmt = 0
    BURN_CATEGORY_ORDER.forEach((c) => {
      const v = burn90.byCat[c] || 0
      if (v > maxAmt) {
        maxAmt = v
        best = c
      }
    })
    return { name: best, total: maxAmt }
  }, [burn90.byCat])

  const topCategory = topCategoryEntry.name ?? '—'

  const topCatGrowthPct = useMemo(() => {
    if (!topCategoryEntry.name) return null
    const c = topCategoryEntry.name
    const last = burnLast30.byCat[c] || 0
    const prior = burnPrior30.byCat[c] || 0
    if (prior <= 0) return last > 0 ? 100 : 0
    return ((last - prior) / prior) * 100
  }, [burnLast30.byCat, burnPrior30.byCat, topCategoryEntry.name])

  const fastestGrowing = useMemo(() => {
    let bestCat = null
    let bestPct = -Infinity
    BURN_CATEGORY_ORDER.forEach((c) => {
      const last = burnLast30.byCat[c] || 0
      const prior = burnPrior30.byCat[c] || 0
      let pct = 0
      if (prior > 0) pct = ((last - prior) / prior) * 100
      else if (last > 0) pct = 100
      if (pct > bestPct) {
        bestPct = pct
        bestCat = c
      }
    })
    if (bestCat == null || !Number.isFinite(bestPct)) return { cat: null, pct: null }
    return { cat: bestCat, pct: bestPct }
  }, [burnLast30.byCat, burnPrior30.byCat])

  const categoryBars = useMemo(() => {
    const rowsOut = BURN_CATEGORY_ORDER.map((name) => ({
      name,
      amt: burn90.byCat[name] || 0,
      pct: burn90.total > 0 ? ((burn90.byCat[name] || 0) / burn90.total) * 100 : 0,
    }))
      .filter((r) => r.amt > 0)
      .sort((a, b) => b.amt - a.amt)
    return rowsOut
  }, [burn90.byCat, burn90.total])

  const monthlyAvgTopCat = topCategoryEntry.name ? (burn90.byCat[topCategoryEntry.name] || 0) / 3 : 0
  const saving10TopMo = monthlyAvgTopCat * 0.1
  const saving10TopAnnual = saving10TopMo * 12
  const monthlyOvershoot = Math.max(0, monthlyImplied30 - monthlyBurn90)

  const runwayReductionSixMo = useMemo(() => {
    if (monthlyBurn90 <= 0) return null
    const overshoot = Math.max(0, monthlyImplied30 - monthlyBurn90)
    return (6 * overshoot) / monthlyBurn90
  }, [monthlyBurn90, monthlyImplied30])

  const chartSeries = useMemo(() => {
    const now = new Date()
    const keys = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      keys.push({
        key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
      })
    }
    const totals = Object.fromEntries(keys.map((k) => [k.key, 0]))
    txnRows.forEach((r) => {
      const k = monthKey(r.date)
      if (!k || totals[k] === undefined) return
      const a = Number(r.amount)
      if (!Number.isFinite(a) || a >= 0) return
      totals[k] += Math.abs(a)
    })
    return keys.map(({ key, label }) => ({ month: label, burn: totals[key] || 0 }))
  }, [txnRows])

  const recentTransactions = useMemo(() => {
    const debits = txnRows
      .filter((r) => Number(r.amount) < 0)
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.date).getTime()
        const tb = new Date(b.date).getTime()
        const dt = (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
        if (dt !== 0) return dt
        const pa = String(a.payee ?? '').trim() || '—'
        const pb = String(b.payee ?? '').trim() || '—'
        return pa.localeCompare(pb)
      })

    function payeeDateKey(t) {
      const payee = String(t.payee ?? '').trim() || '—'
      const dateStr = String(t.date ?? '').slice(0, 10)
      return `${payee}\0${dateStr}`
    }

    const countsByKey = new Map()
    for (const t of debits) {
      const k = payeeDateKey(t)
      countsByKey.set(k, (countsByKey.get(k) ?? 0) + 1)
    }

    const shownByKey = new Map()
    const items = []
    let txnRowsShown = 0
    const maxTxnRows = 15

    for (const t of debits) {
      if (txnRowsShown >= maxTxnRows) break
      const k = payeeDateKey(t)
      const shown = shownByKey.get(k) ?? 0
      const totalForKey = countsByKey.get(k) ?? 0
      if (shown >= 2) continue

      items.push({ kind: 'txn', t })
      txnRowsShown += 1
      shownByKey.set(k, shown + 1)
      if (shown + 1 === 2 && totalForKey > 2) {
        const payee = String(t.payee ?? '').trim() || '—'
        const dateStr = String(t.date ?? '').slice(0, 10)
        items.push({ kind: 'more', payee, dateStr, n: totalForKey - 2 })
      }
    }

    return items
  }, [txnRows])

  const scrollToBreakdown = useCallback(() => {
    document.getElementById('burn-category-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const deltaSentence =
    deltaPct != null && Number.isFinite(deltaPct)
      ? `${formatBurnDeltaPctSigned(deltaPct)} vs prior period`
      : '— vs prior period'

  const trendInsight =
    deltaPct != null && Number.isFinite(deltaPct)
      ? `Burn has ${deltaPct >= 0 ? 'increased' : 'decreased'} ${formatBurnDeltaPctAbsTrend(deltaPct)} over 90 days`
      : 'Insufficient recent outflows to measure 90-day burn momentum.'

  const reducedBurn = monthlyBurn90 * 0.9
  const spend90Total = burn90.total

  const top3NonPayrollVendor = useMemo(() => {
    const entries = BURN_CATEGORY_ORDER.filter((c) => c !== 'Payroll')
      .map((c) => ({ c, v: burn90.byCat[c] || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
    const top3 = entries.slice(0, 3)
    const sum90 = top3.reduce((s, x) => s + x.v, 0)
    const perMo = sum90 / 3
    const saving15 = perMo * 0.15
    return { top3, sum90, perMo, saving15 }
  }, [burn90.byCat])

  return (
    <div className="burn-page">
      {txnError && !txnLoading ? (
        <div className="burn-error" role="alert">
          <p>{txnError}</p>
          <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <header className="burn-header">
        <div className="burn-header__titles">
          <h1 className="burn-title">Burn Intelligence</h1>
          <p className="burn-subtitle">Where your money is going and what is driving cost increases</p>
          <div className="burn-dominant-metric" aria-label="Average monthly burn">
            {txnLoading ? (
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '55%', display: 'block' }} />
            ) : (
              <>
                <p className="burn-dominant-metric__value">{formatGBP(Math.round(monthlyBurn90))} / month</p>
                <p className="burn-dominant-metric__label">Average monthly burn — last 90 days</p>
                <p className="burn-dominant-metric__support">
                  {deltaSentence} · {topCategory} is your largest cost driver
                </p>
              </>
            )}
          </div>
        </div>
        {txnLoading ? (
          <span className="ds-skeleton ds-skeleton--line" style={{ width: 120, height: 28, borderRadius: 999 }} />
        ) : fetchFailed ? (
          <span className="burn-badge burn-badge--review">REVIEW</span>
        ) : (
          <span className={`burn-badge burn-badge--${status.tone}`}>{status.text}</span>
        )}
      </header>

      <section className="burn-nba" aria-label="Next best actions">
        {txnLoading ? (
          <div className="burn-nba__row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="burn-skel-card">
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '55%', marginBottom: 12 }} />
                <span className="ds-skeleton ds-skeleton--line" style={{ width: '85%', height: 18, marginBottom: 10 }} />
                <span className="ds-skeleton ds-skeleton--line" />
                <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 16 }} />
              </div>
            ))}
          </div>
        ) : fetchFailed ? (
          <div className="burn-nba-empty">
            Could not load burn actions.{' '}
            <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="burn-nba-empty">
            Upload transaction data to unlock burn intelligence. <Link to="/upload">Upload bank statement</Link>
          </div>
        ) : monthlyBurn90 <= 0 ? (
          <div className="burn-nba-empty">
            No outflows found in your import — add debits or check column mapping.
          </div>
        ) : (
          <div className="burn-nba__row" style={{ alignItems: 'stretch' }}>
            <article
              className="burn-action-card burn-action-card--primary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="burn-action-card__recommended">RECOMMENDED</p>
              <p className="burn-action-card__kicker">NEXT BEST ACTION 1</p>
              <p className="burn-action-card__impact">{formatGBP(Math.round(saving10TopAnnual))}</p>
              <p className="burn-action-card__title">Review {topCategory} spend</p>
              <p className="burn-action-card__desc">
                Your largest burn category has grown{' '}
                {topCatGrowthPct != null ? formatPct(topCatGrowthPct, 1) : '—'} this period. A 10% reduction saves{' '}
                {formatGBP(Math.round(saving10TopMo))} per month.
              </p>
              <div className="burn-action-meta">
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Who</span>
                  <span className="burn-action-meta__val">CFO</span>
                </div>
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Time to act</span>
                  <span className="burn-action-meta__val">This week</span>
                </div>
                <div className="burn-action-meta__cell burn-action-meta__cell--wide">
                  <span className="burn-action-meta__label">Annual impact</span>
                  <span className="burn-action-meta__val burn-action-meta__val--gain">
                    {formatGBP(Math.round(saving10TopAnnual))}
                  </span>
                </div>
              </div>
              <div className="burn-action-wait">
                <span className="burn-action-wait__label">Cost of waiting</span>
                <span className="burn-action-wait__val">{formatGBP(Math.round(monthlyOvershoot))} per month</span>
              </div>
              <div className="burn-action-card__footer" style={{ marginTop: 'auto' }}>
                <button type="button" className="burn-action-card__cta-pill" onClick={scrollToBreakdown}>
                  View breakdown
                </button>
              </div>
            </article>

            <article
              className="burn-action-card burn-action-card--secondary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="burn-action-card__kicker">NEXT BEST ACTION 2</p>
              <p className="burn-action-card__impact">
                {runwayCore.baseRunwayMo != null ? `${runwayCore.baseRunwayMo.toFixed(1)} mo` : '—'}
              </p>
              <p className="burn-action-card__title">Model burn reduction impact</p>
              <p className="burn-action-card__desc">
                Use the scenario modeller to see exactly how reducing burn by 10-20% extends your runway.
              </p>
              <div className="burn-action-meta">
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Who</span>
                  <span className="burn-action-meta__val">CFO</span>
                </div>
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Time to act</span>
                  <span className="burn-action-meta__val">5 minutes</span>
                </div>
                <div className="burn-action-meta__cell burn-action-meta__cell--wide">
                  <span className="burn-action-meta__label">Annual impact</span>
                  <span className="burn-action-meta__val burn-action-meta__val--gain">
                    Extended runway modelled live
                  </span>
                </div>
              </div>
              <div className="burn-action-wait">
                <span className="burn-action-wait__label">Cost of waiting</span>
                <span className="burn-action-wait__val">Runway shortening daily</span>
              </div>
              <div className="burn-action-card__footer" style={{ marginTop: 'auto' }}>
                <Link className="burn-action-card__cta-pill" to="/app/scenarios">
                  Open modeller
                </Link>
              </div>
            </article>

            <article
              className="burn-action-card burn-action-card--secondary burn-action-card--tertiary"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <p className="burn-action-card__kicker">NEXT BEST ACTION 3</p>
              <p className="burn-action-card__impact-qual">
                <ShieldIcon />
                <span>Vendor leverage</span>
              </p>
              <p className="burn-action-card__title">Renegotiate your largest vendor contracts</p>
              <p className="burn-action-card__desc">
                Your top 3 non-payroll categories total {formatGBP(Math.round(top3NonPayrollVendor.perMo))}/month. A 15%
                reduction across these saves {formatGBP(Math.round(top3NonPayrollVendor.saving15))}/month — achievable
                through annual commitment or volume negotiation.
              </p>
              <div className="burn-action-meta">
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Who</span>
                  <span className="burn-action-meta__val">CFO</span>
                </div>
                <div className="burn-action-meta__cell">
                  <span className="burn-action-meta__label">Time to act</span>
                  <span className="burn-action-meta__val">This quarter</span>
                </div>
                <div className="burn-action-meta__cell burn-action-meta__cell--wide">
                  <span className="burn-action-meta__label">Annual impact</span>
                  <span className="burn-action-meta__val burn-action-meta__val--gain">
                    {formatGBP(Math.round(top3NonPayrollVendor.saving15 * 12))}/yr in vendor savings
                  </span>
                </div>
              </div>
              <div className="burn-action-wait">
                <span className="burn-action-wait__label">Cost of waiting</span>
                <span className="burn-action-wait__val" style={{ color: '#DC2626' }}>
                  Contracts auto-renew at current rates
                </span>
              </div>
              <div className="burn-action-card__footer" style={{ marginTop: 'auto' }}>
                <button type="button" className="burn-action-card__cta-pill" onClick={scrollToBreakdown}>
                  View full breakdown →
                </button>
              </div>
            </article>
          </div>
        )}
      </section>

      {!txnLoading && !fetchFailed && hasData && deltaPct != null && deltaPct > 10 ? (
        <section className="burn-inaction" aria-label="Cost of inaction">
          <div className="burn-inaction__left">
            <span className="burn-inaction__dot" aria-hidden />
            <p className="burn-inaction__text">
              Burn rate has increased {formatBurnDeltaPctSigned(deltaPct)} in the last 30 days. At this trajectory, runway reduces by{' '}
              {runwayReductionSixMo != null ? runwayReductionSixMo.toFixed(1) : '—'} months over the next 6 months.
            </p>
          </div>
          <button type="button" className="burn-inaction__link" onClick={scrollToBreakdown}>
            View breakdown ↓
          </button>
        </section>
      ) : null}

      <div className="burn-grid">
        <section className="burn-panel burn-panel--tall" aria-labelledby="burn-position-heading">
          <h2 id="burn-position-heading" className="burn-section-label">
            Your position
          </h2>
          {txnLoading ? (
            <div className="burn-skel-panel">
              <span className="ds-skeleton ds-skeleton--value-lg" style={{ width: '70%', display: 'block' }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 20 }} />
              <span className="ds-skeleton ds-skeleton--line" style={{ marginTop: 12 }} />
            </div>
          ) : fetchFailed ? (
            <div className="burn-empty">
              <p>
                Could not load your position.{' '}
                <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="burn-empty">
              <p>
                No transactions yet. <Link to="/upload">Upload a bank statement</Link> to see burn intelligence.
              </p>
            </div>
          ) : monthlyBurn90 <= 0 ? (
            <div className="burn-empty">
              <p>No outflows found in your import — add debits or check column mapping.</p>
            </div>
          ) : (
            <>
              <p className="burn-cash-hero">{formatGBP(Math.round(monthlyBurn90))}</p>
              <div className="burn-position-loss">
                <p className="burn-position-loss__label">MONTHLY BURN</p>
              </div>
              <div className="burn-stat-rows">
                <div className="burn-stat-row">
                  <span className="burn-stat-row__label">Total 90-day spend</span>
                  <span className="burn-stat-row__val">{formatGBP(Math.round(spend90Total))}</span>
                </div>
                <div className="burn-stat-row">
                  <span className="burn-stat-row__label">Monthly average</span>
                  <span className="burn-stat-row__val">{formatGBP(Math.round(monthlyBurn90))}</span>
                </div>
                <div className="burn-stat-row">
                  <span className="burn-stat-row__label">30-day vs 90-day delta</span>
                  <span className="burn-stat-row__val burn-stat-row__val--opp">
                    {deltaPct != null ? formatBurnDeltaPctSigned(deltaPct) : '—'}
                  </span>
                </div>
                <div className="burn-stat-row">
                  <span className="burn-stat-row__label">Top category</span>
                  <span className="burn-stat-row__val">{topCategory}</span>
                </div>
              </div>
              <div className="burn-compare">
                <div className="burn-compare__side burn-compare__side--current">
                  <p className="burn-compare__col-title">CURRENT</p>
                  <p className="burn-compare__body">
                    <span className="burn-rate burn-rate--current">{formatGBP(Math.round(monthlyBurn90))}</span> / mo
                    burn
                  </p>
                </div>
                <div className="burn-compare__side burn-compare__side--optimised">
                  <p className="burn-compare__col-title">REDUCED</p>
                  <p className="burn-compare__body">
                    <span className="burn-rate burn-rate--best">{formatGBP(Math.round(reducedBurn))}</span> / mo at 10%
                    reduction
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="burn-panel burn-panel--tall" id="burn-category-breakdown" aria-labelledby="burn-cats-heading">
          <h2 id="burn-cats-heading" className="burn-section-label">
            Where the money goes
          </h2>
          {txnLoading ? (
            <div className="burn-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 120, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="burn-empty">
              <p>
                Could not load categories.{' '}
                <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData || monthlyBurn90 <= 0 ? (
            <div className="burn-empty">
              <p>Category breakdown appears once we detect spend.</p>
            </div>
          ) : (
            <div
              className="burn-compare-block"
              style={{ overflow: 'visible', boxSizing: 'border-box', paddingRight: '14px' }}
            >
              <div className="burn-market-rows" aria-label="Spend by category">
                {categoryBars.map((row) => {
                  const mom = burnCategoryMomTrend(txnRows, row.name)
                  return (
                  <div
                    key={row.name}
                    className="burn-market-row"
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
                      <span className="burn-market-row__label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {row.name}
                        <span
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 12,
                            fontWeight: 500,
                            color: mom.color,
                          }}
                        >
                          {mom.text}
                        </span>
                      </span>
                      <div className="burn-market-row__track">
                        <div
                          className={`burn-market-row__fill ${categoryFillClass(row.name)}`}
                          style={{ width: `${Math.max(2, row.pct)}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className="burn-market-row__rate"
                      style={{ flexShrink: 0, width: '88px', textAlign: 'right', whiteSpace: 'nowrap' }}
                    >
                      {formatGBP(Math.round(row.amt))}
                    </span>
                  </div>
                  )
                })}
              </div>
              <p className="burn-market-row__below">
                {fastestGrowing.cat != null && fastestGrowing.pct != null ? (
                  <>
                    Your fastest growing category is {fastestGrowing.cat} up {formatPct(fastestGrowing.pct, 1)} this
                    period
                  </>
                ) : (
                  'Category growth rates appear once there are two comparable 30-day windows.'
                )}
              </p>
            </div>
          )}
        </section>

        <section className="burn-panel" aria-labelledby="burn-feed-heading">
          <h2 id="burn-feed-heading" className="burn-section-label">
            Recent transactions
          </h2>
          {txnLoading ? (
            <div className="burn-skel-panel">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ds-skeleton ds-skeleton--line"
                  style={{ width: '100%', height: 72, borderRadius: 10, marginBottom: 10, display: 'block' }}
                />
              ))}
            </div>
          ) : fetchFailed ? (
            <div className="burn-empty">
              <p>
                Could not load transactions.{' '}
                <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="burn-empty">
              <p>
                Recent debits appear here. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="burn-empty">
              <p>No debit transactions in your import.</p>
            </div>
          ) : (
            <>
              <div className="burn-opp-list">
                {recentTransactions.map((item, idx) =>
                  item.kind === 'txn' ? (
                    <div
                      key={`txn-${String(item.t.date)}-${String(item.t.payee)}-${item.t.amount}-${idx}`}
                      className="burn-opp-row"
                    >
                      <div className="burn-opp-row__content">
                        <h3 className="burn-opp-row__title">{String(item.t.payee || '—')}</h3>
                        <p className="burn-opp-row__meta">
                          {String(item.t.date).slice(0, 10)} · {categorisePayee(item.t.payee)}
                        </p>
                        <p className="burn-feed__amount">{formatGBP(Math.round(Math.abs(Number(item.t.amount))))}</p>
                      </div>
                    </div>
                  ) : (
                    <p
                      key={`more-${item.payee}-${item.dateStr}-${idx}`}
                      style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 11,
                        fontWeight: 400,
                        color: '#9ca3af',
                        margin: '4px 0 10px',
                        paddingLeft: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      + {item.n} more from {item.payee} on this date
                    </p>
                  ),
                )}
              </div>
              <button type="button" className="burn-feed__link" onClick={scrollToBreakdown}>
                View all
              </button>
            </>
          )}
        </section>

        <section className="burn-panel" aria-labelledby="burn-trend-heading">
          <h2 id="burn-trend-heading" className="burn-section-label">
            Burn trend
          </h2>
          {txnLoading ? (
            <div className="burn-skel-panel">
              <span className="ds-skeleton ds-skeleton--line" style={{ width: '100%', height: 200, borderRadius: 8 }} />
            </div>
          ) : fetchFailed ? (
            <div className="burn-empty">
              <p>
                Could not load trend.{' '}
                <button type="button" className="burn-error__retry" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </p>
            </div>
          ) : !hasData ? (
            <div className="burn-empty">
              <p>
                Trend charts need outflows. <Link to="/upload">Upload data</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="burn-chart-h">
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
                    {monthlyBurn90 > 0 ? (
                      <ReferenceLine
                        y={monthlyBurn90}
                        stroke="#9ca3af"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    ) : null}
                    <Line type="monotone" dataKey="burn" stroke="#1b2f8c" strokeWidth={2} dot={{ r: 3, fill: '#1b2f8c' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="burn-insight">{trendInsight}</p>
              <p className="burn-monthly-cost">
                Current: {formatGBP(Math.round(monthlyBurn90))} per month
              </p>
            </>
          )}
        </section>
      </div>

      <p className="burn-trust-signal">
        Read-only analysis · No funds are moved without your approval · Data sourced from your connected accounts.
      </p>
    </div>
  )
}
