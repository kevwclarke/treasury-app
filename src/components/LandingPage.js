import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPrivacyContactEmail } from '../constants/privacyContact'
import { useCountUp } from '../hooks/useCountUp'
import './LandingPage.css'

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export function LandingPage() {
  const [finalEmail, setFinalEmail] = useState('')
  const [finalStatus, setFinalStatus] = useState('idle')
  const [formAlert, setFormAlert] = useState('')
  const [navScrolled, setNavScrolled] = useState(false)

  const statK = useCountUp(229, { duration: 1500, enabled: true, ease: 'out' })
  const statMo = useCountUp(47.2, { duration: 1500, enabled: true, ease: 'out' })
  const statPct = useCountUp(100, { duration: 1500, enabled: true, ease: 'out' })

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-lp-reveal]')
    if (!nodes.length) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('lp2-reveal--visible')
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  const privacyEmail = getPrivacyContactEmail()

  function submitFinal(e) {
    e.preventDefault()
    setFormAlert('')
    const trimmed = finalEmail.trim()
    if (!trimmed || !isValidEmail(trimmed)) {
      setFormAlert('Enter a valid email address.')
      return
    }
    setFinalStatus('done')
    setFinalEmail('')
  }

  return (
    <div className="lp2">
      {formAlert ? (
        <div className="lp2-alert" role="alert">
          {formAlert}
        </div>
      ) : null}

      <header className={navScrolled ? 'lp2-nav lp2-nav--scrolled' : 'lp2-nav'}>
        <span className="lp2-nav__brand">Treasury Autopilot</span>
        <nav className="lp2-nav__mid" aria-label="Page sections">
          <button type="button" className="lp2-nav__mid-link" onClick={() => scrollToId('how-it-works')}>
            How it works
          </button>
          <span className="lp2-nav__dot" aria-hidden>
            ·
          </span>
          <button type="button" className="lp2-nav__mid-link" onClick={() => scrollToId('features')}>
            Features
          </button>
          <span className="lp2-nav__dot" aria-hidden>
            ·
          </span>
          <button type="button" className="lp2-nav__mid-link" onClick={() => scrollToId('pricing')}>
            Pricing
          </button>
          <span className="lp2-nav__dot" aria-hidden>
            ·
          </span>
          <button type="button" className="lp2-nav__mid-link" onClick={() => scrollToId('security')}>
            Security
          </button>
        </nav>
        <div className="lp2-nav__actions">
          <Link className="lp2-nav__signin" to="/login">
            Sign in
          </Link>
          <button type="button" className="lp2-nav__cta" onClick={() => scrollToId('final-cta')}>
            Get early access
          </button>
        </div>
      </header>

      <section className="lp2-hero" id="early-access" aria-labelledby="lp-hero-h1">
        <div className="lp2-hero__grid">
          <div className="lp2-hero__left">
            <p className="lp2-hero__label">TREASURY AUTOPILOT</p>
            <p className="lp2-hero__problem">
              Most funded startups are silently losing £50,000–£200,000 a year in idle cash.
            </p>
            <h1 id="lp-hero-h1" className="lp2-hero__h1">
              <span className="lp2-hero__line">We show you exactly</span>
              <span className="lp2-hero__line">
                how much. Then we <span className="lp2-hero__line--fix">fix</span> it.
              </span>
            </h1>
            <p className="lp2-hero__lead">Automatically. Without adding risk.</p>
            <p className="lp2-hero__proof">Built for CFOs who have better things to do than manage cash manually.</p>
            <div className="lp2-hero__micro" aria-label="Key metrics">
              <div className="lp2-hero__micro-row">
                <span className="lp2-hero__micro-num lp2-hero__micro-num--navy">£{Math.round(statK)}k</span>
                <span className="lp2-hero__micro-lab">avg annual opportunity cost recovered</span>
              </div>
              <div className="lp2-hero__micro-row">
                <span className="lp2-hero__micro-num lp2-hero__micro-num--green">{statMo.toFixed(1)}mo</span>
                <span className="lp2-hero__micro-lab">avg runway maintained</span>
              </div>
              <div className="lp2-hero__micro-row">
                <span className="lp2-hero__micro-num lp2-hero__micro-num--ink">{Math.round(statPct)}%</span>
                <span className="lp2-hero__micro-lab">cash always stays in your name</span>
              </div>
            </div>
            <div className="lp2-hero__ctas">
              <button type="button" className="lp2-btn lp2-btn--black" onClick={() => scrollToId('final-cta')}>
                Get early access
              </button>
              <button type="button" className="lp2-btn lp2-btn--outline" onClick={() => scrollToId('how-it-works')}>
                See how it works
              </button>
            </div>
          </div>

          <div className="lp2-hero__right" aria-hidden>
            <div className="lp2-browser-wrap">
              <div className="lp2-browser" role="img" aria-label="Treasury Autopilot product preview">
                <div className="lp2-browser__chrome">
                  <div className="lp2-browser__dots">
                    <span className="lp2-browser__dot lp2-browser__dot--r" />
                    <span className="lp2-browser__dot lp2-browser__dot--a" />
                    <span className="lp2-browser__dot lp2-browser__dot--g" />
                  </div>
                  <div className="lp2-browser__urlwrap">
                    <span className="lp2-browser__url">app.treasuryautopilot.com</span>
                  </div>
                  <div className="lp2-browser__live" aria-hidden>
                    <span className="lp2-browser__live-dot" />
                    <span className="lp2-browser__live-txt">Monitoring in real time</span>
                  </div>
                </div>
                <div className="lp2-browser__body">
                  <div className="lp2-dash-mock">
                    <div className="lp2-dash-mock__kpis">
                      <div className="lp2-dash-mock__kpi">
                        <span className="lp2-dash-mock__kpi-l">Total cash</span>
                        <span className="lp2-dash-mock__kpi-v">£4.82M</span>
                      </div>
                      <div className="lp2-dash-mock__kpi">
                        <span className="lp2-dash-mock__kpi-l">Effective yield</span>
                        <p className="lp2-dash-mock__kpi-compare" aria-label="0.10 percent, then 5.12 percent">
                          <span className="lp2-dash-mock__cmpo">0.10%</span>
                          <span className="lp2-dash-mock__cmpr">→</span>
                          <span className="lp2-dash-mock__cmpn">5.12%</span>
                        </p>
                      </div>
                      <div className="lp2-dash-mock__kpi">
                        <span className="lp2-dash-mock__kpi-l">Runway</span>
                        <p className="lp2-dash-mock__kpi-compare" aria-label="19.4 month runway, then 21.1 month">
                          <span className="lp2-dash-mock__cmpo">19.4mo</span>
                          <span className="lp2-dash-mock__cmpr">→</span>
                          <span className="lp2-dash-mock__cmpn">21.1mo</span>
                        </p>
                      </div>
                      <div className="lp2-dash-mock__kpi">
                        <span className="lp2-dash-mock__kpi-l">Monthly burn</span>
                        <span className="lp2-dash-mock__kpi-v">£248k</span>
                      </div>
                    </div>
                    <div className="lp2-dash-mock__row2">
                      <div className="lp2-dash-mock__mod">
                        <div className="lp2-dash-mock__mod-h">
                          <span className="lp2-dash-mock__mod-t">Yield gap</span>
                          <span className="lp2-dash-mock__pill">Action required</span>
                        </div>
                        <p className="lp2-dash-mock__mod-val">£229,710/yr</p>
                        <div className="lp2-dash-mock__bars" aria-hidden>
                          <div className="lp2-dash-mock__brow">
                            <span className="lp2-dash-mock__blab">0.10%</span>
                            <div className="lp2-dash-mock__btrack">
                              <span className="lp2-dash-mock__bfill lp2-dash-mock__bfill--lo" style={{ width: '10%' }} />
                            </div>
                          </div>
                          <div className="lp2-dash-mock__brow">
                            <span className="lp2-dash-mock__blab">5.12%</span>
                            <div className="lp2-dash-mock__btrack">
                              <span className="lp2-dash-mock__bfill lp2-dash-mock__bfill--hi" style={{ width: '56%' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="lp2-dash-mock__mod">
                        <div className="lp2-dash-mock__mod-h">
                          <span className="lp2-dash-mock__mod-t">Concentration risk</span>
                          <span className="lp2-dash-mock__pill">Action required</span>
                        </div>
                        <p className="lp2-dash-mock__con">100% in largest bank</p>
                      </div>
                    </div>
                    <div className="lp2-dash-mock__wide lp2-dash-mock__wide--primary">
                      <p className="lp2-dash-mock__cm-h">Capital moves</p>
                      <div className="lp2-dash-mock__cm-row">
                        <span className="lp2-dash-mock__cm-t">SWEEP TO TOP RATE</span>
                        <span className="lp2-dash-mock__cm-gr">£229,710/yr impact</span>
                        <span className="lp2-dash-mock__cm-rd">£19,142 cost of waiting</span>
                      </div>
                      <p className="lp2-dash-mock__cm-note">Recommended action · Execute in 1 click</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp2-social" aria-label="Social proof">
        <p className="lp2-social__label">Works with your existing banks.</p>
        <div className="lp2-social__pills">
          {['Barclays', 'HSBC', 'Starling', 'Monzo', 'NatWest', 'Lloyds'].map((name) => (
            <span key={name} className="lp2-social__pill">
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="lp2-features" id="features" data-lp-reveal>
        <h2 className="lp2-features__h2">Everything your CFO needs. Nothing they don&apos;t.</h2>
        <div className="lp2-features__grid">
          <article className="lp2-fcard">
            <div className="lp2-fcard__icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 18V14M9 18V10M14 18V6M19 18V3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="lp2-fcard__h">Recover £229k in idle cash — this week</h3>
            <p className="lp2-fcard__p">See exactly what your idle cash is costing and move it to 5.12% — this week.</p>
            <p className="lp2-fcard__otag">+£229k/year average impact</p>
            <div className="lp2-fcard__viz">
              <div className="lp2-fbar">
                <span>0.10%</span>
                <div className="lp2-fbar__t">
                  <span className="lp2-fbar__f lp2-fbar__f--a" style={{ width: '10%' }} />
                </div>
              </div>
              <div className="lp2-fbar">
                <span>5.12%</span>
                <div className="lp2-fbar__t">
                  <span className="lp2-fbar__f lp2-fbar__f--b" style={{ width: '85%' }} />
                </div>
              </div>
            </div>
          </article>
          <article className="lp2-fcard">
            <div className="lp2-fcard__icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 16a6 6 0 0112 0M12 16V12M4 18h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="lp2-fcard__h">Know exactly when to raise — before it is too late</h3>
            <p className="lp2-fcard__p">
              Real-time runway across three scenarios with your 18-month fundraising threshold marked.
            </p>
            <p className="lp2-fcard__otag">+4.2 months runway protection</p>
            <div className="lp2-fpill-row">
              <span className="lp2-fpill lp2-fpill--bear">Bear 14.2mo</span>
              <span className="lp2-fpill lp2-fpill--base">Base 19.4mo</span>
              <span className="lp2-fpill lp2-fpill--bull">Bull 23.1mo</span>
            </div>
          </article>
          <article className="lp2-fcard">
            <div className="lp2-fcard__icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L3 14h7l-1 8L21 8h-7l-1-6z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="lp2-fcard__h">Not insights. Actions you can take today.</h3>
            <p className="lp2-fcard__p">Every recommendation has a pound value, a cost of waiting, and one-click execution.</p>
            <p className="lp2-fcard__otag">Ranked by pound value impact</p>
            <div className="lp2-fmini">
              <div className="lp2-fmini__r">
                <span>SWEEP TO TOP RATE</span>
                <span className="lp2-fmini__g">£229,710/yr</span>
              </div>
              <p className="lp2-fmini__w">Cost of waiting £19,142</p>
            </div>
          </article>
        </div>
      </section>

      <section className="lp2-how" id="how-it-works" data-lp-reveal>
        <h2 className="lp2-how__h2">Up and running in 2 minutes</h2>
        <div className="lp2-how__steps">
          <div className="lp2-how__step">
            <span className="lp2-how__bgnum" aria-hidden>
              01
            </span>
            <h3 className="lp2-how__h3">Upload your bank statement — 2 minutes</h3>
            <p className="lp2-how__body">Export a CSV from your bank and drop it in. We handle the rest.</p>
          </div>
          <div className="lp2-how__connector" aria-hidden />
          <div className="lp2-how__step">
            <span className="lp2-how__bgnum" aria-hidden>
              02
            </span>
            <h3 className="lp2-how__h3">See your £ impact in under 30 seconds</h3>
            <p className="lp2-how__body">Instantly see what your idle cash is costing you in pounds.</p>
          </div>
          <div className="lp2-how__connector" aria-hidden />
          <div className="lp2-how__step">
            <span className="lp2-how__bgnum" aria-hidden>
              03
            </span>
            <h3 className="lp2-how__h3">Get your Capital Moves and act this week</h3>
            <p className="lp2-how__body">Specific actions ranked by pound impact when you are ready to act.</p>
          </div>
        </div>
      </section>

      <section className="lp2-pricing" id="pricing" data-lp-reveal>
        <h2 className="lp2-pricing__h2">Simple, transparent pricing</h2>
        <p className="lp2-pricing__sub">Cancel any time. No setup fees.</p>
        <p className="lp2-pricing__roi">Typical ROI: 20–100x your subscription cost</p>
        <div className="lp2-pricing__grid">
          <article className="lp2-pcard">
            <h3 className="lp2-pcard__name">Visibility</h3>
            <p className="lp2-pcard__tag">For early stage.</p>
            <p className="lp2-pcard__price">
              £149<span className="lp2-pcard__s">/mo</span>
            </p>
            <p className="lp2-pcard__anchor">Typically identifies £30k–£80k in opportunity</p>
            <ul className="lp2-pcard__list">
              <li>Core modules only: Yield Gap, Concentration Risk, Runway, Burn Rate</li>
            </ul>
            <button type="button" className="lp2-pcard__btn lp2-pcard__btn--ghost" onClick={() => scrollToId('final-cta')}>
              Try free
            </button>
          </article>
          <article className="lp2-pcard">
            <h3 className="lp2-pcard__name">Intelligence</h3>
            <p className="lp2-pcard__tag">For growing teams.</p>
            <p className="lp2-pcard__price">
              £299<span className="lp2-pcard__s">/mo</span>
            </p>
            <p className="lp2-pcard__anchor">Typically recovers £80k–£150k per year</p>
            <ul className="lp2-pcard__list">
              <li>Everything in Visibility</li>
              <li>Cash Flow, Liquidity Buffer, FX Exposure, Opportunities, Scenario Modeller</li>
            </ul>
            <button type="button" className="lp2-pcard__btn" onClick={() => scrollToId('final-cta')}>
              Get started
            </button>
          </article>
          <article className="lp2-pcard lp2-pcard--hit">
            <span className="lp2-pcard__badge">Most popular</span>
            <h3 className="lp2-pcard__name">Control</h3>
            <p className="lp2-pcard__tag">The plan most teams choose.</p>
            <p className="lp2-pcard__price">
              £599<span className="lp2-pcard__s">/mo</span>
            </p>
            <p className="lp2-pcard__anchor">Typically recovers £150k–£300k per year</p>
            <ul className="lp2-pcard__list">
              <li>Everything in Intelligence</li>
              <li>
                Burn Intelligence, Investor Report, AR Ageing, Tax Tracker, Fundraise Timing, Xero integration
              </li>
            </ul>
            <button type="button" className="lp2-pcard__btn lp2-pcard__btn--navy" onClick={() => scrollToId('final-cta')}>
              Get started
            </button>
          </article>
          <article className="lp2-pcard">
            <h3 className="lp2-pcard__name">Autopilot</h3>
            <p className="lp2-pcard__tag">For scaling teams.</p>
            <p className="lp2-pcard__price">
              £1,199<span className="lp2-pcard__s">/mo</span>
            </p>
            <p className="lp2-pcard__anchor">Full treasury maintenance — automated</p>
            <ul className="lp2-pcard__list">
              <li>Everything in Control</li>
              <li>Peer Benchmarking, Term Sheet Analysis, Open Banking live feed, Priority support, Concierge onboarding</li>
            </ul>
            <button type="button" className="lp2-pcard__btn" onClick={() => scrollToId('final-cta')}>
              Book a demo
            </button>
          </article>
        </div>
      </section>

      <section className="lp2-trust-strip" aria-label="Trust and data handling" data-lp-reveal>
        <ul className="lp2-trust-strip__list">
          {[
            'Bank-level security',
            'Read-only by default',
            'We never custody funds',
            'Your data is never used to train any model',
          ].map((t) => (
            <li key={t} className="lp2-trust-strip__item">
              <span className="lp2-trust-strip__ic" aria-hidden>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.5 5L4.5 8L10.5 1" stroke="#1B2B8C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="lp2-security" id="security" data-lp-reveal>
        <div className="lp2-security__inner">
          <h2 className="lp2-security__h2">Security</h2>
          <p className="lp2-security__p">
            Bank-grade encryption, strict access controls, and UK GDPR-aligned processing. Your money stays in accounts
            you own.
          </p>
        </div>
      </section>

      <section className="lp2-final" id="final-cta" aria-labelledby="lp-final-h2">
        <h2 id="lp-final-h2" className="lp2-final__h2">
          Stop losing £19,000 <span className="lp2-final__accent">every</span> month.
        </h2>
        <p className="lp2-final__sub">Join the CFOs already maintaining their runway automatically.</p>
        {finalStatus === 'done' ? (
          <p className="lp2-final__done" role="status">
            Thanks — you&apos;re on the list.
          </p>
        ) : (
          <form className="lp2-final__form" onSubmit={submitFinal}>
            <label className="lp2-visually-hidden" htmlFor="lp2-email">
              Work email
            </label>
            <input
              id="lp2-email"
              className="lp2-final__input"
              type="email"
              autoComplete="email"
              placeholder="Work email"
              value={finalEmail}
              onChange={(e) => {
                setFinalEmail(e.target.value)
                setFormAlert('')
              }}
            />
            <button type="submit" className="lp2-final__btn">
              Get early access
            </button>
          </form>
        )}
      </section>

      <footer className="lp2-footer">
        <span className="lp2-footer__brand">Treasury Autopilot</span>
        <nav className="lp2-footer__nav" aria-label="Footer">
          <Link className="lp2-footer__link" to="/privacy">
            Privacy Policy
          </Link>
          <Link className="lp2-footer__link" to="/terms">
            Terms of Service
          </Link>
          <a className="lp2-footer__link" href={`mailto:${privacyEmail}`}>
            Contact
          </a>
        </nav>
        <span className="lp2-footer__copy">© 2026 Treasury Autopilot</span>
      </footer>
    </div>
  )
}
