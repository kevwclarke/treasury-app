import '../components/DetailPage.css'

const INSTITUTIONS = [
  { name: 'Barclays', type: 'Business Current', last4: '4240', balance: 3_759_600, rate: 0.1 },
  { name: 'Barclays', type: 'Business Savings', last4: '8812', balance: 578_400, rate: 1.85 },
  { name: 'Starling', type: 'Primary', last4: '1193', balance: 482_000, rate: 2.1 },
]

const FSCS_LIMIT = 85_000

export function ConcentrationRiskPage() {
  const total = INSTITUTIONS.reduce((s, a) => s + a.balance, 0)
  const pct = (b) => Math.round((b / total) * 1000) / 10
  const topPct = pct(INSTITUTIONS[0].balance)
  const risk =
    topPct < 50 ? { label: 'Lower risk', tone: 'green' } : topPct <= 75 ? { label: 'Elevated', tone: 'amber' } : { label: 'High risk', tone: 'red' }

  let protectedTotal = 0
  const rows = INSTITUTIONS.map((r) => {
    const prot = Math.min(r.balance, FSCS_LIMIT)
    const unprot = Math.max(0, r.balance - FSCS_LIMIT)
    protectedTotal += prot
    return { ...r, sharePct: pct(r.balance), prot, unprot }
  })
  const unprotectedTotal = Math.max(0, total - protectedTotal)

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Concentration Risk</h1>
        <p className="detail-sub">FSCS protection and counterparty exposure</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Exposure overview</h2>
        <div style={{ display: 'flex', height: '1.25rem', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem' }}>
          {INSTITUTIONS.map((r, i) => (
            <div
              key={i}
              style={{
                width: `${pct(r.balance)}%`,
                background: i === 0 ? '#c4704f' : i === 1 ? '#e8a87c' : '#78716c',
              }}
              title={`${r.name} ${pct(r.balance)}%`}
            />
          ))}
        </div>
        <p className="detail-muted" style={{ marginBottom: '0.75rem' }}>
          {INSTITUTIONS.map((r) => `${pct(r.balance)}% ${r.name}`).join(' · ')}
        </p>
        <span
          className={`detail-badge ${
            risk.tone === 'green' ? 'detail-badge--green' : risk.tone === 'amber' ? '' : 'detail-badge--red'
          }`}
          style={
            risk.tone === 'amber'
              ? { background: '#c27803', color: '#fff' }
              : undefined
          }
        >
          {risk.label} · top bank {topPct}%
        </span>
        <p className="detail-section__lead" style={{ marginTop: '1rem' }}>
          Placeholder allocation — connect bank feeds for live balances.
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Account detail</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Institution</th>
                <th>Account</th>
                <th>Last 4</th>
                <th>Balance</th>
                <th>% of total</th>
                <th>Rate</th>
                <th>FSCS protected</th>
                <th>Unprotected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.last4}>
                  <td>{r.name}</td>
                  <td>{r.type}</td>
                  <td>···{r.last4}</td>
                  <td>
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(r.balance)}
                  </td>
                  <td>{r.sharePct}%</td>
                  <td>{r.rate}%</td>
                  <td>
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(r.prot)}
                  </td>
                  <td className="text-red">
                    {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(r.unprot)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">FSCS calculator</h2>
        <p className="detail-section__lead">
          The Financial Services Compensation Scheme protects up to £85,000 per person per authorised institution for
          eligible deposits.
        </p>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Total protected</p>
            <p className="detail-stat__val detail-stat__val--green">
              {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(protectedTotal)}
            </p>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Total unprotected</p>
            <p className="detail-stat__val detail-stat__val--salmon">
              {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(unprotectedTotal)}
            </p>
          </div>
        </div>
        {unprotectedTotal > 500_000 ? (
          <div className="detail-warn detail-warn--red" style={{ marginTop: '1rem' }}>
            Unprotected cash exceeds £500,000 — review sweeps and second legal entity structures urgently.
          </div>
        ) : null}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Recommendations</h2>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Spread</p>
            <p className="detail-muted">Split operating balances across ≥2 authorised institutions.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              Build sweep plan
            </button>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Government-backed</p>
            <p className="detail-muted">Allocate a sleeve to short-dated gilts / T-Bills for sovereign risk.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              View T-Bills
            </button>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Flagstone</p>
            <p className="detail-muted">Multi-bank platform to stack FSCS coverage with one operational workflow.</p>
            <button type="button" className="detail-btn" style={{ marginTop: '0.75rem' }}>
              Explore Flagstone
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
