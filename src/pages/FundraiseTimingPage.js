import { useMemo, useState } from 'react'
import '../components/DetailPage.css'

export function FundraiseTimingPage() {
  const runwayMo = 15.2
  const [processMonths, setProcessMonths] = useState(6)
  const [checks, setChecks] = useState({
    runway: true,
    cap: false,
    board: true,
    health: false,
  })

  const startBy = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + Math.max(0, runwayMo - 12 - processMonths))
    return d
  }, [runwayMo, processMonths])
  const isPast = startBy.getTime() < Date.now()

  const traffic =
    runwayMo >= 18 ? { color: '#1E3A5F', label: 'Green' } : runwayMo >= 12 ? { color: '#D97706', label: 'Amber' } : { color: '#DC2626', label: 'Red' }

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Fundraise Timing</h1>
        <p className="detail-sub">Never get caught short</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Current position</h2>
        <p className="detail-stat__val" style={{ fontSize: '2.5rem' }}>
          {runwayMo.toFixed(1)} mo
        </p>
        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 18, borderRadius: 999, background: traffic.color }} />
          <span className="detail-muted">{traffic.label} · target 18+ months</span>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Fundraise calculator</h2>
        <label className="detail-label" htmlFor="proc">
          Fundraising process duration (months)
        </label>
        <input
          id="proc"
          className="detail-input"
          type="number"
          min={3}
          max={18}
          value={processMonths}
          onChange={(e) => setProcessMonths(Number(e.target.value) || 6)}
        />
        <p className="detail-section__lead" style={{ marginTop: 16 }}>
          Start conversations by (to stay above 12 months runway through close):
        </p>
        <p className="detail-stat__val" style={{ fontSize: '1.75rem', color: isPast ? '#DC2626' : '#1E3A5F' }}>
          {startBy.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Readiness checklist</h2>
        {[
          { id: 'runway', label: '18 months runway at close' },
          { id: 'cap', label: 'Clean cap table' },
          { id: 'board', label: 'Monthly board reporting' },
          { id: 'health', label: 'Treasury health score above 70' },
        ].map((c) => (
          <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={checks[c.id]}
              onChange={() => setChecks((s) => ({ ...s, [c.id]: !s[c.id] }))}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Scenario</h2>
        <div className="detail-grid3">
          {[
            { t: 'Start today', m: 14.8, note: 'Earliest close pressure' },
            { t: 'Start in 3 months', m: 13.1, note: 'Runway compression' },
            { t: 'Start in 6 months', m: 11.4, note: 'High risk window' },
          ].map((s) => (
            <div key={s.t} className="detail-stat">
              <p className="detail-stat__cap">{s.t}</p>
              <p className="detail-stat__val">{s.m} mo runway</p>
              <p className="detail-muted">{s.note}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
