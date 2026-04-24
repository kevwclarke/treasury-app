import { formatGBP } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const OBLIGATIONS = [
  { type: 'VAT', amount: 42_800, due: '2026-05-07', days: 18, urgent: true },
  { type: 'PAYE / NI', amount: 63_200, due: '2026-05-22', days: 33, urgent: false },
  { type: 'Corporation Tax', amount: 128_000, due: '2026-09-01', days: 135, urgent: false },
]

export function TaxTrackerPage() {
  const total = OBLIGATIONS.reduce((s, o) => s + o.amount, 0)
  const cash = 4_820_000
  const pct = Math.round((total / cash) * 1000) / 10

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Tax Liability Tracker</h1>
        <p className="detail-sub">Upcoming obligations and cash flow impact</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Upcoming obligations</h2>
        <div className="detail-grid3">
          {OBLIGATIONS.map((o) => (
            <div
              key={o.type}
              className="detail-stat"
              style={{
                borderColor: o.urgent ? 'rgba(180,35,24,0.25)' : undefined,
                background: o.urgent ? 'rgba(180,35,24,0.06)' : undefined,
              }}
            >
              <p className="detail-stat__cap">{o.type}</p>
              <p className="detail-stat__val">{formatGBP(o.amount)}</p>
              <p className="detail-muted">
                Due {o.due} · {o.days} days · {o.urgent ? 'Urgent' : 'Scheduled'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Total reserved</h2>
        <p className="detail-stat__val" style={{ fontSize: '2rem' }}>
          {formatGBP(total)}
        </p>
        <p className="detail-muted">≈ {pct}% of illustrative current cash.</p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Tax calendar</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ textAlign: 'center', width: 52 }}>
              <div style={{ fontSize: 10, color: '#6B7280' }}>M{i + 1}</div>
              <div style={{ margin: '6px auto 0', width: 10, height: 10, borderRadius: 999, background: i % 4 === 0 ? '#1E3A5F' : '#E5E7EB' }} />
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Making Tax Digital</h2>
        <p className="detail-section__lead">
          Connecting to HMRC MTD improves filing accuracy and pulls obligations automatically.
        </p>
        <button type="button" className="detail-btn detail-btn--dark">
          Learn more
        </button>
      </section>
    </div>
  )
}
