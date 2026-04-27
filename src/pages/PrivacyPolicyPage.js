import { Link } from 'react-router-dom'
import { getPrivacyContactEmail } from '../constants/privacyContact'
import './PrivacyPolicyPage.css'

const SECTIONS = [
  {
    title: 'What we collect',
    body: [
      '**Account:** your email address when you sign up or request early access (if you choose to provide it).',
      '**Treasury data:** bank transaction data that you upload (for example CSV bank statements), including dates, amounts, payee or description text, running balances where present, and the institution you select at import.',
    ],
  },
  {
    title: 'How we store it',
    body: [
      'Data is stored in **Supabase** (PostgreSQL) in the **European Union**, with encryption in transit (TLS) and at rest according to Supabase’s infrastructure practices.',
      'Authentication is handled by Supabase Auth; we do not store your password in plain text.',
    ],
  },
  {
    title: 'Why we collect it',
    body: [
      'We process this information **only to operate Treasury Autopilot** inside the product: yield gap, concentration, runway, burn, forecasts, autopilot recommendations, and related insights and exports you request.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      '**We do not sell your data.** We do not share your email or transaction data with advertisers or data brokers.',
      'Infrastructure providers (Supabase, and our hosting provider) process data solely to run the service, under appropriate agreements.',
      'If you use **capital moves** (data-driven), relevant **non-secret** metrics derived from your data may be sent to **Anthropic** to generate suggestions; we do not send your Supabase credentials. Do not put API keys intended for server-only use in client-side environment variables.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We retain your data **until you delete your account** (or until you delete specific content where the product allows it), after which we delete or anonymise it in line with our processors’ capabilities and legal obligations.',
    ],
  },
  {
    title: 'Your rights (GDPR)',
    body: [
      'If UK / EU data protection law applies, you may have the right to **access**, **rectify**, **erase**, **restrict** processing, **object**, and **data portability** in respect of personal data we hold about you.',
      'You may also lodge a complaint with your local supervisory authority.',
    ],
  },
  {
    title: 'Contact',
    body: [],
  },
]

function RichLine({ text }) {
  const parts = text.split('**')
  return parts.map((chunk, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{chunk}</strong>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  )
}

export function PrivacyPolicyPage() {
  const contact = getPrivacyContactEmail()

  return (
    <div className="privacy-page">
      <header className="privacy-page__header">
        <Link className="privacy-page__wordmark" to="/">
          Treasury
        </Link>
        <div className="privacy-page__header-actions">
          <Link className="privacy-page__link" to="/login">
            Sign in
          </Link>
        </div>
      </header>

      <main className="privacy-page__main">
        <article className="privacy-page__article">
          <p className="privacy-page__kicker">Legal</p>
          <h1 className="privacy-page__title">Privacy policy</h1>
          <p className="privacy-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          <p className="privacy-page__lead">
            This policy describes how Treasury (&quot;we&quot;, &quot;us&quot;) handles personal and financial information when you use our website and application.
          </p>

          {SECTIONS.map((section) => (
            <section key={section.title} className="privacy-page__section">
              <h2 className="privacy-page__section-title">{section.title}</h2>
              {section.body.length ? (
                <ul className="privacy-page__list">
                  {section.body.map((line) => (
                    <li key={line} className="privacy-page__li">
                      <RichLine text={line} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.title === 'Contact' ? (
                <p className="privacy-page__contact">
                  For privacy or data-protection requests, email{' '}
                  <a className="privacy-page__mailto" href={`mailto:${contact}`}>
                    {contact}
                  </a>
                  .
                </p>
              ) : null}
            </section>
          ))}
        </article>
      </main>

      <footer className="privacy-page__footer">
        <Link className="privacy-page__footer-link" to="/">
          ← Back to home
        </Link>
      </footer>
    </div>
  )
}
