import { Link } from 'react-router-dom'
import { TreasuryControlPanel } from '../components/TreasuryControlPanel'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { useTreasuryAutopilotPolicy } from '../hooks/useTreasuryAutopilotPolicy'
import '../components/TreasuryDashboard.css'
import '../components/TreasuryControlPanel.css'

export function CashControlPage() {
  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()
  const autopilot = useTreasuryAutopilotPolicy()

  return (
    <div className="tdash">
      <header className="tdash__topbar">
        <div className="tdash__title-block">
          <h1 className="tdash__page-title">Cash Control</h1>
          <p className="tcp-page__sub">Runway, yield, and FX in one focused stack</p>
        </div>
        <div className="tdash__topbar-actions">
          <Link className="tdash__card-link" to="/app">
            Full Treasury Autopilot
          </Link>
        </div>
      </header>
      <TreasuryControlPanel
        txnLoading={txnLoading}
        txnError={txnError}
        txnRows={txnRows}
        autopilot={autopilot}
      />
    </div>
  )
}
