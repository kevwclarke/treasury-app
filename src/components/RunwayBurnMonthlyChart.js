import { useCallback, useMemo, useState } from 'react'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatCompactAxisGBP, formatGBP, formatPct } from '../utils/treasuryFormat'
import './RunwayBurnMonthlyChart.css'

const CAT_COLORS = {
  Payroll: '#1B2B8C',
  Infrastructure: '#374151',
  Contractors: '#4B5563',
  Travel: '#6B7280',
  'Office & Ops': '#9CA3AF',
  Marketing: '#D1D5DB',
  Other: '#E5E7EB',
}

/** Legend order requested (display only). */
const LEGEND_ORDER = [
  'Payroll',
  'Infrastructure',
  'Contractors',
  'Office & Ops',
  'Marketing',
  'Travel',
  'Other',
]

function monthKeyFromIso(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shortMonthFromKey(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short' })
}

function longMonthYearFromKey(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return String(ym)
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

const VB_W = 780
const VB_H = 300
const PAD_L = 52
const PAD_R = 16
const PAD_T = 8
const PAD_B = 44
const PLOT_W = VB_W - PAD_L - PAD_R
const PLOT_H = VB_H - PAD_T - PAD_B
const PLOT_X0 = PAD_L
const PLOT_Y1 = PAD_T + PLOT_H

export function RunwayBurnMonthlyChart({ monthlyTableRows, rows, onExportCsv }) {
  const [tooltip, setTooltip] = useState(null)
  const [drilldown, setDrilldown] = useState(null)

  const maxBar = useMemo(
    () => Math.max(1, ...monthlyTableRows.map((r) => r.total)),
    [monthlyTableRows],
  )

  const avgMonthlyBurn = useMemo(() => {
    if (!monthlyTableRows.length) return 0
    return monthlyTableRows.reduce((s, r) => s + r.total, 0) / monthlyTableRows.length
  }, [monthlyTableRows])

  const maxY = useMemo(() => {
    const m = Math.max(maxBar, avgMonthlyBurn, 1)
    const step = 50_000
    return Math.max(step, Math.ceil(m / step) * step)
  }, [maxBar, avgMonthlyBurn])

  const yTicks = useMemo(() => {
    const out = []
    for (let v = 0; v <= maxY; v += 50_000) out.push(v)
    return out
  }, [maxY])

  const n = monthlyTableRows.length || 1
  const slotW = PLOT_W / n
  const barW = Math.min(20, slotW * 0.42)

  const yScale = useCallback((value) => PLOT_Y1 - (value / maxY) * PLOT_H, [maxY])

  const totalLinePts = useMemo(() => {
    return monthlyTableRows
      .map((r, i) => {
        const cx = PLOT_X0 + i * slotW + slotW / 2
        const y = yScale(r.total)
        return `${cx},${y}`
      })
      .join(' ')
  }, [monthlyTableRows, slotW, yScale])

  const avgY = yScale(avgMonthlyBurn)

  const drillRows = useMemo(() => {
    if (!drilldown || !rows?.length) return []
    return rows
      .filter((t) => {
        if (Number(t.amount) >= 0) return false
        if (monthKeyFromIso(t.date) !== drilldown.monthKey) return false
        return categorisePayee(t.payee) === drilldown.category
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [drilldown, rows])

  const handleSegEnter = useCallback((e, payload) => {
    setTooltip({
      clientX: e.clientX,
      clientY: e.clientY,
      ...payload,
    })
  }, [])

  const handleSegMove = useCallback((e) => {
    setTooltip((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null))
  }, [])

  const handleSegLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const handleSegClick = useCallback((monthKey, category) => {
    setDrilldown((prev) =>
      prev && prev.monthKey === monthKey && prev.category === category ? null : { monthKey, category },
    )
  }, [])

  return (
    <div className="rbc">
      <div className="rbc__header">
        <h3 className="rbc__title">Monthly Burn by Category</h3>
        {typeof onExportCsv === 'function' ? (
          <button type="button" className="detail-btn detail-btn--dark rbc__export" onClick={onExportCsv}>
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="rbc__svgWrap">
        <svg
          className="rbc__svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Monthly burn stacked by category, last twelve months"
          onMouseLeave={() => setTooltip(null)}
        >
          {yTicks.map((v) => {
            const y = yScale(v)
            return (
              <g key={v}>
                <line x1={PLOT_X0} y1={y} x2={PLOT_X0 + PLOT_W} y2={y} stroke="rgba(26,22,20,0.06)" strokeWidth="1" />
                <text x={PLOT_X0 - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6B7280">
                  {formatCompactAxisGBP(v)}
                </text>
              </g>
            )
          })}

          <line
            x1={PLOT_X0}
            y1={avgY}
            x2={PLOT_X0 + PLOT_W}
            y2={avgY}
            stroke="#9CA3AF"
            strokeWidth="1.25"
            strokeDasharray="5 4"
            opacity={0.85}
          />
          <text x={PLOT_X0 + 4} y={avgY - 6} fontSize="9" fontWeight="600" fill="#6B7280">
            Avg {formatGBP(Math.round(avgMonthlyBurn))}/mo
          </text>

          {monthlyTableRows.map((r, i) => {
            const cx = PLOT_X0 + i * slotW + slotW / 2
            const xBar = cx - barW / 2
            let yBottom = PLOT_Y1
            const segs = []
            BURN_CATEGORY_ORDER.forEach((cat) => {
              const amt = r.byCat[cat] || 0
              if (amt <= 0) return
              const h = (amt / maxY) * PLOT_H
              const y = yBottom - h
              const isActive =
                drilldown && drilldown.monthKey === r.key && drilldown.category === cat ? ' rbc__seg--active' : ''
              segs.push(
                <rect
                  key={`${r.key}-${cat}`}
                  className={`rbc__seg${isActive}`}
                  x={xBar}
                  y={y}
                  width={barW}
                  height={Math.max(h, 0.5)}
                  fill={CAT_COLORS[cat] || '#d6d3d1'}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.5"
                  onMouseEnter={(e) =>
                    handleSegEnter(e, {
                      category: cat,
                      amount: amt,
                      pct: r.total ? (amt / r.total) * 100 : 0,
                      monthLabel: shortMonthFromKey(r.key),
                    })
                  }
                  onMouseMove={handleSegMove}
                  onMouseLeave={handleSegLeave}
                  onClick={() => handleSegClick(r.key, cat)}
                />,
              )
              yBottom = y
            })
            return <g key={r.key}>{segs}</g>
          })}

          <polyline
            fill="none"
            stroke="#1B2B8C"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={totalLinePts}
          />

          {monthlyTableRows.map((r, i) => {
            const cx = PLOT_X0 + i * slotW + slotW / 2
            const y = yScale(r.total)
            return <circle key={`dot-${r.key}`} cx={cx} cy={y} r="3.5" fill="#1B2B8C" stroke="#FFFFFF" strokeWidth="1" />
          })}

          {monthlyTableRows.map((r, i) => {
            const cx = PLOT_X0 + i * slotW + slotW / 2
            return (
              <text
                key={`xl-${r.key}`}
                x={cx}
                y={VB_H - 12}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#6B7280"
              >
                {shortMonthFromKey(r.key)}
              </text>
            )
          })}
        </svg>
      </div>

      <div className="rbc__legend" aria-label="Category colours">
        {LEGEND_ORDER.map((name) => (
          <span key={name} className="rbc__legend-item">
            <span className="rbc__legend-swatch" style={{ background: CAT_COLORS[name] }} aria-hidden />
            {name}
          </span>
        ))}
      </div>

      {tooltip ? (
        <div
          className="rbc__tooltip"
          style={{
            left: Math.min(typeof window !== 'undefined' ? window.innerWidth - 200 : 400, tooltip.clientX + 12),
            top: Math.max(12, tooltip.clientY + 12),
          }}
        >
          <strong>{tooltip.category}</strong>
          <div className="rbc__tooltip-month">{tooltip.monthLabel}</div>
          <div>{formatGBP(Math.round(tooltip.amount))}</div>
          <div>{formatPct(tooltip.pct, 1)} of month burn</div>
        </div>
      ) : null}

      {drilldown ? (
        <div className="rbc__drill">
          <div className="rbc__drill-head">
            <p className="rbc__drill-title">
              {drilldown.category} · {longMonthYearFromKey(drilldown.monthKey)}
            </p>
            <button type="button" className="rbc__drill-close" onClick={() => setDrilldown(null)}>
              Close
            </button>
          </div>
          {drillRows.length === 0 ? (
            <p className="detail-muted" style={{ margin: 0 }}>
              No transactions in this slice.
            </p>
          ) : (
            <table className="rbc__drill-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((t) => (
                  <tr key={t.id}>
                    <td>{String(t.date).slice(0, 10)}</td>
                    <td>{t.payee}</td>
                    <td>{formatGBP(Math.round(Math.abs(Number(t.amount))))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
