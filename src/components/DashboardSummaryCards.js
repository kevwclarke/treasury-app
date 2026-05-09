import { Link } from 'react-router-dom'
import { TermTooltip } from './TermTooltip'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { FSCS_LIMIT_GBP } from '../utils/treasuryConcentration'
import './DashboardSummaryCards.css'

/**
 * @typedef {{ label: string, tone: 'green' | 'amber' | 'red' }} StatusTone
 * @typedef {{
 *   key: string,
 *   title: string,
 *   term?: string,
 *   headline: string,
 *   status: StatusTone,
 *   context: [string, string],
 *   to: string,
 *   ctaLabel: string,
 * }} SummaryCardSpec
 */

function StatusPill({ status }) {
  return <span className={`dsum-card__status dsum-card__status--${status.tone}`}>{status.label}</span>
}

function SummaryCard({ spec }) {
  return (
    <article className={`dsum-card dsum-card--${spec.status.tone}`}>
      <div className="dsum-card__head">
        <h2 className="dsum-card__title">
          {spec.term ? <TermTooltip term={spec.term} label={spec.title} /> : spec.title}
        </h2>
        <StatusPill status={spec.status} />
      </div>
      <p className="dsum-card__metric">{spec.headline}</p>
      <ul className="dsum-card__ctx">
        <li>{spec.context[0]}</li>
        <li>{spec.context[1]}</li>
      </ul>
      <div className="dsum-card__cta">
        <Link className="dsum-card__link" to={spec.to}>
          {spec.ctaLabel}
        </Link>
      </div>
    </article>
  )
}

