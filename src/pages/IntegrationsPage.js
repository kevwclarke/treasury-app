import { Link } from 'react-router-dom'
import { useConnectBankModal } from '../context/ConnectBankContext'
import '../components/DetailPage.css'
import './IntegrationsPage.css'

function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`int-badge int-badge--${tone}`}>{children}</span>
}

function IntegrationCard({ name, status, tone, description, footer }) {
  return (
    <article className="int-card">
      <div className="int-card__logo" aria-hidden>
        {name.slice(0, 1)}
      </div>
      <div className="int-card__body">
        <div className="int-card__head">
          <h2 className="int-card__title">{name}</h2>
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </div>
        <p className="int-card__desc">{description}</p>
        {footer}
      </div>
    </article>
  )
}

export function IntegrationsPage() {
  const { openConnectBankModal } = useConnectBankModal()

  return (
    <div className="detail-page int-page">
      <header className="detail-hero">
        <h1 className="detail-title">Integrations</h1>
        <p className="detail-sub">Connect accounting, banking, and Slack for richer automation.</p>
      </header>

      <div className="int-list">
        <IntegrationCard
          name="Xero"
          status="Coming soon"
          tone="amber"
          description="Connect your accounting software. Unlocks AR Ageing, Tax Tracker, and dramatically improves Cash Flow Forecast."
          footer={
            <button type="button" className="int-btn int-btn--disabled" disabled>
              Connect
            </button>
          }
        />
        <IntegrationCard
          name="TrueLayer Open Banking"
          status="Coming soon"
          tone="amber"
          description="Connect your bank directly — no CSV uploads needed. FCA registration in progress."
          footer={
            <button type="button" className="int-btn" onClick={openConnectBankModal}>
              Connect Bank
            </button>
          }
        />
        <IntegrationCard
          name="Slack"
          status="Connect"
          tone="green"
          description="Get Capital Moves and burn spike alerts in Slack."
          footer={
            <p className="int-card__foot">
              Add your incoming webhook in{' '}
              <Link to="/app/preferences#notifications">Preferences</Link>.
            </p>
          }
        />
      </div>
    </div>
  )
}
