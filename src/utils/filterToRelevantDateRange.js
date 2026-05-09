/**
 * @param {string|undefined} iso
 * @returns {Date | null}
 */
function parseDateDDMMYYYY(iso) {
  if (!iso) return null
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(iso))) {
    const [dd, mm, yyyy] = String(iso).split('/')
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Keep rows in six calendar months ending at the mode month (month with the most transactions).
 * Stale sparse months after the bulk upload (e.g. a few May rows vs many April rows) fall outside the window.
 * @param {Array<{ date?: string }>} rows
 * @returns {Array<*>}
 */
export function filterToRelevantDateRange(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return list

  const monthCounts = {}
  list.forEach((r) => {
    const d = parseDateDDMMYYYY(r.date)
    if (!d) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthCounts[key] = (monthCounts[key] || 0) + 1
  })
  const modeMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!modeMonth) return list

  const [y, m] = modeMonth.split('-').map(Number)
  const endDate = new Date(y, m, 0, 23, 59, 59, 999)
  const startDate = new Date(y, m - 6, 1, 0, 0, 0, 0)

  return list.filter((r) => {
    const d = parseDateDDMMYYYY(r.date)
    if (!d) return false
    return d >= startDate && d <= endDate
  })
}
