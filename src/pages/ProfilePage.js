import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { FUNDING_STAGES } from '../constants/fundingStages'
import { useCompanyProfile } from '../hooks/useCompanyProfile'
import '../components/DetailPage.css'
import './ProfilePage.css'

export function ProfilePage() {
  const { profile, loading, refresh } = useCompanyProfile()
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [fundingStage, setFundingStage] = useState(FUNDING_STAGES[0])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState('')

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '')
    })
  }, [])

  useEffect(() => {
    if (!profile) return
    setCompanyName(profile.company_name ?? '')
    setFundingStage(FUNDING_STAGES.includes(profile.funding_stage) ? profile.funding_stage : FUNDING_STAGES[0])
  }, [profile])

  const saveProfile = useCallback(
    async (e) => {
      e.preventDefault()
      const name = companyName.trim()
      if (!name) {
        setSaveErr('Company name is required.')
        return
      }
      setSaving(true)
      setSaveErr('')
      setSaveMsg('')
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Not signed in.')

        const { error } = await supabase
          .from('company_profiles')
          .upsert(
            { user_id: user.id, company_name: name, funding_stage: fundingStage },
            { onConflict: 'user_id' },
          )
        if (error) throw error
        await refresh()
        setSaveMsg('Saved.')
        window.setTimeout(() => setSaveMsg(''), 3200)
      } catch (err) {
        setSaveErr(err?.message ?? 'Could not save.')
      } finally {
        setSaving(false)
      }
    },
    [companyName, fundingStage, refresh],
  )

  async function changePassword(e) {
    e.preventDefault()
    setPwErr('')
    setPwMsg('')
    if (pwNew.length < 6) {
      setPwErr('New password must be at least 6 characters.')
      return
    }
    if (pwNew !== pwConfirm) {
      setPwErr('New passwords do not match.')
      return
    }
    setPwBusy(true)
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pwCurrent,
      })
      if (reauthError) throw new Error('Current password is incorrect.')

      const { error } = await supabase.auth.updateUser({ password: pwNew })
      if (error) throw error
      setPwMsg('Password updated.')
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      window.setTimeout(() => setPwMsg(''), 4000)
    } catch (err) {
      setPwErr(err?.message ?? 'Could not update password.')
    } finally {
      setPwBusy(false)
    }
  }

  async function deleteWorkspaceData() {
    if (
      !window.confirm(
        'This removes all uploaded transactions and your company profile from Treasury. Your login will remain until you contact us to close it fully. Continue?',
      )
    ) {
      return
    }
    if (!window.confirm('This cannot be undone in the app. Delete all treasury data now?')) return

    setDeleteBusy(true)
    setDeleteErr('')
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Not signed in.')

      const { error: txErr } = await supabase.from('transactions').delete().eq('user_id', user.id)
      if (txErr) throw txErr

      const { error: coErr } = await supabase.from('company_profiles').delete().eq('user_id', user.id)
      if (coErr) throw coErr

      await supabase.auth.signOut()
      window.location.assign('/login')
    } catch (err) {
      setDeleteErr(err?.message ?? 'Delete failed. If policies are missing, apply the latest Supabase migrations.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="detail-page profile-page">
      <header className="detail-hero">
        <h1 className="detail-title">Profile</h1>
        <p className="detail-sub">Workspace and security</p>
      </header>

      <section className="detail-section profile-page__section">
        <h2 className="detail-section__title">Company</h2>
        {loading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <form className="profile-page__form" onSubmit={saveProfile}>
            <label className="profile-page__label" htmlFor="pf-company">
              Company name
            </label>
            <input
              id="pf-company"
              className="profile-page__input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={200}
              disabled={saving}
            />

            <label className="profile-page__label" htmlFor="pf-stage">
              Funding stage
            </label>
            <select
              id="pf-stage"
              className="profile-page__select"
              value={fundingStage}
              onChange={(e) => setFundingStage(e.target.value)}
              disabled={saving}
            >
              {FUNDING_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label className="profile-page__label" htmlFor="pf-email">
              Email
            </label>
            <input id="pf-email" className="profile-page__input profile-page__input--readonly" readOnly value={email} />

            {saveErr ? (
              <p className="profile-page__err" role="alert">
                {saveErr}
              </p>
            ) : null}
            {saveMsg ? (
              <p className="profile-page__ok" role="status">
                {saveMsg}
              </p>
            ) : null}

            <button className="profile-page__btn profile-page__btn--primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </section>

      <section className="detail-section profile-page__section">
        <h2 className="detail-section__title">Change password</h2>
        <form className="profile-page__form" onSubmit={changePassword}>
          <label className="profile-page__label" htmlFor="pf-pw-cur">
            Current password
          </label>
          <input
            id="pf-pw-cur"
            className="profile-page__input"
            type="password"
            autoComplete="current-password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            disabled={pwBusy}
          />
          <label className="profile-page__label" htmlFor="pf-pw-new">
            New password
          </label>
          <input
            id="pf-pw-new"
            className="profile-page__input"
            type="password"
            autoComplete="new-password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            disabled={pwBusy}
            minLength={6}
          />
          <label className="profile-page__label" htmlFor="pf-pw-2">
            Confirm new password
          </label>
          <input
            id="pf-pw-2"
            className="profile-page__input"
            type="password"
            autoComplete="new-password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            disabled={pwBusy}
          />
          {pwErr ? (
            <p className="profile-page__err" role="alert">
              {pwErr}
            </p>
          ) : null}
          {pwMsg ? (
            <p className="profile-page__ok" role="status">
              {pwMsg}
            </p>
          ) : null}
          <button className="profile-page__btn profile-page__btn--dark" type="submit" disabled={pwBusy}>
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="detail-section profile-page__section profile-page__section--danger">
        <h2 className="detail-section__title">Danger zone</h2>
        <p className="detail-muted">
          Deletes all transactions and your company profile. You will be signed out and asked to set up your workspace
          again. Full account closure may still require a request to your administrator.
        </p>
        {deleteErr ? (
          <p className="profile-page__err" role="alert">
            {deleteErr}
          </p>
        ) : null}
        <button
          type="button"
          className="profile-page__btn profile-page__btn--danger"
          onClick={deleteWorkspaceData}
          disabled={deleteBusy}
        >
          {deleteBusy ? 'Deleting…' : 'Delete my treasury data'}
        </button>
      </section>

      <p className="profile-page__back">
        <Link className="detail-muted" to="/app">
          ← Back to Treasury Autopilot
        </Link>
      </p>
    </div>
  )
}
