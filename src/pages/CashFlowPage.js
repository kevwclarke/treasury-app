import { useMemo, useState } from 'react'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { formatGBP } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const WEEKS = 13
const RECURRING = [
  { payee: 'Slack Technologies', amount: 420, frequency: 'Monthly', next: '2026-04-22', category: 'Infrastructure', on: true },
  { payee: 'Google Workspace', amount: 1180, frequency: 'Monthly', next: '2026-04-28', category: 'Infrastructure', on: true },
  { payee: 'Deel Inc', amount: 84200, frequency: 'Monthly', next: '2026-04-30', category: 'Payroll', on: true },
]

export function CashFlowPage() {
  const { rows, loading } = useUserTransactions()
  const [rec, setRec] = useState(RECURRING)

  const headline = useMemo(() => {
    let inF = 0
    let outF = 0
    rows.forEach((t) => {
      const a = Number(t.amount)
      if (!Number.isFinite(a)) return
      if (a > 0) inF += a
      else outF += Math.abs(a)
    })
    const inM = rows.length ? (inF / Math.max(1, rows.length)) * 30 : 412_000
    const outM = rows.length ? (outF / Math.max(1, rows.length)) * 30 : 318_000
    return {
      inAvg: inM,
      outAvg: outM,
      net: inM - outM,
    }
  }, [rows])

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Cash Flow Forecast</h1>
        <p className="detail-sub">90-day forward visibility</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Headline stats</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <div className="detail-grid3">
            <div className="detail-stat">
              <p className="detail-stat__cap">Average monthly inflow</p>
              <p className="detail-stat__val detail-stat__val--green">{formatGBP(Math.round(headline.inAvg))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Average monthly outflow</p>
              <p className="detail-stat__val detail-stat__val--red">{formatGBP(Math.round(headline.outAvg))}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Net monthly position</p>
              <p className="detail-stat__val">{formatGBP(Math.round(headline.net))}</p>
            </div>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Forecast chart</h2>
        <p className="detail-section__lead">
          Inflows above the axis (navy), outflows below (red). Dotted line: today. Red line: low cash threshold
          (illustrative).
        </p>
        <svg viewBox="0 0 780 240" className="detail-chart" role="img" aria-label="90-day cash forecast">
          <rect width="780" height="240" fill="#FAFAFA" rx="8" />
          <line x1="390" y1="20" x2="390" y2="220" stroke="#0F0F0F" strokeWidth="2" strokeDasharray="4 4" />
          <line x1="40" y1="120" x2="740" y2="120" stroke="#E5E7EB" />
          <line x1="40" y1="190" x2="740" y2="190" stroke="#DC2626" strokeDasharray="6 4" />
          <text x="400" y="16" fontSize="11" fill="#6B7280">
            Today
          </text>
          {Array.from({ length: WEEKS }).map((_, i) => {
            const x = 60 + i * 54
            const hIn = 40 + (i % 5) * 8
            const hOut = 30 + (i % 4) * 7
            return (
              <g key={i}>
                <rect x={x} y={120 - hIn} width="20" height={hIn} fill="#1B2B8C" opacity={i > 6 ? 0.35 : 1} stroke={i > 6 ? '#1B2B8C' : 'none'} />
                <rect x={x} y={120} width="20" height={hOut} fill="#DC2626" opacity={i > 6 ? 0.35 : 1} stroke={i > 6 ? '#DC2626' : 'none'} />
                <text x={x + 10} y="232" fontSize="9" textAnchor="middle" fill="#6B7280">
                  W{i + 1}
                </text>
              </g>
            )
          })}
        </svg>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Recurring transactions</h2>
        <table className="detail-table">
          <thead>
            <tr>
              <th>Include</th>
              <th>Payee</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Next</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {rec.map((r, idx) => (
              <tr key={r.payee}>
                <td>
                  <input
                    type="checkbox"
                    checked={r.on}
                    onChange={() =>
                      setRec((prev) => prev.map((x, i) => (i === idx ? { ...x, on: !x.on } : x)))
                    }
                  />
                </td>
                <td>{r.payee}</td>
                <td>{formatGBP(r.amount)}</td>
                <td>{r.frequency}</td>
                <td>{r.next}</td>
                <td>{r.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Low cash warnings</h2>
        <div className="detail-warn detail-warn--red">
          Week of <strong>9 Jun 2026</strong> — projected cash may fall below <strong>1 month of burn</strong>. Shortfall
          illustrative: <strong>{formatGBP(48_000)}</strong>.
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Connect Xero</h2>
        <p className="detail-section__lead">
          Linking Xero adds committed invoices and bills so the 90-day view reflects money already spoken for.
        </p>
        <button type="button" className="detail-btn detail-btn--dark">
          Connect Xero
        </button>
      </section>
    </div>
  )
}
