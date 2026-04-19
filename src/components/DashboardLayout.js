import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { SidebarNavIcon } from './SidebarNavIcons'
import './DashboardLayout.css'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/app', label: 'Dashboard', end: true, icon: 'dashboard' },
      { to: '/upload', label: 'Upload Statement', icon: 'upload' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/yield', label: 'Yield Optimisation', badge: '3', icon: 'yield' },
      { to: '/app/concentration', label: 'Concentration Risk', icon: 'concentration' },
      { to: '/app/runway', label: 'Runway & Burn', icon: 'runway' },
      { to: '/app/cashflow', label: 'Cash Flow', icon: 'cashflow' },
      { to: '/app/fx', label: 'FX Exposure', icon: 'fx' },
      { to: '/app/opportunities', label: 'Opportunities', icon: 'opportunities' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { to: '/app/scenarios', label: 'Scenario Modeller', tag: 'NEW', icon: 'scenario' },
      { to: '/app/benchmarks', label: 'Peer Benchmarks', tag: 'NEW', icon: 'benchmarks' },
      { to: '/app/term-sheet-cash-impact', label: 'Term Sheet Cash Impact', tag: 'NEW', icon: 'term' },
      { to: '/app/ar', label: 'AR Ageing', icon: 'ar' },
      { to: '/app/tax', label: 'Tax Tracker', icon: 'tax' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/app/report', label: 'Investor Report', icon: 'report' },
      { to: '/app/fundraise', label: 'Fundraise Timing', icon: 'fundraise' },
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
          <div className="dashboard__brand-row">
            <span className="dashboard__brand-avatar" aria-hidden>
              NL
            </span>
            <div className="dashboard__brand-text">
              <span className="dashboard__brand-name">Northwind Labs</span>
              <span className="dashboard__brand-stage">Series B · UK</span>
            </div>
          </div>
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
                      <span className="dashboard__nav-link-inner">
                        <span className="dashboard__nav-icon">
                          <SidebarNavIcon name={item.icon} />
                        </span>
                        <span className="dashboard__nav-link-text">{item.label}</span>
                      </span>
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
