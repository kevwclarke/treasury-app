import { Link } from 'react-router-dom'
import '../components/DetailPage.css'
import './TermsOfServicePage.css'

export function TermsOfServicePage() {
  return (
    <div className="detail-page terms-page">
      <header className="detail-hero">
        <h1 className="detail-title">Terms of Service</h1>
        <p className="detail-sub">Formal terms for Treasury Autopilot are being finalised. Until published here, use of the product is governed by your agreement with us and UK law.</p>
        <p className="detail-section__lead" style={{ marginTop: '1rem' }}>
          Questions? See our <Link to="/privacy">Privacy Policy</Link> or contact us from the footer on the home page.
        </p>
      </header>
    </div>
  )
}
