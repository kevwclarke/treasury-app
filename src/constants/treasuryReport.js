/** localStorage: last successful AI actions (for investor PDF page 5). */
export const TREASURY_AI_ACTIONS_CACHE_KEY = 'treasury_ai_actions_cache'

export function getReportCompanyName() {
  const raw = process.env.REACT_APP_COMPANY_NAME
  const s = typeof raw === 'string' ? raw.trim() : ''
  return s || 'Northwind Labs'
}
