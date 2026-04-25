import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { FUNDING_STAGES } from '../constants/fundingStages'
import { useCompanyProfile } from '../hooks/useCompanyProfile'
import './CompanyOnboardingPage.css'

export function CompanyOnboardingPage() {
  const navigate = useNavigate()
  const { profile, loading, refresh } = useCompanyProfile()
  const [companyName, setCompanyName] = useState('')
  const [fundingStage, setFundingStage] = useState(FUNDING_STAGES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const name = companyName.trim()
    if (!name) {
      setError('Please enter your company name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Not signed in.')

      const { error: upsertError } = await supabase.from('company_profiles').upsert(
        {
          user_id: user.id,
          company_name: name,
          funding_stage: fundingStage,
        },
        { onConflict: 'user_id' },
      )

      if (upsertError) {
        if (
          (upsertError.message ?? '').toLowerCase().includes('relation') &&
          (upsertError.message ?? '').toLowerCase().includes('does not exist')
        ) {
          throw new Error(
            "Table 'company_profiles' is not set up yet. Apply the migration in supabase/migrations/, then retry.",
          )
        }
        throw upsertError
      }

      await refresh()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="company-onboarding">
        <div className="company-onboarding__card" aria-busy="true">
          <p className="company-onboarding__loading">Loading…</p>
        </div>
      </div>
    )
  }

  if (profile) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="company-onboarding">
      <div className="company-onboarding__card">
        <header className="company-onboarding__header">
          <p className="company-onboarding__brand">Treasury</p>
          <h1 className="company-onboarding__title">Welcome — set up your workspace</h1>
          <p className="company-onboarding__subtitle">
            We use this to personalise Treasury Autopilot. You can change it later when profile settings are added.
          </p>
        </header>

        <form className="company-onboarding__form" onSubmit={handleSubmit} noValidate>
          <label className="company-onboarding__label" htmlFor="co-name">
            Company name
          </label>
          <input
            id="co-name"
            className="company-onboarding__input"
            type="text"
            autoComplete="organization"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Ltd"
            required
            disabled={saving}
            maxLength={200}
          />

          <label className="company-onboarding__label" htmlFor="co-stage">
            Funding stage
          </label>
          <select
            id="co-stage"
            className="company-onboarding__select"
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

          {error ? (
            <p className="company-onboarding__error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="company-onboarding__submit" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Continue to Treasury Autopilot'}
          </button>
        </form>
      </div>
    </div>
  )
}
