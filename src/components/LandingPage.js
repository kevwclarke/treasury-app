import { useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

const BENEFITS = [
  'See your yield gap in pounds, not percentages',
  'Know if your deposits are protected',
  'Get AI-generated actions ranked by financial impact',
]

export function LandingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')

  function handleWaitlistSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('invalid')
      return
    }
    setStatus('done')
    setEmail('')
  }

  return (
    <div className="landing">
      <header className="landing__header">
        <span className="landing__wordmark" aria-hidden="true">
          Treasury
        </span>
        <Link className="landing__sign-in" to="/login">
          Sign in
        </Link>
      </header>

      <main className="landing__main">
        <div className="landing__column">
          <p className="landing__kicker">Treasury intelligence</p>
          <h1 className="landing__headline">Your cash is losing money. Find out how much.</h1>
          <p className="landing__subhead">
            Most funded startups have millions sitting in a current account earning almost nothing. We
            show you exactly what it&apos;s costing you — and tell you specifically what to do about
            it.
          </p>

          <ul className="landing__benefits" aria-label="What you get">
            {BENEFITS.map((line) => (
              <li key={line} className="landing__benefit">
                <span className="landing__benefit-dash" aria-hidden="true">
                  —
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {status === 'done' ? (
            <p className="landing__confirm" role="status">
              Thanks — you&apos;re on the list. We&apos;ll be in touch.
            </p>
          ) : (
            <form className="landing__form" onSubmit={handleWaitlistSubmit} noValidate>
              <div className="landing__form-row">
                <label className="landing__visually-hidden" htmlFor="waitlist-email">
                  Email
                </label>
                <input
                  id="waitlist-email"
                  className="landing__input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (status === 'invalid') setStatus('idle')
                  }}
                  aria-invalid={status === 'invalid'}
                  aria-describedby={status === 'invalid' ? 'waitlist-email-hint' : undefined}
                />
                <button className="landing__cta" type="submit">
                  Join the waitlist
                </button>
              </div>
              {status === 'invalid' ? (
                <p id="waitlist-email-hint" className="landing__hint" role="alert">
                  Enter a valid email address.
                </p>
              ) : null}
            </form>
          )}

          <p className="landing__footnote">
            Built for CFOs and Finance Directors at funded startups.
          </p>
        </div>
      </main>
    </div>
  )
}
