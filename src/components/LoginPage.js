import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import './LoginPage.css'

function postLoginPath(fromLocation) {
  const p = fromLocation?.pathname
  if (p && p.startsWith('/app')) return p
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

  if (session === undefined) {
    return (
      <div className="login-page">
        <div className="login-page__card" aria-busy="true">
          <p className="login-page__loading">Loading…</p>
        </div>
      </div>
    )
  }

  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className="login-page">
      <div className="login-page__card">
        <header className="login-page__header">
          <p className="login-page__brand">Treasury</p>
          <h1 className="login-page__title">Sign in</h1>
          <p className="login-page__subtitle">
            UK startup CFO intelligence — secure access to your workspace.
          </p>
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
      </div>
    </div>
  )
}
