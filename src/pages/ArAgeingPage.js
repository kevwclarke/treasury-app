import { useState } from 'react'
import { formatGBP } from '../utils/treasuryFormat'
import { TransactionList } from '../components/TransactionRow'
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
        <TransactionList>
          {rows.map((r) => (
            <div key={r.no} className="txn-row txn-row--in">
              <div className="txn-row__icon txn-row__icon--in" aria-hidden>
                <svg className="txn-row__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 17L17 7M17 7H9M17 7V15"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="txn-row__body">
                <p className="txn-row__payee">{r.client}</p>
                <p className="txn-row__meta">
                  {r.no} · Due {r.due} · {r.days} days overdue
                </p>
              </div>
              <div className="txn-row__right">
                <p className="txn-row__amt txn-row__amt--in">{formatGBP(r.amount)}</p>
                <button type="button" className="detail-btn detail-btn--salmon txn-row__chase">
                  Chase
                </button>
              </div>
            </div>
          ))}
        </TransactionList>
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
