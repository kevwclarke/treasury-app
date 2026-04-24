import { useEffect, useMemo, useState } from 'react'
import { useUserTransactions } from '../hooks/useUserTransactions'
import '../components/DetailPage.css'

const STORAGE_KEY = 'treasury_saved_scenarios_v1'
const CHART_MONTHS = 24

export function ScenarioModellerFullPage() {
  const { rows } = useUserTransactions()
  const [burnPct, setBurnPct] = useState(0)
  const [hires, setHires] = useState(0)
  const [salary, setSalary] = useState(90_000)
  const [arrK, setArrK] = useState(0)
  const [oneOff, setOneOff] = useState(0)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const totalCash = useMemo(
    () => rows.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    [rows],
  )

  const baseMonthlyBurn = useMemo(() => {
    const since = Date.now() - 90 * 86400000
    let spend = 0
    rows.forEach((t) => {
      const a = Number(t.amount)
      const d = new Date(t.date).getTime()
      if (Number.isFinite(a) && a < 0 && d >= since) spend += Math.abs(a)
    })
    return spend > 0 ? spend / 3 : 265_000
  }, [rows])

  /** Adjusted monthly burn: base × (1 + burn% / 100) + hires×salary/12 − ARR (monthly £) + one-off/12 */
  const adjustedMonthlyBurn = useMemo(() => {
    const fromBurnRate = baseMonthlyBurn * (1 + burnPct / 100)
    const hireCostMonthly = (hires * salary) / 12
    const arrMonthlyGbp = arrK * 1000
    const oneOffMonthly = oneOff / 12
    return Math.max(1, fromBurnRate + hireCostMonthly - arrMonthlyGbp + oneOffMonthly)
  }, [baseMonthlyBurn, burnPct, hires, salary, arrK, oneOff])

  const runwayMonths = useMemo(() => {
    if (totalCash <= 0 || adjustedMonthlyBurn <= 0) return 0
    return totalCash / adjustedMonthlyBurn
  }, [totalCash, adjustedMonthlyBurn])

  const runwayColor =
    runwayMonths > 18 ? '#1E3A5F' : runwayMonths >= 12 ? '#D97706' : '#DC2626'

  const chartPolylinePoints = useMemo(() => {
    const w = 680
    const h = 180
    const padL = 24
    const padR = 16
    const padT = 16
    const padB = 28
    const innerW = w - padL - padR
    const innerH = h - padT - padB

    const balances = Array.from({ length: CHART_MONTHS + 1 }, (_, month) => {
      return totalCash - month * adjustedMonthlyBurn
    })

    let minB = Math.min(...balances)
    let maxB = Math.max(...balances, totalCash, 1)
    if (minB === maxB) {
      minB -= 1
      maxB += 1
    }
    const span = maxB - minB

    return balances
      .map((bal, i) => {
        const x = padL + (i / CHART_MONTHS) * innerW
        const y = padT + innerH - ((bal - minB) / span) * innerH
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [totalCash, adjustedMonthlyBurn])

  function saveScenario() {
    if (!name.trim()) return
    const next = [
      {
        id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `sc_${Date.now()}`,
        name: name.trim(),
        burn: burnPct,
        hires,
        salary,
        arr: arrK,
        oneOff,
        runway: runwayMonths,
        at: new Date().toISOString(),
      },
      ...saved,
    ].slice(0, 12)
    setSaved(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setName('')
  }

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Scenario Modeller</h1>
        <p className="detail-sub">Model the impact of business decisions on your runway</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Assumptions</h2>
        <p className="detail-section__lead" style={{ marginBottom: 12 }}>
          Adjusted monthly burn = base burn × (1 + burn change %) + (hires × salary ÷ 12) − new ARR/month + (one-off
          ÷ 12). Runway = current cash ÷ adjusted monthly burn.
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <label className="detail-label" htmlFor="sc-burn">
            Burn rate change ({burnPct}%)
          </label>
          <input
            id="sc-burn"
            type="range"
            min={-50}
            max={100}
            value={burnPct}
            onChange={(e) => setBurnPct(Number(e.target.value))}
          />
          <label className="detail-label" htmlFor="sc-hires">
            New hires ({hires})
          </label>
          <input
            id="sc-hires"
            type="range"
            min={0}
            max={20}
            value={hires}
            onChange={(e) => setHires(Number(e.target.value))}
          />
          <label className="detail-label" htmlFor="sc-salary">
            Average salary per hire (£{salary.toLocaleString('en-GB')})
          </label>
          <input
            id="sc-salary"
            type="range"
            min={50000}
            max={200000}
            step={5000}
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
          />
          <label className="detail-label" htmlFor="sc-arr">
            New ARR closed monthly (£{arrK.toLocaleString('en-GB')}k)
          </label>
          <input
            id="sc-arr"
            type="range"
            min={0}
            max={500}
            value={arrK}
            onChange={(e) => setArrK(Number(e.target.value))}
          />
          <label className="detail-label" htmlFor="sc-oneoff">
            One-off costs (£{oneOff.toLocaleString('en-GB')})
          </label>
          <input
            id="sc-oneoff"
            type="range"
            min={0}
            max={3000000}
            step={25000}
            value={oneOff}
            onChange={(e) => setOneOff(Number(e.target.value))}
          />
        </div>
        <p className="detail-muted" style={{ marginTop: 12 }}>
          Base monthly burn (90-day): £{Math.round(baseMonthlyBurn).toLocaleString('en-GB')} · Adjusted: £
          {Math.round(adjustedMonthlyBurn).toLocaleString('en-GB')} / mo · Net cash: £
          {Math.round(totalCash).toLocaleString('en-GB')}
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Runway output</h2>
        <p
          className="detail-stat__val"
          style={{ fontSize: '2.75rem', color: runwayColor, transition: 'color 0.15s ease' }}
        >
          {totalCash > 0 ? `${runwayMonths.toFixed(1)} mo` : '—'}
        </p>
        {totalCash <= 0 ? (
          <p className="detail-muted">Import transactions on the dashboard / upload page to establish net cash.</p>
        ) : null}
        <div style={{ marginTop: 16, height: 14, borderRadius: 999, background: 'linear-gradient(90deg,#DC2626,#D97706,#1E3A5F)', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -6,
              width: 4,
              height: 26,
              background: '#1E3A5F',
              left: `${Math.min(100, Math.max(0, (runwayMonths / 48) * 100))}%`,
              transform: 'translateX(-2px)',
              borderRadius: 2,
            }}
          />
        </div>
        <p className="detail-muted" style={{ marginTop: 8 }}>
          Red below 12 months · amber 12–18 · strong runway above 18
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Modelled cash balance</h2>
        <p className="detail-section__lead">Projected end-of-month cash: starting balance minus adjusted burn each month.</p>
        <svg viewBox="0 0 720 200" className="detail-chart" role="img" aria-label="Projected cash over 24 months">
          <rect width="720" height="200" fill="#FAFAFA" rx="8" />
          <line x1="24" y1="180" x2="704" y2="180" stroke="#E5E7EB" />
          <polyline fill="none" stroke="#1E3A5F" strokeWidth="2.5" points={chartPolylinePoints} />
        </svg>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Save scenario</h2>
        <input className="detail-input" style={{ maxWidth: '100%' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name" />
        <button type="button" className="detail-btn detail-btn--dark" style={{ marginTop: 12 }} onClick={saveScenario}>
          Save scenario
        </button>
        <h3 className="detail-section__title" style={{ marginTop: '1.5rem', fontSize: '1rem' }}>
          Saved scenarios
        </h3>
        {saved.length === 0 ? (
          <p className="detail-muted">No saved scenarios yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {saved.map((s) => (
              <li key={s.id} style={{ marginBottom: 8 }}>
                <strong>{s.name}</strong> — {Number(s.runway).toFixed(1)} mo · burn {s.burn}% · hires {s.hires} · saved{' '}
                {new Date(s.at).toLocaleString('en-GB')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
