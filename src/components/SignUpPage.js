import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import './SignUpPage.css'

export function SignUpPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState(undefined)
  const [emailSent, setEmailSent] = useState(false)

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

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data?.session) {
      navigate('/onboarding', { replace: true })
      return
    }

    setEmailSent(true)
  }

  if (session === undefined) {
    return (
      <div className="signup-page">
        <div className="signup-page__card" aria-busy="true">
          <p className="signup-page__loading">Loading…</p>
        </div>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/onboarding" replace />
  }

  if (emailSent) {
    return (
      <div className="signup-page">
        <div className="signup-page__card">
          <header className="signup-page__header">
            <p className="signup-page__brand">Treasury</p>
            <h1 className="signup-page__title">Almost there</h1>
          </header>
          <p className="signup-page__success" role="status">
            Check your email to confirm your account
          </p>
          <p className="signup-page__success-hint">
            We sent a link to <strong>{email.trim()}</strong>. After you confirm, you can sign in with your password.
          </p>
          <Link className="signup-page__secondary-link" to="/login">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <div className="signup-page__card">
        <header className="signup-page__header">
          <p className="signup-page__brand">Treasury</p>
          <h1 className="signup-page__title">Create your account</h1>
          <p className="signup-page__subtitle">
            UK startup CFO intelligence — one workspace for yield, runway, and liquidity.
          </p>
        </header>

        <form className="signup-page__form" onSubmit={handleSubmit} noValidate>
          <label className="signup-page__label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className="signup-page__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <label className="signup-page__label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="signup-page__input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={submitting}
          />

          <label className="signup-page__label" htmlFor="signup-confirm">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            className="signup-page__input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={submitting}
          />

          {error ? (
            <p className="signup-page__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="signup-page__submit" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="signup-page__footer">
          Already have an account?{' '}
          <Link className="signup-page__footer-link" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
