import '../components/DetailPage.css'

const CUSTOMERS = 12

export function PeerBenchmarksPage() {
  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Peer Benchmarks</h1>
        <p className="detail-sub">How your treasury compares to similar companies</p>
      </header>

      <section className="detail-section">
        <p style={{ fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
          Peer benchmarking unlocks at <strong>50 customers</strong>. We currently have <strong>{CUSTOMERS}</strong>{' '}
          companies on the platform. Get early access to be notified when your cohort is ready.
        </p>
        <button type="button" className="detail-btn detail-btn--dark" style={{ marginTop: '1rem' }}>
          Get early access
        </button>
      </section>

      <section className="detail-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <h2 className="detail-section__title">Preview</h2>
        <div style={{ filter: 'blur(5px)', opacity: 0.45, pointerEvents: 'none' }}>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>You</th>
                <th>Peer avg</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {['Liquidity', 'Yield', 'Runway', 'Burn'].map((m) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