export function DashboardSummaryCards({
  loading,
  error,
  hasRows,
  yieldAnnualOpp,
  yieldMonthlyOpp,
  yieldTotalCash,
  concentrationMaxPct,
  concentrationUnprotected,
  runwayMo,
  monthlyBurn,
  burnDeltaPct,
  cfNetMonthly,
  cfAvgOut,
  cfLowCash,
  liquidityBufferMo,
  liquidityBand,
}) {
  if (loading) {
    return (
      <div className="dsum-grid" aria-busy="true" aria-label="Loading module summaries">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dsum-card__skeleton">
            <span className="ds-skeleton ds-skeleton--line" style={{ width: '40%', marginBottom: 12 }} />
            <span className="ds-skeleton ds-skeleton--value-lg" style={{ display: 'block', width: '70%', marginBottom: 16 }} />
            <span className="ds-skeleton ds-skeleton--line" />
            <span className="ds-skeleton ds-skeleton--line ds-skeleton--short" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="tdash__msg--error" role="alert">
        {error}
      </div>
    )
  }

  if (!hasRows) {
    const emptyCtx = [
      'Upload a bank statement to calculate live metrics.',
      'CSV import takes under a minute — balances update immediately.',
    ]
    const specs = [
      {
        key: 'yield',
        title: 'Yield Gap',
        term: 'yield-gap',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'Optimise Yield →',
      },
      {
        key: 'conc',
        title: 'Concentration Risk',
        term: 'concentration-risk',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'Reduce Exposure →',
      },
      {
        key: 'runway',
        title: 'Runway',
        term: 'runway',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'Model Scenarios →',
      },
      {
        key: 'burn',
        title: 'Burn Rate',
        term: 'burn-rate',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'Analyse Spend →',
      },
      {
        key: 'cf',
        title: 'Cash Flow',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'View Forecast →',
      },
      {
        key: 'liq',
        title: 'Liquidity Buffer',
        term: 'liquidity-buffer',
        headline: '—',
        status: { label: 'Watch', tone: 'amber' },
        context: emptyCtx,
        to: '/upload',
        ctaLabel: 'Adjust Buffer →',
      },
    ]
    return (
      <div className="dsum-grid">
        {specs.map((s) => (
          <SummaryCard key={s.key} spec={s} />
        ))}
      </div>
    )
  }

  const opp = Math.max(0, yieldAnnualOpp || 0)
  const conc = Math.max(0, concentrationMaxPct || 0)
  const unprot = Math.max(0, concentrationUnprotected || 0)
  const baseR = runwayMo
  const burn = Math.max(0, monthlyBurn || 0)
  const net = cfNetMonthly
  const out = Math.max(0, cfAvgOut || 0)

  const yieldStatus =
    opp >= 80_000 ? { label: 'Action Required', tone: 'red' } : opp >= 15_000 ? { label: 'Watch', tone: 'amber' } : { label: 'Healthy', tone: 'green' }
  const concStatus =
    conc > 75 || unprot > 500_000
      ? { label: 'Action Required', tone: 'red' }
      : conc > 50 || unprot > FSCS_LIMIT_GBP
        ? { label: 'Watch', tone: 'amber' }
        : { label: 'Healthy', tone: 'green' }
  const runwayStatus =
    baseR == null || !Number.isFinite(baseR)
      ? { label: 'Watch', tone: 'amber' }
      : baseR < 12
        ? { label: 'Action Required', tone: 'red' }
        : baseR < 15
          ? { label: 'Watch', tone: 'amber' }
          : { label: 'Healthy', tone: 'green' }
  const burnDelta = burnDeltaPct
  const burnStatus =
    burnDelta == null || !Number.isFinite(burnDelta)
      ? { label: 'Healthy', tone: 'green' }
      : burnDelta > 12
        ? { label: 'Action Required', tone: 'red' }
        : burnDelta > 5
          ? { label: 'Watch', tone: 'amber' }
          : { label: 'Healthy', tone: 'green' }
  const cfStatus = cfLowCash
    ? { label: 'Action Required', tone: 'red' }
    : net < 0
      ? { label: 'Watch', tone: 'amber' }
      : { label: 'Healthy', tone: 'green' }
  const liqStatus =
    liquidityBand === 'red' ? { label: 'Action Required', tone: 'red' } : liquidityBand === 'amber' ? { label: 'Watch', tone: 'amber' } : { label: 'Healthy', tone: 'green' }

  const bufLabel =
    liquidityBufferMo != null && Number.isFinite(liquidityBufferMo)
      ? `${liquidityBufferMo.toLocaleString('en-GB', { maximumFractionDigits: 1 })} months`
      : '—'

  /** @type {SummaryCardSpec[]} */
  const specs = [
    {
      key: 'yield',
      title: 'Yield Gap',
      term: 'yield-gap',
      headline: `${formatGBP(Math.round(opp))} opportunity cost / yr`,
      status: yieldStatus,
      context: [
        `Net cash ${formatGBP(Math.round(yieldTotalCash || 0))} vs best-available benchmark rate.`,
        `Idle drag ≈ ${formatGBP(Math.round((yieldMonthlyOpp || 0)))} per month at current blended yield.`,
      ],
      to: '/app/yield',
      ctaLabel: 'Optimise Yield →',
    },
    {
      key: 'conc',
      title: 'Concentration Risk',
      term: 'concentration-risk',
      headline: `${formatPct(conc, 1)} in largest bank`,
      status: concStatus,
      context: [
        `FSCS unprotected balance ${formatGBP(Math.round(unprot))} across institutions.`,
        'Compare to £120,000 protection limit per authorised firm.',
      ],
      to: '/app/concentration',
      ctaLabel: 'Reduce Exposure →',
    },
    {
      key: 'runway',
      title: 'Runway',
      term: 'runway',
      headline: baseR != null && Number.isFinite(baseR) ? `${baseR.toFixed(1)} months` : '—',
      status: runwayStatus,
      context: [
        `Cash ÷ average monthly burn (${formatGBP(Math.round(burn))}).`,
        'Bear / base / bull scenarios available on the module page.',
      ],
      to: '/app/runway',
      ctaLabel: 'Model Scenarios →',
    },
    {
      key: 'burn',
      title: 'Burn Rate',
      term: 'burn-rate',
      headline: burn > 0 ? `${formatGBP(Math.round(burn))} / month` : '—',
      status: burnStatus,
      context: [
        burnDelta != null && Number.isFinite(burnDelta)
          ? `Last 30 days vs trailing 90: ${burnDelta > 0 ? '+' : ''}${burnDelta.toFixed(1)}%.`
          : 'Trailing 90-day average monthly outflow.',
        'Category breakdown on Runway & Burn.',
      ],
      to: '/app/runway',
      ctaLabel: 'Analyse Spend →',
    },
    {
      key: 'cf',
      title: 'Cash Flow',
      headline: `${formatGBP(Math.round(net))} net / month`,
      status: cfStatus,
      context: [
        `Avg outflows ${formatGBP(Math.round(out))} · inflows from your import window.`,
        cfLowCash ? 'Trajectory shows a low-cash week inside the forecast horizon.' : 'No low-cash flag on current averages.',
      ],
      to: '/app/cashflow',
      ctaLabel: 'View Forecast →',
    },
    {
      key: 'liq',
      title: 'Liquidity Buffer',
      term: 'liquidity-buffer',
      headline: bufLabel,
      status: liqStatus,
      context: [
        'Months of instantly accessible cash vs 90-day operating outflows.',
        'Target 6 months minimum operating cover where possible.',
      ],
      to: '/app/liquidity',
      ctaLabel: 'Adjust Buffer →',
    },
  ]

  return (
    <section className="tdash__summary-section" aria-label="Module summaries">
      <div className="dsum-grid">
        {specs.map((s) => (
          <SummaryCard key={s.key} spec={s} />
        ))}
      </div>
    </section>
  )
}
