import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPrivacyContactEmail } from '../constants/privacyContact'
import { useCountUp } from '../hooks/useCountUp'
import './LandingPage.css'

function scrollToHeroCta() {
  document.getElementById('hero-cta')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function LandingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const statsRef = useRef(null)
  const [statsRun, setStatsRun] = useState(false)

  const statK = useCountUp(229, { duration: 1400, enabled: statsRun, resetWhenDisabled: true })
  const statMo = useCountUp(47.2, { duration: 1450, enabled: statsRun, resetWhenDisabled: true })
  const statPct = useCountUp(100, { duration: 1200, enabled: statsRun, resetWhenDisabled: true })

  useEffect(() => {
    const el = statsRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setStatsRun(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsRun(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -5% 0px', threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-lp-reveal]')
    if (!nodes.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('lp-reveal--visible')
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  function handleEarlyAccessSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('invalid')
      return
    }
    setStatus('done')
    setEmail('')
  }

  const privacyEmail = getPrivacyContactEmail()

  const earlyAccessForm = (idPrefix, buttonVariant = 'navy') => (
    <>
      {status === 'done' ? (
        <p className="lp-form__done" role="status">
          Thanks — you&apos;re on the list. We&apos;ll be in touch.
        </p>
      ) : (
        <form className="lp-form" onSubmit={handleEarlyAccessSubmit} noValidate>
          <label className="lp-visually-hidden" htmlFor={`${idPrefix}-email`}>
            Work email
          </label>
          <input
            id={`${idPrefix}-email`}
            className={`lp-input ${buttonVariant === 'white' ? 'lp-input--on-dark' : ''}`}
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
          />
          <button
            className={`lp-btn ${buttonVariant === 'white' ? 'lp-btn--white' : 'lp-btn--navy'}`}
            type="submit"
          >
            Get Early Access
          </button>
        </form>
      )}
    </>
  )

  return (
    <div className="lp">
      {status === 'invalid' ? (
        <div className="lp-alert" role="alert">
          Enter a valid email address.
        </div>
      ) : null}
      <header className="lp-nav">
        <span className="lp-nav__brand">Treasury Autopilot</span>
        <div className="lp-nav__actions">
          <Link className="lp-nav__link" to="/login">
            Sign In
          </Link>
          <button type="button" className="lp-nav__cta" onClick={scrollToHeroCta}>
            Get Early Access
          </button>
        </div>
      </header>

      <section className="lp-hero" id="early-access" aria-labelledby="lp-hero-heading">
        <div className="lp-hero__inner">
          <div className="lp-hero__left">
            <p className="lp-hero__label">Treasury Autopilot</p>
            <h1 id="lp-hero-heading" className="lp-hero__title">
              Your cash is losing money.
              <br />
              We fix that <span className="lp-hero__accent">automatically</span>.
            </h1>
            <p className="lp-hero__sub">
              Most funded startups lose £50,000–£200,000 a year in idle cash and poor treasury decisions. We maintain
              your runway — automatically.
            </p>
            <div ref={statsRef} className="lp-hero__stats" aria-label="Proof points">
              <span className="lp-hero__stat">
                <strong>
                  £{Math.round(statK)}k
                </strong>{' '}
                average annual opportunity cost recovered
              </span>
              <span className="lp-hero__stat-sep" aria-hidden>
                ·
              </span>
              <span className="lp-hero__stat">
                <strong>{statMo.toFixed(1)}</strong> months average runway maintained
              </span>
              <span className="lp-hero__stat-sep" aria-hidden>
                ·
              </span>
              <span className="lp-hero__stat">
                <strong>{Math.round(statPct)}%</strong> of cash stays in your name
              </span>
            </div>
            <div id="hero-cta" className="lp-hero__cta-wrap">
              {earlyAccessForm('hero')}
            </div>
            <p className="lp-hero__trust">
              Used by Series A and B finance teams · No money ever leaves your control
            </p>
          </div>

          <div className="lp-hero__right">
            <div className="lp-hero__preview-shell" aria-hidden="true">
              <div className="lp-hero__dot-grid" />
              <div className="lp-preview-card-border">
                <div className="lp-preview-card">
                <div className="lp-preview-card__top">
                  <span className="lp-preview-card__wordmark">Treasury Autopilot</span>
                  <div className="lp-preview-card__live">
                    <span className="lp-preview-card__live-dot" />
                    Live
                  </div>
                </div>
                <div className="lp-preview-card__metrics">
                  <div className="lp-preview-metric">
                    <div className="lp-preview-metric__row">
                      <span className="lp-preview-metric__label">Idle cash opportunity</span>
                      <span className="lp-preview-metric__dot lp-preview-metric__dot--red" />
                    </div>
                    <span className="lp-preview-metric__value lp-preview-metric__value--red">£229,710/yr</span>
                  </div>
                  <div className="lp-preview-metric">
                    <div className="lp-preview-metric__row">
                      <span className="lp-preview-metric__label">Runway</span>
                      <span className="lp-preview-metric__dot lp-preview-metric__dot--green" />
                    </div>
                    <span className="lp-preview-metric__value lp-preview-metric__value--green">47.2 months</span>
                  </div>
                  <div className="lp-preview-metric">
                    <div className="lp-preview-metric__row">
                      <span className="lp-preview-metric__label">FSCS unprotected</span>
                      <span className="lp-preview-metric__dot lp-preview-metric__dot--amber" />
                    </div>
                    <span className="lp-preview-metric__value lp-preview-metric__value--amber">£4.49M</span>
                  </div>
                </div>
                <div className="lp-preview-card__actions">
                  <div className="lp-preview-action">
                    <span className="lp-preview-action__title">Reallocate MMF sleeve above buffer</span>
                    <span className="lp-preview-action__impact">+£48,200 / yr</span>
                  </div>
                  <div className="lp-preview-action">
                    <span className="lp-preview-action__title">Renegotiate top vendor — SaaS stack</span>
                    <span className="lp-preview-action__impact">+£31,400 / yr</span>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-feature lp-feature--yield lp-feature--surface-a" data-lp-reveal>
        <div className="lp-feature__inner">
          <div className="lp-feature__text">
            <h2 className="lp-feature__heading">Stop losing £229,000 a year.</h2>
            <p className="lp-feature__body">
              Your cash is sitting in a current account earning 0.10% when money market funds are paying 5.12%. We show
              you exactly what that costs — and move it for you.
            </p>
            <p className="lp-feature__statcall">
              £19,140 per month in foregone yield for a typical Series A startup.
            </p>
          </div>
          <div className="lp-feature__visual">
            <div className="lp-yield-card">
              <table className="lp-yield-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Barclays Business Current</td>
                    <td className="lp-yield-table__rate lp-yield-table__rate--bad">0.10%</td>
                  </tr>
                  <tr>
                    <td>BoE base (reference)</td>
                    <td className="lp-yield-table__rate">4.75%</td>
                  </tr>
                  <tr>
                    <td>
                      BlackRock Liquidity Fund{' '}
                      <span className="lp-yield-table__badge">Recommended</span>
                    </td>
                    <td className="lp-yield-table__rate lp-yield-table__rate--good">5.12%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-feature lp-feature--runway lp-feature--reverse lp-feature--surface-b" data-lp-reveal>
        <div className="lp-feature__inner">
          <div className="lp-feature__visual">
            <div className="lp-runway-card">
              <p className="lp-runway-card__title">Runway scenarios</p>
              <div className="lp-runway-card__scenarios">
                <div className="lp-runway-scenario lp-runway-scenario--bear">
                  <span className="lp-runway-scenario__label">Bear</span>
                  <span className="lp-runway-scenario__mo">14.2 mo</span>
                </div>
                <div className="lp-runway-scenario lp-runway-scenario--base">
                  <span className="lp-runway-scenario__label">Base</span>
                  <span className="lp-runway-scenario__mo">19.4 mo</span>
                </div>
                <div className="lp-runway-scenario lp-runway-scenario--bull">
                  <span className="lp-runway-scenario__label">Bull</span>
                  <span className="lp-runway-scenario__mo">23.1 mo</span>
                </div>
              </div>
              <div className="lp-runway-card__bar" aria-hidden="true">
                <span className="lp-runway-card__bar-fill" />
              </div>
            </div>
          </div>
          <div className="lp-feature__text">
            <h2 className="lp-feature__heading">Know exactly when to raise — before it&apos;s too late.</h2>
            <p className="lp-feature__body">
              We calculate your real runway across three scenarios, flag when you should start fundraising, and
              maintain your target automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="lp-feature lp-feature--actions lp-feature--surface-a" data-lp-reveal>
        <div className="lp-feature__inner">
          <div className="lp-feature__text">
            <h2 className="lp-feature__heading">Not insights. Actions.</h2>
            <p className="lp-feature__body">
              Every recommendation comes with a specific pound value, a 30-day cost of inaction, and one-click
              execution. Our autopilot recommendations are generated from your real data — not generic tips.
            </p>
          </div>
          <div className="lp-feature__visual">
            <div className="lp-action-cards">
              <article className="lp-action-card">
                <h3 className="lp-action-card__title">Sweep surplus into BlackRock MMF</h3>
                <p className="lp-action-card__impact">£52,800 / yr estimated uplift</p>
                <p className="lp-action-card__coi">If ignored 30 days: ~£4,400 foregone</p>
              </article>
              <article className="lp-action-card">
                <h3 className="lp-action-card__title">Diversify above FSCS — second bank sweep</h3>
                <p className="lp-action-card__impact">£0 direct yield · risk reduction</p>
                <p className="lp-action-card__coi">If ignored 30 days: concentration tail-risk retained</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-social" data-lp-reveal>
        <p className="lp-social__text">
          Trusted by finance teams at funded startups · No money ever leaves your control · Bank-grade security · GDPR
          compliant
        </p>
      </div>

      <section className="lp-final" id="final-cta" aria-labelledby="lp-final-heading">
        <h2 id="lp-final-heading" className="lp-final__title">
          Your runway is shorter than it should be.
        </h2>
        <p className="lp-final__sub">
          Join the CFOs already using Treasury Autopilot to maintain their runway automatically.
        </p>
        <div className="lp-final__form-wrap">{earlyAccessForm('final', 'white')}</div>
        <p className="lp-final__fineprint">No credit card required · Setup in 2 minutes · Cancel any time</p>
      </section>

      <footer className="lp-footer">
        <span className="lp-footer__brand">Treasury Autopilot</span>
        <nav className="lp-footer__nav" aria-label="Footer">
          <Link className="lp-footer__link" to="/privacy">
            Privacy Policy
          </Link>
          <a className="lp-footer__link" href={`mailto:${privacyEmail}`}>
            Contact
          </a>
        </nav>
        <span className="lp-footer__copy">© 2026</span>
      </footer>
    </div>
  )
}
