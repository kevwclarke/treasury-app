import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import './DashboardLayout.css'

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/yield-optimisation', label: 'Yield Optimisation' },
  { to: '/app/concentration-risk', label: 'Concentration Risk' },
  { to: '/app/runway-burn', label: 'Runway & Burn' },
  { to: '/app/cash-flow', label: 'Cash Flow' },
  { to: '/app/fx-exposure', label: 'FX Exposure' },
  { to: '/app/opportunities', label: 'Opportunities' },
]

export function DashboardLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="dashboard">
      <aside className="dashboard__sidebar" aria-label="Main navigation">
        <div className="dashboard__brand">
          <span className="dashboard__brand-name">Treasury</span>
          <span className="dashboard__brand-tag">Intelligence</span>
        </div>

        <nav className="dashboard__nav">
          <ul className="dashboard__nav-list">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    isActive ? 'dashboard__nav-link dashboard__nav-link--active' : 'dashboard__nav-link'
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="dashboard__sidebar-footer">
          <button type="button" className="dashboard__logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="dashboard__main">
        <div className="dashboard__content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
