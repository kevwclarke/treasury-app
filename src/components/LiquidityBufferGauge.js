import './LiquidityBufferGauge.css'

const SCALE_MONTHS = 6

const STROKE = {
  red: '#b42318',
  amber: '#b45309',
  green: '#2d6a4f',
}

/**
 * Ring gauge: 0–6 months on the circle; ticks at 3 mo (minimum) and 6 mo (target);
 * coloured arc to current buffer (capped at full ring); band sets arc colour.
 */
export function LiquidityBufferGauge({
  bufferMonths,
  band = 'amber',
  size = 80,
  className = '',
}) {
  const scale = SCALE_MONTHS
  const r = (size / 80) * 34
  const cx = size / 2
  const cy = size / 2
  const c = 2 * Math.PI * r
  const noBurn = bufferMonths == null || !Number.isFinite(bufferMonths)
  const displayMo = !noBurn && Number.isFinite(bufferMonths) ? bufferMonths : null
  const moForArc = noBurn ? scale : Math.max(0, bufferMonths ?? 0)
  const arcFrac = noBurn ? 1 : Math.min(1, moForArc / scale)
  const dash = `${arcFrac * c} ${c}`
  const stroke = STROKE[band] ?? STROKE.amber

  const polar = (monthVal) => {
    const frac = Math.min(1, Math.max(0, monthVal / scale))
    const th = -Math.PI / 2 + frac * 2 * Math.PI
    return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) }
  }
  const tick3 = polar(3)
  const tick6 = polar(6)

  const centreLabel =
    displayMo != null
      ? displayMo.toLocaleString('en-GB', { maximumFractionDigits: 1 })
      : noBurn
        ? '∞'
        : '—'

  const ariaLabel =
    displayMo != null
      ? `Liquidity buffer ${displayMo.toFixed(1)} months of coverage`
      : noBurn
        ? 'Liquidity buffer: no outflows in the last 90 days'
        : 'Liquidity buffer'

  return (
    <svg
      className={`liq-gauge ${className}`.trim()}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(26,22,20,0.08)"
        strokeWidth={(size / 80) * 8}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={(size / 80) * 8}
        strokeDasharray={dash}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <circle cx={tick3.x} cy={tick3.y} r={3.25 * (size / 80)} fill="#78716c" opacity={0.95} />
      <circle cx={tick6.x} cy={tick6.y} r={3.25 * (size / 80)} fill="#1c1917" opacity={0.45} />
      {arcFrac > 0.02 ? (
        <circle
          cx={polar(Math.min(moForArc, scale)).x}
          cy={polar(Math.min(moForArc, scale)).y}
          r={3.5 * (size / 80)}
          fill="#fafaf9"
          stroke={stroke}
          strokeWidth={1.25 * (size / 80)}
        />
      ) : null}
      <text
        x={cx}
        y={cy - 4 * (size / 80)}
        textAnchor="middle"
        className="liq-gauge__val"
        fontSize={20 * (size / 80)}
        fontWeight={600}
        fill="#1a1614"
        fontFamily="var(--td-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif)"
      >
        {centreLabel}
      </text>
      <text
        x={cx}
        y={cy + 10 * (size / 80)}
        textAnchor="middle"
        className="liq-gauge__cap"
        fontSize={8 * (size / 80)}
        fontWeight={600}
        letterSpacing="0.1em"
        fill="#78716c"
      >
        months
      </text>
    </svg>
  )
}
