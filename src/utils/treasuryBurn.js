export const BURN_CATEGORY_ORDER = [
  'Payroll',
  'Infrastructure',
  'Contractors',
  'Travel',
  'Office & Ops',
  'Marketing',
  'Other',
]

export function categorisePayee(payeeRaw) {
  const p = String(payeeRaw ?? '').toLowerCase()
  const hasAny = (terms) => terms.some((t) => p.includes(t))

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
