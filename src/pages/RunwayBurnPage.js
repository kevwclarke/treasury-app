import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserTransactions } from '../hooks/useUserTransactions'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatGBP } from '../utils/treasuryFormat'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { RunwayBurnMonthlyChart } from '../components/RunwayBurnMonthlyChart'
import '../components/DetailPage.css'

function monthKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function last12MonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

export function RunwayBurnPage() {
  const { rows, loading, error } = useUserTransactions()
  const [expanded, setExpanded] = useState(null)
  const [burnMult, setBurnMult] = useState(0)
  const [hires, setHires] = useState(0)
  const [hireSalary, setHireSalary] = useState(85_000)
  const [arrK, setArrK] = useState(0)
  const [oneOff, setOneOff] = useState(0)

  const totalCash = useMemo(
    () => rows.reduce((s, t) => s + (Number.isFinite(Number(t.amount)) ? Number(t.amount) : 0), 0),
    [rows],
  )

  const runwayCore = useMemo(() => computeRunwayFromTransactions(rows), [rows])
  const monthlyBurnBase = runwayCore.monthlyBurn > 0 ? runwayCore.monthlyBurn : 1

  const monthKeys = useMemo(() => last12MonthKeys(), [])
  const monthlyByMonth = useMemo(() => {
    const m = Object.fromEntries(monthKeys.map((k) => [k, { total: 0, byCat: Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0])) }]))
    rows.forEach((t) => {
      const a = Number(t.amount)
      if (!Number.isFinite(a) || a >= 0) return
      const k = monthKey(t.date)
      if (!k || !m[k]) return
      const spend = Math.abs(a)
      const cat = categorisePayee(t.payee)
      m[k].total += spend
      m[k].byCat[cat] += spend
    })
    return m
  }, [rows, monthKeys])

  const categoryRollup = useMemo(() => {
    const lastM = monthKeys[11]
    const threeM = monthKeys.slice(-3)
    const sixM = monthKeys.slice(-6)
    const sumRange = (keys) => {
      const byCat = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
      let t = 0
      keys.forEach((k) => {
        const cell = monthlyByMonth[k]
        if (!cell) return
        BURN_CATEGORY_ORDER.forEach((c) => {
          byCat[c] += cell.byCat[c] || 0
        })
        t += cell.total
      })
      return { byCat, total: t }
    }
    const lm = monthlyByMonth[lastM] || { byCat: {}, total: 0 }
    const a3 = sumRange(threeM)
    const a6 = sumRange(sixM)
    return BURN_CATEGORY_ORDER.map((c) => ({
      name: c,
      lastMonth: lm.byCat[c] || 0,
      avg3: threeM.length ? a3.byCat[c] / threeM.length : 0,
      avg6: sixM.length ? a6.byCat[c] / sixM.length : 0,
      trend: (lm.byCat[c] || 0) >= (a3.byCat[c] / 3 || 0) ? 'up' : 'down',
    }))
  }, [monthKeys, monthlyByMonth])

  const modelledRunway = useMemo(() => {
    const burnAdj = monthlyBurnBase * (1 + burnMult / 100) + hires * (hireSalary / 12) - arrK * 1000
    const burn = Math.max(40_000, burnAdj) + oneOff / 12
    return Math.max(0, totalCash / burn)
  }, [monthlyBurnBase, burnMult, hires, hireSalary, arrK, oneOff, totalCash])

  const monthlyTableRows = useMemo(
    () =>
      monthKeys.map((k) => {
        const cell = monthlyByMonth[k] || { total: 0, byCat: {} }
        return { key: k, ...cell }
      }),
    [monthKeys, monthlyByMonth],
  )

  const exportCsv = useCallback(() => {
    const headers = ['Month', 'Total', ...BURN_CATEGORY_ORDER, 'MoM %']
    const lines = [headers.join(',')]
    monthlyTableRows.forEach((r, idx) => {
      const prev = monthlyTableRows[idx - 1]
      const mom = prev && prev.total ? (((r.total - prev.total) / prev.total) * 100).toFixed(1) : ''
      lines.push(
        [r.key, Math.round(r.total), ...BURN_CATEGORY_ORDER.map((c) => Math.round(r.byCat[c] || 0)), mom].join(','),
      )
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'monthly-burn.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [monthlyTableRows])

  return (
    <div className="detail-page">
      <header className="detail-hero">
        <h1 className="detail-title">Runway & Burn</h1>
        <p className="detail-sub">Survival timeline and spend intelligence</p>
      </header>

      <section className="detail-section">
        <h2 className="detail-section__title">Runway scenarios</h2>
        {loading ? (
          <p className="detail-muted">Loading transactions…</p>
        ) : !rows.length ? (
          <>
            <p className="detail-section__lead">
              Upload a bank CSV so we can sum cash, average monthly outflows across your date range, and plot bear /
              base / bull runway.
            </p>
            <Link className="detail-btn detail-btn--dark" to="/upload" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
              Upload statement
            </Link>
          </>
        ) : runwayCore.baseRunwayMo == null || !Number.isFinite(runwayCore.baseRunwayMo) ? (
          <p className="detail-muted">No outflows found in your import — add debits or check column mapping.</p>
        ) : (
          <>
            <p className="detail-section__lead" style={{ marginBottom: '0.75rem' }}>
              Net cash <strong>{formatGBP(Math.round(runwayCore.totalCash))}</strong> · avg monthly burn{' '}
              <strong>{formatGBP(Math.round(runwayCore.monthlyBurn))}</strong> (
              {runwayCore.totalOutflows > 0 ? formatGBP(Math.round(runwayCore.totalOutflows)) : '£0'} outflows ÷{' '}
              {runwayCore.months} mo in file)
            </p>
            <div className="detail-grid3">
              <div
                className="detail-stat"
                style={{ borderColor: 'rgba(180,35,24,0.2)', background: 'rgba(180,35,24,0.05)' }}
              >
                <p className="detail-stat__cap" style={{ color: '#b42318' }}>
                  Bear
                </p>
                <p className="detail-stat__val text-red">
                  {runwayCore.bearRunwayMo != null ? runwayCore.bearRunwayMo.toFixed(1) : '—'} mo
                </p>
                <p className="detail-muted">+15% burn vs base</p>
              </div>
              <div
                className="detail-stat"
                style={{ borderColor: 'rgba(194,120,3,0.3)', background: 'rgba(194,120,3,0.08)' }}
              >
                <p className="detail-stat__cap" style={{ color: '#92400e' }}>
                  Base
                </p>
                <p className="detail-stat__val" style={{ color: '#c27803' }}>
                  {runwayCore.baseRunwayMo.toFixed(1)} mo
                </p>
                <p className="detail-muted">Current trajectory</p>
              </div>
              <div
                className="detail-stat"
                style={{ borderColor: 'rgba(45,106,79,0.25)', background: 'rgba(45,106,79,0.07)' }}
              >
                <p className="detail-stat__cap" style={{ color: '#2d6a4f' }}>
                  Bull
                </p>
                <p className="detail-stat__val detail-stat__val--green">
                  {runwayCore.bullRunwayMo != null ? runwayCore.bullRunwayMo.toFixed(1) : '—'} mo
                </p>
                <p className="detail-muted">Yield optimised (+{formatGBP(Math.round(runwayCore.monthlyOppCost))}/mo to cash)</p>
              </div>
            </div>
            <div style={{ marginTop: '1.25rem', position: 'relative', height: '2.75rem' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '55%',
                  height: 4,
                  marginTop: -2,
                  background: 'rgba(28,25,23,0.08)',
                  borderRadius: 999,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '55%',
                  width: `${Math.min(100, (runwayCore.baseRunwayMo / 24) * 100)}%`,
                  maxWidth: '100%',
                  height: 4,
                  marginTop: -2,
                  background: 'linear-gradient(90deg, #c4704f, #c27803)',
                  borderRadius: 999,
                }}
              />
              {['Now', '6mo', '12mo', '18mo', '24mo'].map((lab, i) => (
                <span
                  key={lab}
                  style={{
                    position: 'absolute',
                    left: `${(i / 4) * 100}%`,
                    transform: 'translateX(-50%)',
                    top: 0,
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: lab === '18mo' ? '#c27803' : '#57534e',
                  }}
                >
                  {lab}
                  {lab === '18mo' ? ' · fundraise' : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="detail-section">
        <p className="detail-section__lead" style={{ marginBottom: '0.35rem' }}>
          Where your cash is going, month by month
        </p>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : error ? (
          <p className="detail-warn detail-warn--red">{error}</p>
        ) : !rows.length ? (
          <p className="detail-muted">
            Upload a CSV to see monthly burn by category.{' '}
            <Link to="/upload" style={{ color: '#c4704f', fontWeight: 600 }}>
              Upload statement
            </Link>
          </p>
        ) : (
          <RunwayBurnMonthlyChart monthlyTableRows={monthlyTableRows} rows={rows} onExportCsv={exportCsv} />
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Burn Rate Breakdown</h2>
        <p className="detail-section__lead">Where your cash is going, month by month</p>
        <table className="detail-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Last month</th>
              <th>3 mo avg</th>
              <th>6 mo avg</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {categoryRollup.flatMap((c) => {
              const head = (
                <tr
                  key={c.name}
                  onClick={() => setExpanded((e) => (e === c.name ? null : c.name))}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{formatGBP(Math.round(c.lastMonth))}</td>
                  <td>{formatGBP(Math.round(c.avg3))}</td>
                  <td>{formatGBP(Math.round(c.avg6))}</td>
                  <td>{c.trend === 'up' ? '↗' : '↘'}</td>
                </tr>
              )
              if (expanded !== c.name) return [head]
              const txRows = rows
                .filter((t) => Number(t.amount) < 0 && categorisePayee(t.payee) === c.name)
                .slice(0, 40)
                .map((t) => (
                  <tr key={`${c.name}-${t.id}`} style={{ background: 'rgba(28,25,23,0.03)' }}>
                    <td colSpan={5} style={{ fontSize: 12, paddingLeft: 24 }}>
                      {String(t.date).slice(0, 10)} · {t.payee} · {formatGBP(Math.abs(Number(t.amount)))}
                    </td>
                  </tr>
                ))
              return [head, ...txRows]
            })}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Scenario modeller</h2>
        <p className="detail-section__lead">Runway updates from your imported cash position and trailing burn.</p>
        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <label className="detail-label">Burn rate change ({burnMult}%)</label>
          <input type="range" min={-50} max={100} value={burnMult} onChange={(e) => setBurnMult(Number(e.target.value))} />
          <label className="detail-label">New hires ({hires})</label>
          <input type="range" min={0} max={20} value={hires} onChange={(e) => setHires(Number(e.target.value))} />
          <label className="detail-label">Avg salary per hire (£{hireSalary.toLocaleString('en-GB')})</label>
          <input
            type="range"
            min={40000}
            max={180000}
            step={5000}
            value={hireSalary}
            onChange={(e) => setHireSalary(Number(e.target.value))}
          />
          <label className="detail-label">New ARR closed / month (£{arrK}k)</label>
          <input type="range" min={0} max={500} value={arrK} onChange={(e) => setArrK(Number(e.target.value))} />
          <label className="detail-label">One-off costs (£{oneOff.toLocaleString('en-GB')})</label>
          <input type="range" min={0} max={2000000} step={25000} value={oneOff} onChange={(e) => setOneOff(Number(e.target.value))} />
        </div>
        <div className="detail-grid3">
          <div className="detail-stat">
            <p className="detail-stat__cap">Modelled runway</p>
            <p className="detail-stat__val">{modelledRunway.toFixed(1)} mo</p>
          </div>
        </div>
        <button type="button" className="detail-btn" onClick={() => { setBurnMult(0); setHires(0); setArrK(0); setOneOff(0) }}>
          Reset
        </button>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Monthly burn table</h2>
        <button type="button" className="detail-btn detail-btn--dark" style={{ marginBottom: 12 }} onClick={exportCsv}>
          Export to CSV
        </button>
        <div style={{ overflowX: 'auto' }}>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Total</th>
                {BURN_CATEGORY_ORDER.map((c) => (
                  <th key={c}>{c.slice(0, 4)}</th>
                ))}
                <th>MoM %</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTableRows.map((r, idx) => {
                const prev = monthlyTableRows[idx - 1]
                const mom = prev && prev.total ? (((r.total - prev.total) / prev.total) * 100).toFixed(1) : '—'
                return (
                  <tr key={r.key}>
                    <td>{r.key}</td>
                    <td>{formatGBP(Math.round(r.total))}</td>
                    {BURN_CATEGORY_ORDER.map((c) => (
                      <td key={c}>{formatGBP(Math.round(r.byCat[c] || 0))}</td>
                    ))}
                    <td>{mom}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
