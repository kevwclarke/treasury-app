export const BURN_CATEGORY_ORDER = [
  'Payroll',
  'Infrastructure',
  'Contractors',
  'Travel',
  'Office & Ops',
  'Marketing',
  'Capital',
  'Legal',
  'Professional Services',
  'Culture',
  'People',
  'Other',
]

function rowMonthKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function categorisePayee(payeeRaw) {
  const p = String(payeeRaw ?? '').toLowerCase()
  const hasAny = (terms) => terms.some((t) => p.includes(t))

  if (hasAny(['bacs employer', 'employer costs', 'employer ni', 'employer pension', 'bacs payroll'])) return 'Payroll'
  if (hasAny(['strategic initiative', 'strategic reserve'])) return 'Capital'
  if (hasAny(['annual software', 'software commitment', 'annual licence'])) return 'Infrastructure'
  if (hasAny(['taylor wessing', 'legal fees'])) return 'Legal'
  if (hasAny(['accountancy'])) return 'Professional Services'
  if (hasAny(['recruitment fee', 'talent co'])) return 'People'
  if (hasAny(['conference', 'sponsorship'])) return 'Marketing'
  if (hasAny(['team event', 'christmas'])) return 'Culture'

  if (hasAny(['wages', 'salary', 'payroll', 'deel', 'rippling'])) return 'Payroll'
  if (hasAny(['aws', 'google cloud', 'azure', 'hosting', 'vercel', 'supabase'])) return 'Infrastructure'
  if (hasAny(['contractor', 'freelance', 'consultant'])) return 'Contractors'
  if (
    hasAny([
      'taxi',
      'uber',
      'lyft',
      'sumup',
      'train',
      'subway',
      'tube',
      'rail',
      'flight',
      'airline',
      'hotel',
      'presto',
      'transport',
      'transit',
      'tfl',
    ])
  )
    return 'Travel'
  if (hasAny(['rent', 'utilities', 'office', 'vodafone', 'phone', 'wifi', 'broadband'])) return 'Office & Ops'
  if (hasAny(['ads', 'marketing', 'google ads', 'meta'])) return 'Marketing'

  return 'Other'
}

/** Sum of absolute outflows for one category in a given YYYY-MM. */
export function categoryOutflowSpendInMonth(rows, ym, categoryName) {
  const list = Array.isArray(rows) ? rows : []
  let s = 0
  for (const r of list) {
    if (rowMonthKey(r.date) !== ym) continue
    const a = Number(r.amount)
    if (!Number.isFinite(a) || a >= 0) continue
    if (categorisePayee(r.payee) === categoryName) s += Math.abs(a)
  }
  return s
}

/**
 * Latest two calendar months used for MoM trend: prefer months strictly before the current month
 * (complete months); if fewer than two exist, fall back to the last two months with any outflow.
 */
export function getLatestTwoCompleteMonthKeys(rows) {
  const list = Array.isArray(rows) ? rows : []
  const today = new Date()
  const curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const keys = new Set()
  for (const r of list) {
    const k = rowMonthKey(r.date)
    if (!k) continue
    const a = Number(r.amount)
    if (!Number.isFinite(a) || a >= 0) continue
    keys.add(k)
  }
  const sorted = [...keys].sort()
  const complete = sorted.filter((k) => k < curYm)
  if (complete.length >= 2) {
    return { prevYm: complete[complete.length - 2], thisYm: complete[complete.length - 1] }
  }
  if (sorted.length >= 2) {
    return { prevYm: sorted[sorted.length - 2], thisYm: sorted[sorted.length - 1] }
  }
  if (sorted.length === 1) return { prevYm: null, thisYm: sorted[0] }
  return { prevYm: null, thisYm: null }
}

/** MoM spend trend label for burn UI (↑ n% / ↓ n% / → Stable). */
export function burnCategoryMomTrend(rows, categoryName) {
  const { prevYm, thisYm } = getLatestTwoCompleteMonthKeys(rows)
  if (!thisYm) return { text: '→ Stable', color: '#9CA3AF' }
  const prevSpend = prevYm ? categoryOutflowSpendInMonth(rows, prevYm, categoryName) : 0
  const thisSpend = categoryOutflowSpendInMonth(rows, thisYm, categoryName)
  if (prevSpend <= 0 && thisSpend <= 0) return { text: '→ Stable', color: '#9CA3AF' }
  if (prevSpend <= 0 && thisSpend > 0) return { text: '↑ New', color: '#DC2626' }
  if (thisSpend > prevSpend * 1.05) {
    const pct = Math.round(((thisSpend - prevSpend) / prevSpend) * 100)
    return { text: `↑ ${pct}%`, color: '#DC2626' }
  }
  if (thisSpend < prevSpend * 0.95) {
    const pct = Math.round(((prevSpend - thisSpend) / prevSpend) * 100)
    return { text: `↓ ${pct}%`, color: '#16A34A' }
  }
  return { text: '→ Stable', color: '#9CA3AF' }
}
