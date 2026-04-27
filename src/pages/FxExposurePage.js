import { useMemo } from 'react'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatGBP } from '../utils/treasuryFormat'
import { detectFxExposureFromPayees } from '../utils/treasuryFxExposure'
import { buildFxCapitalMoves } from '../utils/capitalMovesFromData'
import { ModuleCapitalMoves } from '../components/ModuleCapitalMoves'
import '../components/DetailPage.css'

export function FxExposurePage() {
  const { rows, loading } = useUserTransactions()
  const pairs = useMemo(() => detectFxExposureFromPayees(rows), [rows])
  const capitalMoves = useMemo(() => buildFxCapitalMoves({ pairs }), [pairs])
  const totalGbp = pairs.reduce((s, p) => s + (Number(p.gbp) || 0), 0)
  const var5 = totalGbp * 0.05
  const maxGbp = Math.max(1, ...pairs.map((p) => p.gbp || 0))

  if (!loading && pairs.length === 0) {
    return (
      <div className="detail-page">
        <ModuleCapitalMoves actions={[]} />

        <header className="detail-hero">
          <h1 className="detail-title">FX Exposure</h1>
          <p className="detail-sub">
            Non-GBP spend inferred from payee text — when present, we quantify monthly GBP equivalent and a simple 5%
            shock to stress unhedged exposure.
          </p>
        </header>
        <div className="detail-empty">
          No FX exposure detected — your burn appears to be entirely in GBP based on imported payee text. Upload more
          detailed descriptions or connect bank FX tags to populate this view.
        </div>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <ModuleCapitalMoves actions={capitalMoves} />

      <header className="detail-hero">
        <h1 className="detail-title">FX Exposure</h1>
        <p className="detail-sub">
          Where foreign-currency costs show up in your import, what they mean in GBP, and the P&amp;L impact if sterling
          moves — so you can decide what to hedge.
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Exposure summary</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <div className="detail-grid3">
            <div className="detail-stat">
              <p className="detail-stat__cap">Unhedged (GBP / mo)</p>
              <p className="detail-stat__val">{formatGBP(Math.round(totalGbp))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">5% GBP shock (illustrative)</p>
              <p className="detail-stat__val">{formatGBP(Math.round(var5))}</p>
              <p className="detail-muted" style={{ marginTop: 6 }}>
                Sum of monthly GBP equivalents × 5% — rough stress, not VaR.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Currency breakdown</h2>
        {pairs.map((p) => {
          const w = maxGbp > 0 ? Math.round((p.gbp / maxGbp) * 100) : 0
          return (
            <div key={p.code} className="detail-product" style={{ marginBottom: 12 }}>
              <div className="detail-currency-code" aria-hidden>
                {p.code}
              </div>
              <div>
                <h3 className="detail-product__name">{p.pair}</h3>
                <p className="detail-product__meta">
                  Monthly exposure {p.monthlyFc.toLocaleString('en-GB')} {p.code} · GBP {formatGBP(p.gbp)}
                </p>
                <div style={{ height: 8, background: '#E5E7EB', borderRadius: 999, marginTop: 8, maxWidth: 360 }}>
                  <div
                    style={{
                      width: `${w}%`,
                      height: '100%',
                      background: '#1b2b8c',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <p className="detail-muted" style={{ marginTop: 8 }}>
                  1% GBP move → {formatGBP(Math.round(p.gbp * 0.01))} on monthly burn · 5% →{' '}
                  {formatGBP(Math.round(p.gbp * 0.05))}
                </p>
              </div>
            </div>
          )
        })}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Scenario analysis</h2>
        <p className="detail-section__lead">Impact on monthly burn if GBP weakens against your exposure currencies.</p>
        <table className="detail-table">
          <thead>
            <tr>
              <th>GBP move</th>
              {pairs.map((p) => (
                <th key={p.code}>{p.code} impact / mo</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 5, 10].map((mv) => (
              <tr key={mv}>
                <td>Weakens {mv}%</td>
                {pairs.map((p) => (
                  <td key={p.code}>{formatGBP(Math.round((p.gbp * mv) / 100))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Hedging options</h2>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Forward contracts</p>
            <p className="detail-muted">Lock a rate for a future cash need — best for known invoice cadence.</p>
            <a className="detail-btn" style={{ marginTop: 8 }} href="https://www.bankofengland.co.uk/" target="_blank" rel="noreferrer">
              Learn more
            </a>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Currency accounts</p>
            <p className="detail-muted">Hold receipts in native currency until strategic conversion.</p>
            <a className="detail-btn" style={{ marginTop: 8 }} href="https://www.bankofengland.co.uk/" target="_blank" rel="noreferrer">
              Learn more
            </a>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Natural hedging</p>
            <p className="detail-muted">Match USD/EUR costs to revenues in the same currency where possible.</p>
            <a className="detail-btn" style={{ marginTop: 8 }} href="https://www.bankofengland.co.uk/" target="_blank" rel="noreferrer">
              Learn more
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
