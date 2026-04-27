import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCompanyProfile } from '../hooks/useCompanyProfile'
import { ConnectBankProvider } from '../context/ConnectBankContext'
import { useTreasuryHealthScore } from '../hooks/useTreasuryHealthScore'
import { SidebarNavIcon } from './SidebarNavIcons'
import { TermTooltip } from './TermTooltip'
import './DashboardLayout.css'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/app', label: 'Dashboard', end: true, icon: 'dashboard' }],
  },
  {
    label: 'Intelligence & actions',
    items: [
      { to: '/app/yield', label: 'Yield Optimisation', icon: 'yield', tooltip: 'yield-gap' },
      { to: '/app/concentration', label: 'Concentration Risk', icon: 'concentration', tooltip: 'concentration-risk' },
      { to: '/app/runway', label: 'Runway & Burn', icon: 'runway', tooltip: 'runway' },
      { to: '/app/burn-intelligence', label: 'Burn Intelligence', tag: 'Growth', icon: 'burn', tooltip: 'priority-actions' },
      { to: '/app/liquidity', label: 'Liquidity Buffer', icon: 'liquidity', tooltip: 'liquidity-buffer' },
      { to: '/app/cashflow', label: 'Cash Flow', icon: 'cashflow', tooltip: 'cash-flow' },
      { to: '/app/fx', label: 'FX Exposure', icon: 'fx' },
      { to: '/app/opportunities', label: 'Opportunities', icon: 'opportunities', tooltip: 'opportunities' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { to: '/app/scenarios', label: 'Scenario Modeller', tag: 'NEW', icon: 'scenario', tooltip: 'scenario-modeller' },
      { to: '/app/benchmarks', label: 'Peer Benchmarks', tag: 'NEW', icon: 'benchmarks', tooltip: 'peer-benchmarks' },
      {
        to: '/app/term-sheet-cash-impact',
        label: 'Term Sheet Analysis',
        tag: 'NEW',
        icon: 'term',
        tooltip: 'term-sheet-analysis',
      },
      { to: '/app/ar', label: 'AR Ageing', icon: 'ar', tooltip: 'ar-ageing' },
      { to: '/app/tax', label: 'Tax Tracker', icon: 'tax', tooltip: 'tax-tracker' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/app/report', label: 'Investor Report', icon: 'report', tooltip: 'investor-report' },
      { to: '/app/fundraise', label: 'Fundraise Timing', icon: 'fundraise', tooltip: 'fundraise-timing' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/app/preferences', label: 'Preferences', icon: 'preferences', tooltip: 'preferences' },
      { to: '/app/integrations', label: 'Integrations', icon: 'integrations', tooltip: 'integrations' },
    ],
  },
]

function initialsFromCompanyName(name) {
  const t = (name || '').trim()
  if (!t) return 'YC'
  const parts = t.split(/\s+/).filter((w) => w.length > 0)
  if (parts.length >= 2) {
    const a = parts[0][0] || ''
    const b = parts[parts.length - 1][0] || ''
    return (a + b).toUpperCase().slice(0, 2)
  }
  return t.slice(0, 2).toUpperCase()
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const { profile, loading: profileLoading } = useCompanyProfile()
  const { score, band, loading: healthLoading } = useTreasuryHealthScore()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const displayName =
    profileLoading ? '…' : profile?.company_name?.trim() ? profile.company_name.trim() : 'Your Company'
  const stageLine =
    profileLoading ? '…' : profile?.funding_stage ? `${profile.funding_stage} · UK` : '—'
  const avatarLetters = profileLoading ? '··' : initialsFromCompanyName(profile?.company_name)

  return (
    <ConnectBankProvider>
      <div className="dashboard">
        <aside className="dashboard__sidebar" aria-label="Main navigation">
          <div className="dashboard__brand">
            <div className="dashboard__brand-row">
              <span className="dashboard__brand-avatar" aria-hidden>
                {avatarLetters}
              </span>
              <div className="dashboard__brand-text">
                <span className="dashboard__brand-name">{displayName}</span>
                <span className="dashboard__brand-stage">{stageLine}</span>
              </div>
            </div>
            <NavLink
              end
              to="/app/profile"
              className={({ isActive }) =>
                ['dashboard__profile-link', isActive ? 'dashboard__profile-link--active' : '']
                  .filter(Boolean)
                  .join(' ')
              }
            >
              Profile
            </NavLink>
            <NavLink
              end
              to="/upload"
              className={({ isActive }) =>
                ['dashboard__upload-link', isActive ? 'dashboard__upload-link--active' : '']
                  .filter(Boolean)
                  .join(' ')
              }
            >
              Upload Bank Statement
            </NavLink>
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
                          <span className="dashboard__nav-link-text">
                            {item.tooltip ? (
                              <TermTooltip term={item.tooltip} label={item.label} />
                            ) : (
                              item.label
                            )}
                          </span>
                        </span>
                        {item.badge ? (
                          <span className="dashboard__nav-badge" aria-label={`${item.badge} alerts`}>
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
            <div
              className={`dashboard__health-pill dashboard__health-pill--${band}`}
              title="Treasury health score from your latest data"
            >
              <span className="dashboard__health-label">Health</span>
              <span className="dashboard__health-num">{healthLoading || !Number.isFinite(score) ? '—' : Math.round(score)}</span>
            </div>
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
    </ConnectBankProvider>
  )
}
