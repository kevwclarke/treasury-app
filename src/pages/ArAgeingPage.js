import { useState } from 'react'
import { formatGBP } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const XERO_CONNECTED = false

const INVOICES = [
  { no: 'INV-2041', client: 'Globex UK', amount: 48_000, due: '2026-02-14', days: 64 },
  { no: 'INV-2058', client: 'Umbrella Ltd', amount: 22_500, due: '2026-03-01', days: 49 },
]

export function ArAgeingPage() {
  const [rows] = useState(INVOICES)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const runwayLift = 1.4

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Accounts Receivable</h1>
        <p className="detail-sub">Outstanding invoices and runway impact</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Summary</h2>
        <p className="detail-stat__val" style={{ fontSize: '2rem', marginBottom: 16 }}>
          {formatGBP(total)}
        </p>
        <div className="detail-grid3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {[
            { label: 'Current 0–30', amt: 120_000, n: 6 },
            { label: 'Overdue 30–60', amt: 35_000, n: 2 },
            { label: 'Overdue 60–90', amt: 18_000, n: 1 },
            { label: 'Overdue 90+', amt: 12_000, n: 1 },
          ].map((b) => (
            <div key={b.label} className="detail-stat">
              <p className="detail-stat__cap">{b.label}</p>
              <p className="detail-stat__val">{formatGBP(b.amt)}</p>
              <p className="detail-muted">{b.n} invoices</p>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Runway impact</h2>
        <p className="detail-section__lead">
          If all overdue invoices were collected today, runway increases by <strong>{runwayLift} months</strong>.
        </p>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Before</p>
            <p className="detail-stat__val">18.4 mo</p>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">After</p>
            <p className="detail-stat__val detail-stat__val--green">{(18.4 + runwayLift).toFixed(1)} mo</p>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Invoices</h2>
        <table className="detail-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Days overdue</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.no}>
                <td>{r.no}</td>
                <td>{r.client}</td>
                <td>{formatGBP(r.amount)}</td>
                <td>{r.due}</td>
                <td>{r.days}</td>
                <td>
                  <button type="button" className="detail-btn detail-btn--salmon">
                    Chase
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Xero</h2>
        {XERO_CONNECTED ? (
          <p className="detail-muted">Connected · Last sync 18 min ago</p>
        ) : (
          <>
            <p className="detail-section__lead">Connect Xero for live invoice ageing and collections status.</p>
            <button type="button" className="detail-btn detail-btn--dark">
              Connect Xero
            </button>
          </>
        )}
      </section>
    </div>
  )
}
