import { Link } from 'react-router-dom'
import './TreasuryOnboarding.css'

const STEPS = [
  {
    n: 1,
    title: 'Connect your data',
    body: 'Upload a bank CSV so we can read your balances and cash movements.',
  },
  {
    n: 2,
    title: 'See exactly how much you are losing and how to fix it',
    body: 'We combine runway, liquidity, yield, and concentration into one view.',
  },
  {
    n: 3,
    title: 'Get your autopilot recommendations — specific actions with pound value impact',
    body: 'Prioritised moves you can take this week, with impact in pounds.',
  },
]

export function TreasuryOnboarding({ onSkip }) {
  return (
    <div className="tdash-onboard">
      <div className="tdash-onboard__inner">
        <p className="tdash-onboard__eyebrow">Getting started</p>
        <h1 className="tdash-onboard__title">Welcome to Treasury Autopilot</h1>
        <p className="tdash-onboard__sub">{"Let's get your cash working harder. It takes 2 minutes."}</p>

        <ol className="tdash-onboard__steps" aria-label="Setup steps">
          {STEPS.map((s) => (
            <li key={s.n} className="tdash-onboard__step">
              <span className="tdash-onboard__step-num" aria-hidden>
                {s.n}
              </span>
              <div className="tdash-onboard__step-body">
                <p className="tdash-onboard__step-title">
                  <span className="tdash-onboard__step-label">Step {s.n}</span> {s.title}
                </p>
                <p className="tdash-onboard__step-text">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="tdash-onboard__actions">
          <Link className="tdash-onboard__btn-primary" to="/upload">
            Upload your first bank statement
          </Link>
          <button type="button" className="tdash-onboard__skip" onClick={onSkip}>
            Skip for now — open Treasury Autopilot
          </button>
        </div>
      </div>
    </div>
  )
}
