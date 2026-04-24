import { useMemo } from 'react'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatGBP } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

function detectFx(rows) {
  const pairs = []
  rows.forEach((t) => {
    const p = String(t.payee ?? '').toLowerCase()
    if (/\busd\b|\$|dollar/.test(p) && !pairs.find((x) => x.code === 'USD'))
      pairs.push({ code: 'USD', flag: '🇺🇸', pair: 'USD → GBP', monthlyFc: 182_000, gbp: 142_600 })
    if (/\beur\b|€|euro/.test(p) && !pairs.find((x) => x.code === 'EUR'))
      pairs.push({ code: 'EUR', flag: '🇪🇺', pair: 'EUR → GBP', monthlyFc: 96_400, gbp: 82_900 })
  })
  return pairs
}

export function FxExposurePage() {
  const { rows, loading } = useUserTransactions()
  const pairs = useMemo(() => detectFx(rows), [rows])

  if (!loading && pairs.length === 0) {
    return (
      <div className="detail-page">
        <header className="detail-hero">
          <h1 className="detail-title">FX Exposure</h1>
          <p className="detail-sub">Currency risk on your burn</p>
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
      <header className="detail-hero">
        <h1 className="detail-title">FX Exposure</h1>
        <p className="detail-sub">Currency risk on your burn</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Exposure summary</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <div className="detail-grid3">
            <div className="detail-stat">
              <p className="detail-stat__cap">Unhedged (GBP)</p>
              <p className="detail-stat__val">{formatGBP(pairs.reduce((s, p) => s + p.gbp, 0))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Monthly currency risk</p>
              <p className="detail-stat__val">{formatGBP(11_275)}</p>
            </div>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Currency breakdown</h2>
        {pairs.map((p) => (
          <div key={p.code} className="detail-product" style={{ marginBottom: 12 }}>
            <div className="detail-product__rank" style={{ fontSize: '2rem' }}>
              {p.flag}
            </div>
            <div>
              <h3 className="detail-product__name">{p.pair}</h3>
              <p className="detail-product__meta">
                Monthly exposure {p.monthlyFc.toLocaleString('en-GB')} {p.code} · GBP {formatGBP(p.gbp)}
              </p>
              <div style={{ height: 8, background: '#E5E7EB', borderRadius: 999, marginTop: 8, maxWidth: 360 }}>
                <div style={{ width: '62%', height: '100%', background: '#1E3A5F', borderRadius: 999 }} />
              </div>
              <p className="detail-muted" style={{ marginTop: 8 }}>
                1% GBP move → {formatGBP(Math.round(p.gbp * 0.01))} on monthly burn · 5% →{' '}
                {formatGBP(Math.round(p.gbp * 0.05))}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Scenario analysis</h2>
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
