import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { YIELD_MARKETPLACE_PRODUCTS } from '../data/yieldMarketplace'
import { YIELD_BEST_PCT } from '../utils/treasuryYield'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const DEFAULT_BLENDED_PCT = 0.1

/** Static BoE reference points (last 12 months), illustrative. */
const BOE_HISTORY = [4.0, 4.1, 4.15, 4.2, 4.35, 4.45, 4.5, 4.6, 4.65, 4.7, 4.72, 4.75]

function BoeRateChart() {
  const w = 640
  const h = 200
  const pad = 28
  const minR = Math.min(...BOE_HISTORY)
  const maxR = Math.max(...BOE_HISTORY)
  const xStep = (w - pad * 2) / (BOE_HISTORY.length - 1)
  const pts = BOE_HISTORY.map((r, i) => {
    const x = pad + i * xStep
    const y = pad + (1 - (r - minR) / (maxR - minR || 1)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg className="detail-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="BoE base rate last 12 months">
      <rect width={w} height={h} fill="#FAFAFA" rx="8" />
      <text x={pad} y={20} fontSize="11" fill="#6B7280" fontFamily="'Inter', 'DM Sans', sans-serif">
        Bank of England base rate — reference (illustrative)
      </text>
      <polyline fill="none" stroke="#1E3A5F" strokeWidth="2.5" points={pts} />
      {BOE_HISTORY.map((r, i) => {
        const x = pad + i * xStep
        const y = pad + (1 - (r - minR) / (maxR - minR || 1)) * (h - pad * 2)
        return <circle key={i} cx={x} cy={y} r="3" fill="#1E3A5F" />
      })}
    </svg>
  )
}

export function YieldOptimisationPage() {
  const { rows, loading, error } = useUserTransactions()
  const [overridePct, setOverridePct] = useState(String(DEFAULT_BLENDED_PCT))

  const blendedPct = useMemo(() => {
    const n = Number.parseFloat(String(overridePct).replace(/%/g, ''))
    if (!Number.isFinite(n) || n < 0 || n > 25) return DEFAULT_BLENDED_PCT
    return n
  }, [overridePct])

  const totalCash = useMemo(
    () => rows.reduce((s, t) => s + (Number.isFinite(Number(t.amount)) ? Number(t.amount) : 0), 0),
    [rows],
  )
  const cashBasis = Math.max(0, totalCash)
  const blendedDec = blendedPct / 100
  const bestDec = YIELD_BEST_PCT / 100
  const annualOpp = cashBasis * Math.max(0, bestDec - blendedDec)

  const strategyCards = [
    {
      title: 'Conservative',
      desc: 'FSCS protected only — minimise counterparty risk.',
      blended: 4.2,
      gain: cashBasis * ((4.2 - blendedPct) / 100),
    },
    {
      title: 'Balanced',
      desc: 'Mix of MMF liquidity and short-dated FSCS deposits.',
      blended: 4.65,
      gain: cashBasis * ((4.65 - blendedPct) / 100),
    },
    {
      title: 'Aggressive',
      desc: 'Maximise yield with T-bills and institutional sleeves.',
      blended: 5.05,
      gain: cashBasis * ((5.05 - blendedPct) / 100),
    },
  ]

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Yield Optimisation</h1>
        <p className="detail-sub">Maximise returns on idle cash without sacrificing liquidity</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Your position</h2>
        <p className="detail-section__lead">
          Figures use your imported statement totals. Override the blended yield you earn today if it differs from
          the Barclays default.
        </p>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : error ? (
          <p className="detail-warn detail-warn--red">{error}</p>
        ) : rows.length === 0 ? (
          <div className="detail-empty">
            No transactions yet. <Link to="/upload">Upload a bank statement</Link> to populate total cash and
            opportunity cost.
          </div>
        ) : (
          <>
            <div className="detail-grid3">
              <div className="detail-stat">
                <p className="detail-stat__cap">Total cash</p>
                <p className="detail-stat__val">{formatGBP(Math.round(totalCash))}</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Current blended yield</p>
                <p className="detail-stat__val detail-stat__val--salmon">{formatPct(blendedPct, 2)}</p>
              </div>
              <div className="detail-stat">
                <p className="detail-stat__cap">Annual opportunity cost</p>
                <p className="detail-stat__val detail-stat__val--salmon">{formatGBP(Math.round(annualOpp))}</p>
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label className="detail-label" htmlFor="yield-override">
                Override actual account interest rate (%)
              </label>
              <input
                id="yield-override"
                className="detail-input"
                type="text"
                inputMode="decimal"
                value={overridePct}
                onChange={(e) => setOverridePct(e.target.value)}
                placeholder="0.10"
              />
              <p className="detail-muted" style={{ marginTop: '0.5rem' }}>
                Default {formatPct(DEFAULT_BLENDED_PCT, 2)} until you connect live bank rates.
              </p>
            </div>
          </>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Opportunities marketplace</h2>
        <p className="detail-section__lead">Ranked by headline rate. Estimated gain uses your net cash position.</p>
        <div className="detail-product-list">
          {YIELD_MARKETPLACE_PRODUCTS.map((p) => {
            const estGain = cashBasis * ((p.ratePct - blendedPct) / 100)
            return (
              <article key={p.rank} className="detail-product">
                <div className="detail-product__rank">{p.rank}</div>
                <div>
                  <h3 className="detail-product__name">{p.name}</h3>
                  <p className="detail-product__meta">
                    {p.provider} · {p.type}
                  </p>
                  <p className="detail-product__rate">{formatPct(p.ratePct, 2)}</p>
                  <p className="detail-product__meta">
                    Liquidity: {p.liquidity} · Est. annual gain:{' '}
                    <strong>{formatGBP(Math.round(estGain))}</strong>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`detail-badge ${p.fscs ? 'detail-badge--green' : 'detail-badge--red'}`}>
                    {p.fscsLabel}
                  </span>
                  <div style={{ marginTop: '0.75rem' }}>
                    <a className="detail-btn detail-btn--salmon" href={p.applyUrl} target="_blank" rel="noreferrer">
                      Apply
                    </a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Rate history</h2>
        <p className="detail-section__lead">BoE base rate as a macro reference — static illustrative series.</p>
        <BoeRateChart />
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Optimisation strategy</h2>
        <p className="detail-section__lead">Illustrative sleeves — not personal advice.</p>
        <div className="detail-grid3">
          {strategyCards.map((s) => (
            <div key={s.title} className="detail-stat">
              <p className="detail-stat__cap">{s.title}</p>
              <p className="detail-stat__val detail-stat__val--green">{formatPct(s.blended, 2)} blended</p>
              <p className="detail-muted" style={{ marginTop: '0.5rem' }}>
                {s.desc}
              </p>
              <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                Est. annual gain: {formatGBP(Math.round(s.gain))}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
