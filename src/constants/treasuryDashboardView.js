export const TREASURY_DASHBOARD_VIEW_KEY = 'treasury_dashboard_view_mode'
export const TREASURY_VIEW_FULL = 'full'
export const TREASURY_VIEW_CONTROL = 'control'

export function readTreasuryDashboardView() {
  try {
    const v = window.localStorage.getItem(TREASURY_DASHBOARD_VIEW_KEY)
    return v === TREASURY_VIEW_CONTROL ? TREASURY_VIEW_CONTROL : TREASURY_VIEW_FULL
  } catch {
    return TREASURY_VIEW_FULL
  }
}

export function writeTreasuryDashboardView(mode) {
  try {
    window.localStorage.setItem(TREASURY_DASHBOARD_VIEW_KEY, mode)
  } catch {
    /* ignore */
  }
}
