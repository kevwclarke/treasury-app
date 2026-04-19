import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import './DashboardLayout.css'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/app', label: 'Dashboard', end: true }],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/yield-optimisation', label: 'Yield Optimisation', badge: '3' },
      { to: '/app/concentration-risk', label: 'Concentration Risk' },
      { to: '/app/runway-burn', label: 'Runway & Burn' },
      { to: '/app/cash-flow', label: 'Cash Flow' },
      { to: '/app/fx-exposure', label: 'FX Exposure' },
      { to: '/app/opportunities', label: 'Opportunities' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { to: '/app/scenario-modeller', label: 'Scenario Modeller', tag: 'NEW' },
      { to: '/app/peer-benchmarks', label: 'Peer Benchmarks', tag: 'NEW' },
      { to: '/app/term-sheet-cash-impact', label: 'Term Sheet Cash Impact', tag: 'NEW' },
      { to: '/app/ar-ageing', label: 'AR Ageing' },
      { to: '/app/tax-tracker', label: 'Tax Tracker' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/app/investor-report', label: 'Investor Report' },
      { to: '/app/fundraise-timing', label: 'Fundraise Timing' },
    ],
  },
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
          <span className="dashboard__brand-name">Northwind Labs</span>
          <span className="dashboard__brand-stage">Series B · UK</span>
          <p className="dashboard__sync">
            <span className="dashboard__sync-dot" aria-hidden />
            Synced 12 min ago
          </p>
        </div>

        <nav className="dashboard__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="dashboard__nav-section">
              <p className="dashboard__nav-heading">{section.label}</p>
              <ul className="dashboard__nav-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        [
                          'dashboard__nav-link',
                          isActive ? 'dashboard__nav-link--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                      }
                    >
                      <span className="dashboard__nav-link-text">{item.label}</span>
                      {item.badge ? (
                        <span className="dashboard__nav-badge" aria-label="3 alerts">
                          {item.badge}
                        </span>
                      ) : null}
                      {item.tag ? <span className="dashboard__nav-tag">{item.tag}</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
