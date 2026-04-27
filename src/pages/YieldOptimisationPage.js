import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { YIELD_MARKETPLACE_PRODUCTS } from '../data/yieldMarketplace'
import { YIELD_BEST_PCT } from '../utils/treasuryYield'
import { computeLiquidityBuffer } from '../utils/treasuryLiquidity'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { buildYieldCapitalMoves } from '../utils/capitalMovesFromData'
import { YieldApplyConfirmModal } from '../components/YieldApplyConfirmModal'
import { ModuleCapitalMoves } from '../components/ModuleCapitalMoves'
import { TermTooltip } from '../components/TermTooltip'
import '../components/DetailPage.css'

const DEFAULT_BLENDED_PCT = 0.1

export function YieldOptimisationPage() {
  const { rows, loading, error } = useUserTransactions()
  const [overridePct, setOverridePct] = useState(String(DEFAULT_BLENDED_PCT))
  const [applyProduct, setApplyProduct] = useState(null)

  const blendedPct = useMemo(() => {
    const n = Number.parseFloat(String(overridePct).replace(/%/g, ''))
    if (!Number.isFinite(n) || n < 0 || n > 25) return DEFAULT_BLENDED_PCT
    return n
  }, [overridePct])

  const totalCash = useMemo(
    () => rows.reduce((s, t) => s + (Number.isFinite(Number(t.amount)) ? Number(t.amount) : 0), 0),
    [rows],
  )
  const liquidity = useMemo(() => computeLiquidityBuffer(rows), [rows])
  const cashBasis = Math.max(0, totalCash)
  const blendedDec = blendedPct / 100
  const bestDec = YIELD_BEST_PCT / 100
  const annualOpp = cashBasis * Math.max(0, bestDec - blendedDec)
  const monthlyOpp = annualOpp / 12

  const topProduct = YIELD_MARKETPLACE_PRODUCTS[0] || null

  const onApplyTop = useCallback(() => {
    if (topProduct) setApplyProduct(topProduct)
  }, [topProduct])

  const capitalMoves = useMemo(
    () =>
      buildYieldCapitalMoves({
        totalCash: cashBasis,
        annualOppCost: annualOpp,
        monthlyOppCost: monthlyOpp,
        currentYieldPct: blendedPct,
        bestYieldPct: YIELD_BEST_PCT,
        topProduct,
        onApplyTop: topProduct ? onApplyTop : undefined,
      }),
    [annualOpp, blendedPct, cashBasis, monthlyOpp, onApplyTop, topProduct],
  )

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
      <ModuleCapitalMoves actions={capitalMoves} />

      <header className="detail-hero">
        <h1 className="detail-title">Yield Optimisation</h1>
        <p className="detail-sub">
          How much your idle cash is earning vs what it could earn at the same liquidity level — and exactly how to
          close the gap.
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">
          Your position (<TermTooltip term="aer" label="AER" />)
        </h2>
        <p className="detail-section__lead">
          Figures use your imported statement totals. Override the blended yield you earn today if it differs from the
          Barclays default.
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
                <p className="detail-stat__cap">
                  <TermTooltip term="yield-gap" label="Annual opportunity cost" />
                </p>
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
        <h2 className="detail-section__title">
          Opportunities marketplace (<TermTooltip term="mmf" label="Money market funds" />)
        </h2>
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
                    <button
                      type="button"
                      className="detail-btn detail-btn--salmon"
                      onClick={() => setApplyProduct(p)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
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

      {applyProduct ? (
        <YieldApplyConfirmModal
          open
          product={applyProduct}
          liquidity={liquidity}
          currentYieldDec={blendedDec}
          source="yield_optimisation"
          onClose={() => setApplyProduct(null)}
        />
      ) : null}
    </div>
  )
}
