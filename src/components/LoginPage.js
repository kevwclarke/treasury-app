import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getPrivacyContactEmail } from '../constants/privacyContact'
import { supabase } from '../supabase'
import './LoginPage.css'

function postLoginPath(fromLocation) {
  const p = fromLocation?.pathname
  if (!p || typeof p !== 'string') return '/app'
  if (p.includes('..') || p.includes('//')) return '/app'
  if (p === '/upload' || p.startsWith('/upload/')) return '/upload'
  if (p === '/app' || p.startsWith('/app/')) return p
  return '/app'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = postLoginPath(location.state?.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate(redirectTo, { replace: true })
  }

  const privacyEmail = getPrivacyContactEmail()

  const siteFooter = (
    <footer className="login-page__site-footer">
      <span className="login-page__legal">© 2026</span>
      <span className="login-page__legal-sep" aria-hidden="true">
        {' · '}
      </span>
      <Link className="login-page__legal-link" to="/privacy">
        Privacy Policy
      </Link>
      <span className="login-page__legal-sep" aria-hidden="true">
        {' · '}
      </span>
      <a className="login-page__legal-link" href={`mailto:${privacyEmail}`}>
        Contact
      </a>
    </footer>
  )

  if (session === undefined) {
    return (
      <div className="login-page">
        <div className="login-page__center">
          <div className="login-page__card" aria-busy="true">
            <p className="login-page__loading">Loading…</p>
          </div>
        </div>
        {siteFooter}
      </div>
    )
  }

  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className="login-page">
      <div className="login-page__center">
        <div className="login-page__card">
        <header className="login-page__header">
          <p className="login-page__brand">Treasury</p>
          <h1 className="login-page__title">Sign in</h1>
          <p className="login-page__subtitle">Your treasury autopilot</p>
        </header>

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          <label className="login-page__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="login-page__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <label className="login-page__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="login-page__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />

          {error ? (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="login-page__submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-page__footer">
          Don&apos;t have an account?{' '}
          <Link className="login-page__footer-link" to="/signup">
            Sign up
          </Link>
        </p>
        </div>
      </div>
      {siteFooter}
    </div>
  )
}
