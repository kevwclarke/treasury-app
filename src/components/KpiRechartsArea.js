import { useId, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactAxisGBP, formatGBP, formatPct } from '../utils/treasuryFormat'
import './KpiRechartsArea.css'

const CHART_HEIGHT = 88

function linearTicks(min, max, count = 4) {
  const lo = Number(min)
  const hi = Number(max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1, 2, 3]
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.08 || 0.01
    return linearTicks(lo - pad, hi + pad, count)
  }
  const step = (hi - lo) / (count - 1)
  return Array.from({ length: count }, (_, i) => lo + step * i)
}

function formatTooltipValue(variant, v) {
  if (variant === 'cash' || variant === 'burn') return formatGBP(Math.round(v))
  if (variant === 'runway') return `${Number(v).toFixed(1)} months`
  if (variant === 'yield') return formatPct(Number(v), 2)
  return String(v)
}

function formatYTick(variant, v) {
  if (variant === 'cash' || variant === 'burn') {
    const s = formatCompactAxisGBP(v)
    return v < 0 ? `-${s}` : s
  }
  if (variant === 'runway') {
    if (Math.abs(v) >= 10) return `${Math.round(v)} mo`
    return `${v.toFixed(1)} mo`
  }
  if (variant === 'yield') return formatPct(v, 2)
  return String(v)
}

function TooltipContent({ active, payload, variant }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="tdash__kpi-tooltip">
      <p className="tdash__kpi-tooltip__month">{row.tooltipLabel}</p>
      <p className="tdash__kpi-tooltip__value">{formatTooltipValue(variant, row.value)}</p>
    </div>
  )
}

/**
 * @param {{
 *   variant: 'cash' | 'yield' | 'runway' | 'burn',
 *   data: Array<{ xLabel: string, tooltipLabel: string, value: number }> | null,
 *   stroke: string,
 * }} props
 */
export function KpiRechartsArea({ variant, data, stroke = '#0f0f0f' }) {
  const rawId = useId()
  const gradId = useMemo(() => `kpi-grad-${rawId.replace(/:/g, '')}`, [rawId])

  const { chartData, yTicks, yDomain } = useMemo(() => {
    if (!data?.length) {
      return { chartData: [], yTicks: [0, 1, 2, 3], yDomain: [0, 1] }
    }
    const vals = data.map((d) => d.value)
    const vmin = Math.min(...vals)
    const vmax = Math.max(...vals)
    const ticks = linearTicks(vmin, vmax, 4)
    const pad = (ticks[ticks.length - 1] - ticks[0]) * 0.06 || 0.01
    const domain = [ticks[0] - pad, ticks[ticks.length - 1] + pad]
    return { chartData: data, yTicks: ticks, yDomain: domain }
  }, [data])

  if (!data?.length) {
    return (
      <div className="tdash__kpi-chart tdash__kpi-chart--empty" aria-hidden>
        <div className="tdash__kpi-chart__empty-inner" />
      </div>
    )
  }

  return (
    <div className="tdash__kpi-chart">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ece8e4" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="xLabel"
            tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(26,22,20,0.12)' }}
            interval={0}
            height={28}
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={(v) => formatYTick(variant, v)}
            tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(26,22,20,0.12)' }}
            width={variant === 'runway' ? 48 : 52}
          />
          <Tooltip
            cursor={{ stroke, strokeOpacity: 0.25, strokeWidth: 1 }}
            content={(tipProps) => <TooltipContent {...tipProps} variant={variant} />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            activeDot={{ r: 5, strokeWidth: 2, fill: '#fff', stroke }}
            dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
