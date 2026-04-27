import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import './ConnectBankModal.css'

const SOURCE = 'open_banking_connect'

const BANKS = [
  { name: 'Barclays', color: '#00AEEF' },
  { name: 'HSBC', color: '#DB0011' },
  { name: 'Starling', color: '#6930D3' },
  { name: 'Monzo Business', color: '#FF5489' },
  { name: 'NatWest', color: '#42145F' },
  { name: 'Lloyds', color: '#006A4D' },
  { name: 'Santander', color: '#EC0000' },
  { name: 'Metro Bank', color: '#E31937' },
  { name: 'Tide', color: '#0F2B91' },
  { name: 'Revolut Business', color: '#191919' },
]

export function ConnectBankModal({ open, onClose }) {
  const titleId = useId()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    setMessage('')
    setError('')
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const e = data.session?.user?.email?.trim()
      setEmail(e || '')
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleClose = useCallback(() => {
    if (submitting) return
    onClose()
  }, [onClose, submitting])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter your email.')
      return
    }
    setSubmitting(true)
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()
      if (userErr || !user) {
        setError('You need to be signed in to join the waitlist.')
        return
      }

      const { error: insertErr } = await supabase.from('waitlist').upsert(
        {
          user_id: user.id,
          email: trimmed,
          source: SOURCE,
        },
        { onConflict: 'user_id,source' },
      )

      if (insertErr) {
        setError(insertErr.message || 'Could not save. Try again.')
        return
      }
      setMessage("You're on the list — we'll email you when your bank is supported.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const node = (
    <div className="cbm-root" role="presentation">
      <button type="button" className="cbm-backdrop" aria-label="Close dialog" onClick={handleClose} />
      <div
        className="cbm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <button type="button" className="cbm-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
        <h2 id={titleId} className="cbm-title">
          Connect your bank
        </h2>
        <p className="cbm-sub">
          Automatically sync your transactions daily via Open Banking — no CSV uploads needed.
        </p>

        <div className="cbm-grid" role="list">
          {BANKS.map((b) => (
            <div key={b.name} className="cbm-bank" role="listitem">
              <div className="cbm-bank-logo" style={{ background: b.color }} aria-hidden />
              <span className="cbm-bank-name">{b.name}</span>
            </div>
          ))}
        </div>

        <p className="cbm-note">
          We are currently completing FCA registration. Join the waitlist to be notified when your bank is supported.
        </p>

        <form className="cbm-form" onSubmit={handleSubmit}>
          <label className="cbm-label" htmlFor="cbm-email">
            Email
          </label>
          <input
            id="cbm-email"
            type="email"
            className="cbm-input"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={submitting}
          />
          {error ? <p className="cbm-error">{error}</p> : null}
          {message ? <p className="cbm-success">{message}</p> : null}
          <button type="submit" className="cbm-submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Join Waitlist'}
          </button>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null
}
