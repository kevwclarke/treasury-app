import { useEffect, useState } from 'react'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const LAST_KEY = 'treasury_last_report_at'

export function InvestorReportPage() {
  const [lastAt, setLastAt] = useState(null)

  useEffect(() => {
    setLastAt(localStorage.getItem(LAST_KEY))
  }, [])

  function generate() {
    const iso = new Date().toISOString()
    localStorage.setItem(LAST_KEY, iso)
    setLastAt(iso)
  }

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Investor-Ready Treasury Report</h1>
        <p className="detail-sub">Board-ready in 30 seconds</p>
      </header>

      <section className="detail-section">
        <div
          style={{
            border: '1px solid rgba(28,25,23,0.12)',
            borderRadius: 12,
            padding: '1.25rem',
            background: 'linear-gradient(180deg,#fffefb,#faf6f0)',
            minHeight: 280,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}
        >
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#57534e' }}>
            Confidential · Northwind Labs
          </p>
          <h2 style={{ margin: '0.5rem 0', fontSize: '1.5rem' }}>Treasury health snapshot</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Health</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>72 / 100</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Total cash</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{formatGBP(4_820_000)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#57534e' }}>Runway</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>18.4 mo</div>
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: 14, color: '#44403c', lineHeight: 1.5 }}>
            Yield gap: <strong>{formatPct(5.02, 2)}</strong> vs Barclays default · Concentration:{' '}
            <strong>High</strong> (Barclays) · Burn: payroll-weighted.
          </p>
        </div>
        <button type="button" className="detail-btn detail-btn--dark" style={{ marginTop: '1rem', padding: '0.75rem 1.25rem', fontSize: '1rem' }} onClick={generate}>
          Generate PDF
        </button>
        {lastAt ? (
          <p className="detail-muted" style={{ marginTop: 12 }}>
            Last generated: {new Date(lastAt).toLocaleString('en-GB')}
          </p>
        ) : null}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Included</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Full treasury health summary</li>
          <li>Runway scenarios and burn breakdown</li>
          <li>Yield gap and concentration risk analysis</li>
        </ul>
      </section>
    </div>
  )
}
