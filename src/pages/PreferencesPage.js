import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatPct } from '../utils/treasuryFormat'
import '../components/DetailPage.css'
import './PreferencesPage.css'

function daysAgoLabel(ts) {
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function splitLast30VsPrior30(rows) {
  const now = Date.now()
  const start30 = now - 30 * 24 * 60 * 60 * 1000
  const start60 = now - 60 * 24 * 60 * 60 * 1000
  const last = []
  const prior = []
  rows.forEach((r) => {
    const t = new Date(r.date).getTime()
    if (!Number.isFinite(t)) return
    if (t >= start30) last.push(r)
    else if (t >= start60) prior.push(r)
  })
  return { last, prior }
}

export function PreferencesPage() {
  const { txnLoading, txnRows } = useTreasuryTransactions()
  const [userId, setUserId] = useState(null)
  const [policy, setPolicy] = useState({
    min_runway_months: 6,
    burn_spike_pct: 15,
    weekly_slack_summary: false,
  })
  const [prefs, setPrefs] = useState({
    burn_intelligence_email: false,
    slack_webhook_url: '',
  })
  const [audit, setAudit] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [yieldAlertThresholdPct, setYieldAlertThresholdPct] = useState(4)
  const [companyProfileMeta, setCompanyProfileMeta] = useState(null)
  const [yieldAlertSaveStatus, setYieldAlertSaveStatus] = useState('')
  const slackAutoSentRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      setUserId(user?.id ?? null)
    }
    loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    async function load() {
      const [{ data: pol }, { data: pr }, { data: al }, { data: cp }] = await Promise.all([
        supabase.from('treasury_policies').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('email_preferences').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('audit_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase
          .from('company_profiles')
          .select('company_name,funding_stage,yield_alert_threshold_pct')
          .eq('user_id', userId)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (pol) {
        setPolicy({
          min_runway_months: Number(pol.min_runway_months) || 6,
          burn_spike_pct: Number(pol.burn_spike_pct) || 15,
          weekly_slack_summary: Boolean(pol.weekly_slack_summary),
        })
      }
      if (pr) {
        setPrefs({
          burn_intelligence_email: Boolean(pr.burn_intelligence_email),
          slack_webhook_url: String(pr.slack_webhook_url || ''),
        })
      }
      if (cp?.company_name != null && cp?.funding_stage != null) {
        setCompanyProfileMeta({ company_name: cp.company_name, funding_stage: cp.funding_stage })
        const y = Number(cp.yield_alert_threshold_pct)
        setYieldAlertThresholdPct(Number.isFinite(y) ? y : 4)
      } else {
        setCompanyProfileMeta(null)
      }
      setAudit(Array.isArray(al) ? al : [])
      setLoaded(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const insertAudit = useCallback(
    async ({ action_type, category, description, metadata }) => {
      if (!userId) return
      await supabase.from('audit_log').insert({
        user_id: userId,
        action_type,
        category: category || null,
        description,
        metadata: metadata || null,
      })
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      setAudit(Array.isArray(data) ? data : [])
    },
    [userId],
  )

  async function saveYieldAlertThreshold() {
    if (!userId || !companyProfileMeta) {
      setYieldAlertSaveStatus('error')
      return
    }
    setYieldAlertSaveStatus('')
    const { error } = await supabase.from('company_profiles').upsert(
      {
        user_id: userId,
        company_name: companyProfileMeta.company_name,
        funding_stage: companyProfileMeta.funding_stage,
        yield_alert_threshold_pct: Number(yieldAlertThresholdPct),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      setYieldAlertSaveStatus('error')
      return
    }
    setYieldAlertSaveStatus('success')
    await insertAudit({
      action_type: 'update_yield_alert',
      category: null,
      description: 'Updated yield alert threshold',
      metadata: { yield_alert_threshold_pct: Number(yieldAlertThresholdPct) },
    })
  }

  async function saveAll() {
    if (!userId) return
    await supabase.from('treasury_policies').upsert({ user_id: userId, ...policy }, { onConflict: 'user_id' })
    await supabase.from('email_preferences').upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })
    await insertAudit({
      action_type: 'update_policies',
      category: null,
      description: 'Updated preferences from Settings',
      metadata: null,
    })
  }

  async function handleSlackTest() {
    if (!prefs.slack_webhook_url?.trim()) return
    await insertAudit({
      action_type: 'slack_test',
      category: null,
      description: 'Sent Slack webhook test message',
      metadata: { webhook: 'configured' },
    })
    await fetch(prefs.slack_webhook_url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Treasury Autopilot Test: Slack webhook is connected.',
      }),
    })
  }

  const { last: burnLast30, prior: burnPrior30 } = useMemo(() => splitLast30VsPrior30(txnRows || []), [txnRows])

  useEffect(() => {
    if (slackAutoSentRef.current) return
    if (!loaded) return
    if (!prefs.slack_webhook_url?.trim()) return
    if (txnLoading || !txnRows?.length) return

    const perCatLast = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
    const perCatPrior = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
    burnLast30.forEach((r) => {
      const a = Number(r.amount)
      if (!Number.isFinite(a) || a >= 0) return
      perCatLast[categorisePayee(r.payee)] += Math.abs(a)
    })
    burnPrior30.forEach((r) => {
      const a = Number(r.amount)
      if (!Number.isFinite(a) || a >= 0) return
      perCatPrior[categorisePayee(r.payee)] += Math.abs(a)
    })

    const spikes = BURN_CATEGORY_ORDER.map((c) => {
      const a = perCatLast[c] || 0
      const b = perCatPrior[c] || 0
      const pct = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 999 : 0
      return { category: c, pct, a, b }
    })
      .filter((x) => x.pct > policy.burn_spike_pct)
      .sort((a, b) => b.pct - a.pct)

    if (!spikes.length) return
    const top = spikes[0]

    slackAutoSentRef.current = true
    fetch(prefs.slack_webhook_url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Treasury Autopilot: ${top.category} spend up ${formatPct(top.pct, 1)} — review Burn Intelligence.`,
      }),
    })
      .then(() =>
        insertAudit({
          action_type: 'slack_auto_alert',
          category: top.category,
          description: `Sent Slack burn spike alert for ${top.category}`,
          metadata: { pct: top.pct },
        }),
      )
      .catch(() => {})
  }, [burnLast30, burnPrior30, insertAudit, loaded, policy.burn_spike_pct, prefs.slack_webhook_url, txnLoading, txnRows?.length])

  return (
    <div className="detail-page pref-page">
      <header className="detail-hero">
        <h1 className="detail-title">Preferences</h1>
        <p className="detail-sub">Treasury policies, notifications, and audit trail.</p>
      </header>

      <section className="detail-section pref-section" id="treasury-policies">
        <h2 className="detail-section__title">Treasury policies</h2>
        <p className="detail-section__lead">Targets used for alerts and Slack burn-spike detection.</p>
        <div className="pref-grid">
          <label className="pref-field">
            <span className="pref-field__label">Minimum runway target (months)</span>
            <input
              className="detail-input"
              type="number"
              min={1}
              value={policy.min_runway_months}
              onChange={(e) => setPolicy((p) => ({ ...p, min_runway_months: Number(e.target.value) || 6 }))}
            />
          </label>
          <label className="pref-field">
            <span className="pref-field__label">Burn spike threshold (%)</span>
            <input
              className="detail-input"
              type="number"
              min={5}
              max={60}
              value={policy.burn_spike_pct}
              onChange={(e) => setPolicy((p) => ({ ...p, burn_spike_pct: Number(e.target.value) || 15 }))}
            />
          </label>
          <label className="pref-field pref-field--toggle">
            <span className="pref-field__label">Weekly summary email</span>
            <input
              type="checkbox"
              checked={policy.weekly_slack_summary}
              onChange={(e) => setPolicy((p) => ({ ...p, weekly_slack_summary: e.target.checked }))}
            />
          </label>
        </div>
      </section>

      <section className="detail-section pref-section" id="notifications">
        <h2 className="detail-section__title">Notification preferences</h2>
        <div className="pref-grid">
          <label className="pref-field pref-field--toggle">
            <span className="pref-field__label">Monthly email digest</span>
            <input
              type="checkbox"
              checked={prefs.burn_intelligence_email}
              onChange={(e) => setPrefs((p) => ({ ...p, burn_intelligence_email: e.target.checked }))}
            />
          </label>
          <label className="pref-field pref-field--full">
            <span className="pref-field__label">Slack webhook URL</span>
            <input
              className="detail-input"
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={prefs.slack_webhook_url}
              onChange={(e) => setPrefs((p) => ({ ...p, slack_webhook_url: e.target.value }))}
            />
          </label>
        </div>
        <div className="pref-actions">
          <button type="button" className="detail-btn detail-btn--dark" onClick={handleSlackTest} disabled={!prefs.slack_webhook_url?.trim()}>
            Test Slack
          </button>
        </div>
      </section>

      <section className="detail-section pref-section" id="yield-alerts" aria-labelledby="yield-alerts-heading">
        <p
          id="yield-alerts-heading"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9CA3AF',
            margin: '0 0 0.5rem',
          }}
        >
          YIELD ALERTS
        </p>
        <h2 className="detail-section__title">Yield Alert Threshold</h2>
        <p className="detail-section__lead">Get alerted when any account drops below your minimum acceptable yield rate.</p>
        <div className="pref-grid">
          <label className="pref-field">
            <span className="pref-field__label">Minimum yield threshold (%)</span>
            <input
              className="detail-input"
              type="number"
              min={0}
              max={25}
              step={0.25}
              placeholder="4.00"
              value={yieldAlertThresholdPct}
              onChange={(e) => {
                const v = Number(e.target.value)
                setYieldAlertThresholdPct(Number.isFinite(v) ? v : 4)
                setYieldAlertSaveStatus('')
              }}
              disabled={!companyProfileMeta}
            />
          </label>
        </div>
        <div className="pref-actions">
          <button
            type="button"
            className="detail-btn detail-btn--dark"
            onClick={saveYieldAlertThreshold}
            disabled={!userId || !companyProfileMeta}
          >
            Save yield alert
          </button>
          {yieldAlertSaveStatus === 'success' ? (
            <span className="detail-muted" style={{ marginLeft: 12 }}>
              Yield alert threshold saved.
            </span>
          ) : null}
          {yieldAlertSaveStatus === 'error' ? (
            <span className="detail-muted" style={{ marginLeft: 12, color: '#b91c1c' }}>
              Could not save — check your company profile or try again.
            </span>
          ) : null}
        </div>
      </section>

      <section className="detail-section pref-section">
        <div className="pref-actions">
          <button type="button" className="detail-btn detail-btn--dark" onClick={saveAll} disabled={!userId}>
            Save all
          </button>
          {!loaded ? <span className="detail-muted">Loading…</span> : null}
        </div>
        <p className="detail-muted" style={{ marginTop: '0.75rem' }}>
          <Link to="/app/integrations">Integrations</Link> for Xero, TrueLayer, and Slack overview.
        </p>
      </section>

      <section className="detail-section pref-section">
        <h2 className="detail-section__title">Audit log</h2>
        <p className="detail-section__lead">Last 20 events.</p>
        {audit.length ? (
          <ul className="pref-audit">
            {audit.map((a) => (
              <li key={a.id} className="pref-audit__item">
                <span className="pref-audit__dot" aria-hidden />
                <div>
                  <p className="pref-audit__desc">{a.description}</p>
                  <p className="pref-audit__time">{daysAgoLabel(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-muted">No audit entries yet.</p>
        )}
      </section>
    </div>
  )
}
