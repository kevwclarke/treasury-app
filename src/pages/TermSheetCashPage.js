import { useState } from 'react'
import { formatGBP } from '../utils/treasuryFormat'
import '../components/DetailPage.css'

const STRUCTURES = ['Equity', 'SAFE', 'Convertible Note']

export function TermSheetCashPage() {
  const [amt, setAmt] = useState('2,500,000')
  const [structure, setStructure] = useState('SAFE')
  const [close, setClose] = useState('')
  const [out, setOut] = useState(null)

  function analyse() {
    const n = Number.parseFloat(String(amt).replace(/[£,]/g, '')) || 0
    const base = 4_820_000
    const post = Math.round(base + n * (structure === 'Convertible Note' ? 0.97 : 1))
    const burn = 265_000
    const mo = n / burn
    setOut({ post, mo: mo.toFixed(1), health: Math.min(94, 72 + Math.min(14, mo * 2)) })
  }

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Term Sheet Cash Impact</h1>
        <p className="detail-sub">Model headline terms against current liquidity</p>
      </header>
      <section className="detail-section">
        <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <label className="detail-label">Investment amount (£)</label>
          <input className="detail-input" style={{ maxWidth: '100%' }} value={amt} onChange={(e) => setAmt(e.target.value)} />
          <label className="detail-label">Structure</label>
          <select className="detail-input" style={{ maxWidth: '100%' }} value={structure} onChange={(e) => setStructure(e.target.value)}>
            {STRUCTURES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="detail-label">Expected close date</label>
          <input className="detail-input" style={{ maxWidth: '100%' }} type="date" value={close} onChange={(e) => setClose(e.target.value)} />
        </div>
        <button type="button" className="detail-btn detail-btn--salmon" style={{ marginTop: 16 }} onClick={analyse}>
          Analyse term sheet
        </button>
        {out ? (
          <div className="detail-grid3" style={{ marginTop: 20 }}>
            <div className="detail-stat">
              <p className="detail-stat__cap">Post-close cash</p>
              <p className="detail-stat__val">{formatGBP(out.post)}</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Runway impact</p>
              <p className="detail-stat__val">+{out.mo} mo</p>
            </div>
            <div className="detail-stat">
              <p className="detail-stat__cap">Treasury health</p>
              <p className="detail-stat__val">{out.health}/100</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
