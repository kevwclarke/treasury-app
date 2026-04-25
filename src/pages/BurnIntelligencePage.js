import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { useCountUp } from '../hooks/useCountUp'
import { fetchBurnIntelligenceAi } from '../api/burnIntelligenceAnthropic'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import '../components/DetailPage.css'
import './BurnIntelligencePage.css'

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

function lastNDaysRows(rows, days) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  return rows.filter((r) => {
    const t = new Date(r.date).getTime()
    return Number.isFinite(t) && t >= since
  })
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

function burnByCategory(rows) {
  const byCat = Object.fromEntries(BURN_CATEGORY_ORDER.map((c) => [c, 0]))
  let total = 0
  rows.forEach((r) => {
    const a = Number(r.amount)
    if (!Number.isFinite(a) || a >= 0) return
    const spend = Math.abs(a)
    const cat = categorisePayee(r.payee)
    byCat[cat] = (byCat[cat] || 0) + spend
    total += spend
  })
  return { total, byCat }
}

function topDriversSentence(delta, drivers) {
  if (!drivers.length) return ''
  const lead = drivers[0]
  const second = drivers[1]
  const parts = []
  parts.push(
    `The largest driver is ${lead.category.toLowerCase()} spend which is ${lead.delta >= 0 ? 'up' : 'down'} ${formatGBP(
      Math.round(Math.abs(lead.delta)),
    )} month on month.`,
  )
  if (second && Math.abs(second.delta) > 0) {
    parts.push(
      `${second.category} has also ${second.delta >= 0 ? 'increased' : 'decreased'} ${formatGBP(
        Math.round(Math.abs(second.delta)),
      )}.`,
    )
  }
  return parts.join(' ')
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function scoreBand(score) {
  if (score > 75) return 'good'
  if (score >= 50) return 'warn'
  return 'risk'
}

function categoryColour(cat, effort) {
  const c = String(cat || '').toLowerCase()
  if (effort === 'High') return 'rgba(220, 38, 38, 0.9)'
  if (c.includes('infra')) return 'rgba(27, 43, 140, 0.95)'
  if (c.includes('contract')) return 'rgba(22, 163, 74, 0.95)'
  if (c.includes('marketing') || c.includes('saas')) return 'rgba(217, 119, 6, 0.95)'
  return 'rgba(27, 43, 140, 0.6)'
}

function toMoneyRange(range) {
  const low = Number(range?.low)
  const high = Number(range?.high)
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null
  return { low, high }
}

function makeMailto({ category, amount, savingLow, savingHigh, days, title, recommendation }) {
  const subject = `Action required: ${category} cost review`
  const body = [
    'Hi,',
    '',
    `our treasury autopilot has flagged that our ${category} spend has increased to ${formatGBP(
      Math.round(amount),
    )} per month.`,
    `I would like to schedule a review to identify savings of ${formatGBP(Math.round(savingLow))}-${formatGBP(
      Math.round(savingHigh),
    )} per month and extend our runway by ${Math.round(days)} days.`,
    'Could we find 30 minutes this week?',
    '',
    recommendation,
    '',
    `Action title: ${title}`,
  ].join('\n')
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function makeCalendarUrl({ category, title, recommendation }) {
  // Widely supported web fallback (Google Calendar template).
  const text = `Review ${category} spend — ${title}`
  const details = recommendation
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    text,
  )}&details=${encodeURIComponent(details)}`
}

function BurnTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(15,15,15,0.10)',
        borderRadius: 10,
        padding: '0.65rem 0.75rem',
        boxShadow: '0 8px 24px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.05)',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0F0F0F' }}>{p.label}</p>
      <p style={{ margin: '0.35rem 0 0', fontSize: 12, color: '#6B7280' }}>
        Current: <strong style={{ color: '#DC2626' }}>{formatGBP(Math.round(p.current))}</strong>
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: 12, color: '#6B7280' }}>
        Optimised: <strong style={{ color: '#1B2B8C' }}>{formatGBP(Math.round(p.optimised))}</strong>
      </p>
    </div>
  )
}

async function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BurnIntelligencePage() {
  const { txnLoading, txnError, txnRows } = useTreasuryTransactions()
  const [userId, setUserId] = useState(null)

  const [policy, setPolicy] = useState({
    min_runway_months: 6,
    burn_spike_pct: 15,
    weekly_slack_summary: false,
  })
  const [policyLoaded, setPolicyLoaded] = useState(false)

  const [prefs, setPrefs] = useState({
    burn_intelligence_email: false,
    slack_webhook_url: '',
  })
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  const [actioned, setActioned] = useState([])
  const [audit, setAudit] = useState([])

  const [targetPct, setTargetPct] = useState(12)
  const [targetPounds, setTargetPounds] = useState('')
  const [targetMode, setTargetMode] = useState('pct') // 'pct' | 'gbp'

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [opps, setOpps] = useState([])

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

    async function loadTables() {
      const [{ data: pol }, { data: pr }, { data: ba }, { data: al }] = await Promise.all([
        supabase.from('treasury_policies').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('email_preferences').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('burn_actions').select('*').eq('user_id', userId).order('actioned_at', { ascending: false }),
        supabase.from('audit_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ])

      if (cancelled) return

      if (pol) {
        setPolicy({
          min_runway_months: Number(pol.min_runway_months) || 6,
          burn_spike_pct: Number(pol.burn_spike_pct) || 15,
          weekly_slack_summary: Boolean(pol.weekly_slack_summary),
        })
      }
      setPolicyLoaded(true)

      if (pr) {
        setPrefs({
          burn_intelligence_email: Boolean(pr.burn_intelligence_email),
          slack_webhook_url: String(pr.slack_webhook_url || ''),
        })
      }
      setPrefsLoaded(true)

      setActioned(Array.isArray(ba) ? ba : [])
      setAudit(Array.isArray(al) ? al : [])
    }

    loadTables()
    return () => {
      cancelled = true
    }
  }, [userId])

  const rows90 = useMemo(() => lastNDaysRows(txnRows, 90), [txnRows])
  const rows60 = useMemo(() => lastNDaysRows(txnRows, 60), [txnRows])
  const { last: last30, prior: prior30 } = useMemo(() => splitLast30VsPrior30(txnRows), [txnRows])

  const burnLast30 = useMemo(() => burnByCategory(last30), [last30])
  const burnPrior30 = useMemo(() => burnByCategory(prior30), [prior30])

  const burnDelta = burnLast30.total - burnPrior30.total
  const driverDeltas = useMemo(() => {
    const list = BURN_CATEGORY_ORDER.map((c) => ({
      category: c,
      delta: (burnLast30.byCat[c] || 0) - (burnPrior30.byCat[c] || 0),
    }))
    return list
      .filter((x) => Math.abs(x.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
  }, [burnLast30.byCat, burnPrior30.byCat])

  const summarySentence = useMemo(() => {
    if (!burnLast30.total && !burnPrior30.total) return 'Upload transactions to generate your burn intelligence summary.'
    const main =
      burnDelta >= 0
        ? `Since last month your burn has increased by ${formatGBP(Math.round(burnDelta))}.`
        : `Since last month your burn has decreased by ${formatGBP(Math.round(Math.abs(burnDelta)))}.`
    const drivers = topDriversSentence(burnDelta, driverDeltas)
    return [main, drivers].filter(Boolean).join(' ')
  }, [burnDelta, burnLast30.total, burnPrior30.total, driverDeltas])

  const burn90 = useMemo(() => burnByCategory(rows90), [rows90])
  const burn60ForTrend = useMemo(() => burnByCategory(rows60), [rows60])
  const burn90Monthly = burn90.total / 3
  const burn60Monthly = burn60ForTrend.total / 2
  const burnChangePct90 = burn60Monthly > 0 ? ((burn90Monthly - burn60Monthly) / burn60Monthly) * 100 : 0

  const catShareTop = useMemo(() => {
    const entries = Object.entries(burn90.byCat || {})
    const top = entries.sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]
    if (!top) return { cat: null, pct: 0 }
    const pct = burn90.total > 0 ? (top[1] / burn90.total) * 100 : 0
    return { cat: top[0], pct }
  }, [burn90.byCat, burn90.total])

  const monthlyBuckets = useMemo(() => {
    const byMonth = {}
    rows90.forEach((r) => {
      const t = new Date(r.date)
      if (Number.isNaN(t.getTime())) return
      const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[k]) byMonth[k] = 0
      const a = Number(r.amount)
      if (!Number.isFinite(a) || a >= 0) return
      byMonth[k] += Math.abs(a)
    })
    const keys = Object.keys(byMonth).sort()
    const totals = keys.map((k) => ({ k, total: byMonth[k] }))
    return totals.slice(-4) // enough for 3 consecutive check
  }, [rows90])

  const increased3ConsecutiveMonths = useMemo(() => {
    if (monthlyBuckets.length < 4) return false
    const a = monthlyBuckets.slice(-4).map((x) => x.total)
    return a[1] > a[0] && a[2] > a[1] && a[3] > a[2]
  }, [monthlyBuckets])

  const contractorChangePct90 = useMemo(() => {
    const rowsA = lastNDaysRows(txnRows, 90)
    const rowsB = lastNDaysRows(txnRows, 180).filter((r) => {
      const t = new Date(r.date).getTime()
      return Number.isFinite(t) && t < Date.now() - 90 * 24 * 60 * 60 * 1000
    })
    const a = burnByCategory(rowsA).byCat.Contractors || 0
    const b = burnByCategory(rowsB).byCat.Contractors || 0
    const am = a / 3
    const bm = b / 3
    return bm > 0 ? ((am - bm) / bm) * 100 : 0
  }, [txnRows])

  const infraChangePct90 = useMemo(() => {
    const rowsA = lastNDaysRows(txnRows, 90)
    const rowsB = lastNDaysRows(txnRows, 180).filter((r) => {
      const t = new Date(r.date).getTime()
      return Number.isFinite(t) && t < Date.now() - 90 * 24 * 60 * 60 * 1000
    })
    const a = burnByCategory(rowsA).byCat.Infrastructure || 0
    const b = burnByCategory(rowsB).byCat.Infrastructure || 0
    const am = a / 3
    const bm = b / 3
    return bm > 0 ? ((am - bm) / bm) * 100 : 0
  }, [txnRows])

  const burnHealth = useMemo(() => {
    let score = 100
    const reasons = []

    if (burnChangePct90 > 15) {
      score -= 25
      reasons.push(`Monthly burn is up ${formatPct(burnChangePct90, 1)} vs the prior period.`)
    }
    if (catShareTop.pct > 70) {
      score -= 20
      reasons.push(`${catShareTop.cat} is ${formatPct(catShareTop.pct, 0)} of total burn (category concentration).`)
    }
    if (increased3ConsecutiveMonths) {
      score -= 15
      reasons.push('Burn has increased for three consecutive months.')
    }
    if (contractorChangePct90 > 20) {
      score -= 15
      reasons.push(`Contractor spend is up ${formatPct(contractorChangePct90, 1)} over 90 days.`)
    }
    if (infraChangePct90 > 30) {
      score -= 10
      reasons.push(`Infrastructure spend is up ${formatPct(infraChangePct90, 1)} over 90 days.`)
    }

    score = clamp(score, 0, 100)
    return { score, band: scoreBand(score), reasons }
  }, [burnChangePct90, catShareTop.cat, catShareTop.pct, increased3ConsecutiveMonths, contractorChangePct90, infraChangePct90])

  const scoreAnimated = useCountUp(burnHealth.score, { enabled: !txnLoading })

  const runwayCore = useMemo(() => computeRunwayFromTransactions(txnRows), [txnRows])
  const currentRunwayMo = runwayCore.baseRunwayMo ?? null

  const currentMonthlyBurn = useMemo(() => (Number.isFinite(burn90Monthly) ? burn90Monthly : 0), [burn90Monthly])

  const targetSavingFromPct = (currentMonthlyBurn * targetPct) / 100
  const targetSavingFromPounds = Number(targetPounds) || 0
  const targetSaving = targetMode === 'gbp' ? Math.max(0, targetSavingFromPounds) : Math.max(0, targetSavingFromPct)
  const targetBurn = Math.max(0, currentMonthlyBurn - targetSaving)

  const savingFor24Mo = useMemo(() => {
    if (!Number.isFinite(runwayCore.totalCash) || runwayCore.totalCash <= 0) return null
    const requiredBurn = runwayCore.totalCash / 24
    return Math.max(0, currentMonthlyBurn - requiredBurn)
  }, [currentMonthlyBurn, runwayCore.totalCash])

  const actionedTotals = useMemo(() => {
    const all = actioned || []
    let actionedLow = 0
    let actionedHigh = 0
    all.forEach((a) => {
      actionedLow += Number(a.estimated_saving_low) || 0
      actionedHigh += Number(a.estimated_saving_high) || 0
    })
    return { actionedLow, actionedHigh }
  }, [actioned])

  const totalOppIdentified = useMemo(() => {
    let low = 0
    let high = 0
    opps.forEach((o) => {
      const r = toMoneyRange(o?.estimatedMonthlySaving)
      if (!r) return
      low += r.low
      high += r.high
    })
    return { low, high }
  }, [opps])

  const remainingOpp = useMemo(() => {
    return {
      low: Math.max(0, totalOppIdentified.low - actionedTotals.actionedLow),
      high: Math.max(0, totalOppIdentified.high - actionedTotals.actionedHigh),
    }
  }, [actionedTotals.actionedHigh, actionedTotals.actionedLow, totalOppIdentified.high, totalOppIdentified.low])

  const forecast = useMemo(() => {
    const current = currentMonthlyBurn
    const optimised = Math.max(0, currentMonthlyBurn - actionedTotals.actionedHigh)
    const points = []
    const now = new Date()
    for (let i = 0; i <= 6; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      points.push({
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        current,
        optimised,
      })
    }
    const runwayExtMo =
      runwayCore.totalCash > 0 && optimised > 0 ? runwayCore.totalCash / optimised - (runwayCore.totalCash / current || 0) : 0
    return { points, runwayExtMo }
  }, [actionedTotals.actionedHigh, currentMonthlyBurn, runwayCore.totalCash])

  const policyStatus = useMemo(() => {
    const runwayOk = currentRunwayMo != null ? currentRunwayMo >= policy.min_runway_months : false
    const burnSpikeOk = burnChangePct90 <= policy.burn_spike_pct
    return { runwayOk, burnSpikeOk }
  }, [burnChangePct90, currentRunwayMo, policy.burn_spike_pct, policy.min_runway_months])

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
        .limit(10)
      setAudit(Array.isArray(data) ? data : [])
    },
    [userId],
  )

  async function refreshActioned() {
    if (!userId) return
    const { data } = await supabase
      .from('burn_actions')
      .select('*')
      .eq('user_id', userId)
      .order('actioned_at', { ascending: false })
    setActioned(Array.isArray(data) ? data : [])
  }

  async function handleFetchOpportunities() {
    setAiLoading(true)
    setAiError('')
    try {
      const spend90 = burn90.byCat
      const payload = {
        spendByCategoryGbp: BURN_CATEGORY_ORDER.map((c) => ({
          category: c,
          monthlySpend: Math.round((spend90[c] || 0) / 3),
        })),
      }
      const data = await fetchBurnIntelligenceAi({ mode: 'opportunities', payload })
      if (!Array.isArray(data?.opportunities)) throw new Error('Unexpected AI response')
      setOpps(data.opportunities)
    } catch (e) {
      setAiError(e?.message || 'AI request failed')
      setOpps([])
    } finally {
      setAiLoading(false)
    }
  }

  async function handleGenerateBrief(opp) {
    if (!opp) return
    await insertAudit({
      action_type: 'generate_brief',
      category: opp.category,
      description: `Generated negotiation brief: ${opp.title}`,
      metadata: { opportunity: opp },
    })

    const data = await fetchBurnIntelligenceAi({ mode: 'brief', payload: { opportunity: opp } })
    const html = String(data?.html || '')
    const today = new Date().toISOString().slice(0, 10)
    const safeCat = String(opp.category || 'category').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await downloadHtml(`${safeCat}-brief-${today}.html`, html)
  }

  async function handleMarkActioned(opp) {
    if (!userId || !opp) return
    const r = toMoneyRange(opp.estimatedMonthlySaving) || { low: 0, high: 0 }
    await supabase.from('burn_actions').insert({
      user_id: userId,
      category: opp.category,
      title: opp.title,
      estimated_saving_low: r.low,
      estimated_saving_high: r.high,
      actioned_at: new Date().toISOString(),
      confirmed: false,
    })
    await insertAudit({
      action_type: 'mark_actioned',
      category: opp.category,
      description: `Marked actioned: ${opp.title}`,
      metadata: { opportunity: opp },
    })
    await refreshActioned()
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
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Treasury Autopilot Test' } },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Slack integration is connected.* You will receive burn spike alerts here.' },
          },
        ],
      }),
    })
  }

  async function savePrefsAndPolicy() {
    if (!userId) return
    await supabase.from('treasury_policies').upsert({ user_id: userId, ...policy }, { onConflict: 'user_id' })
    await supabase
      .from('email_preferences')
      .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })
    await insertAudit({
      action_type: 'update_policies',
      category: null,
      description: 'Updated treasury autopilot policies and preferences',
      metadata: { policy, prefs: { burn_intelligence_email: prefs.burn_intelligence_email, slack_webhook_url: !!prefs.slack_webhook_url } },
    })
  }

  useEffect(() => {
    if (slackAutoSentRef.current) return
    if (!prefsLoaded || !policyLoaded) return
    if (!prefs.slack_webhook_url?.trim()) return
    if (txnLoading || !txnRows.length) return

    const perCatLast = burnLast30.byCat
    const perCatPrior = burnPrior30.byCat
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
    const topOpp = opps.find((o) => String(o.category) === String(top.category)) || opps[0]
    const actionTitle = topOpp?.title || 'Review category spend'
    const savingRange = toMoneyRange(topOpp?.estimatedMonthlySaving)
    const savingText = savingRange ? `${formatGBP(Math.round(savingRange.low))}-${formatGBP(Math.round(savingRange.high))}` : '—'

    slackAutoSentRef.current = true
    fetch(prefs.slack_webhook_url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Treasury Autopilot Alert',
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Treasury Autopilot Alert' } },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${top.category}* spend up *${formatPct(top.pct, 1)}* this month — *${formatGBP(
                Math.round(top.a / 30 * 30),
              )}* vs *${formatGBP(Math.round(top.b / 30 * 30))}* last month.\n*Recommended action:* ${actionTitle}\n*Potential saving:* ${savingText} per month.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View in Treasury Autopilot' },
                url: `${window.location.origin}/app/burn-intelligence`,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Mark as Seen' },
                url: `${window.location.origin}/app/burn-intelligence?seen=1`,
              },
            ],
          },
        ],
      }),
    })
      .then(() =>
        insertAudit({
          action_type: 'slack_auto_alert',
          category: top.category,
          description: `Sent Slack burn spike alert for ${top.category}`,
          metadata: { pct: top.pct, current: top.a, prior: top.b },
        }),
      )
      .catch(() => {})
  }, [
    burnLast30.byCat,
    burnPrior30.byCat,
    insertAudit,
    opps,
    policy.burn_spike_pct,
    policyLoaded,
    prefs.slack_webhook_url,
    prefsLoaded,
    txnLoading,
    txnRows.length,
  ])

  const sortedOpps = useMemo(() => {
    const actionedTitles = new Set(actioned.map((a) => String(a.title)))
    const open = opps.filter((o) => !actionedTitles.has(String(o.title)))
    const done = opps.filter((o) => actionedTitles.has(String(o.title)))
    return [...open, ...done]
  }, [actioned, opps])

  return (
    <div className="detail-page burn-intel">
      <header className="detail-hero">
        <h1 className="detail-title">Burn Intelligence</h1>
        <p className="detail-sub">Specific actions to reduce your monthly spend — ranked by impact</p>
        <p className="burn-intel__crosslink-top">
          For treasury and cash structure actions see{' '}
          <Link to="/app">Autopilot Recommendations</Link> on the dashboard.
        </p>
      </header>

      <section className="detail-section burn-intel__summary">
        <h2 className="detail-section__title">What changed</h2>
        {txnLoading ? <p className="detail-muted">Loading transactions…</p> : <p>{summarySentence}</p>}
        {txnError ? <p className="detail-muted" style={{ marginTop: 8, color: '#DC2626' }}>{txnError}</p> : null}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Burn health score</h2>
        <div className="burn-intel__score-row">
          <div className="burn-intel__score">
            <div className="burn-intel__score-val">
              {txnLoading ? '—' : Math.round(scoreAnimated)}
              <span style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 600 }}> / 100</span>
            </div>
            <div className={`burn-intel__score-pill burn-intel__score-pill--${burnHealth.band}`}>
              <span className="burn-intel__score-dot" aria-hidden />
              {burnHealth.band === 'good' ? 'Green (healthy)' : burnHealth.band === 'warn' ? 'Amber (watch)' : 'Red (risk)'}
            </div>
          </div>
          <p className="burn-intel__score-notes">
            {txnLoading
              ? 'Calculating score drivers…'
              : burnHealth.reasons.length
                ? burnHealth.reasons.slice(0, 3).join(' ')
                : 'No major burn risk signals detected from the last 90 days.'}
          </p>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Reduction target</h2>
        {txnLoading ? (
          <p className="detail-muted">Loading…</p>
        ) : (
          <>
            <p className="detail-section__lead" style={{ marginBottom: 12 }}>
              Current monthly burn (last 90 days): <strong>{formatGBP(Math.round(currentMonthlyBurn))}</strong>
            </p>

            <div className="burn-intel__target-grid">
              <div className="detail-stat" style={{ borderColor: 'rgba(27, 43, 140, 0.25)', background: 'rgba(27, 43, 140, 0.04)' }}>
                <p className="detail-stat__cap">Option A — % reduction</p>
                <input
                  className="detail-input"
                  type="range"
                  min={5}
                  max={30}
                  value={targetPct}
                  onChange={(e) => {
                    setTargetMode('pct')
                    setTargetPct(Number(e.target.value) || 12)
                  }}
                />
                <p className="detail-muted" style={{ marginTop: 6 }}>
                  Target: <strong>{targetPct}%</strong> (save {formatGBP(Math.round(targetSavingFromPct))}/mo)
                </p>
              </div>
              <div className="detail-stat" style={{ borderColor: 'rgba(27, 43, 140, 0.25)', background: 'rgba(27, 43, 140, 0.04)' }}>
                <p className="detail-stat__cap">Option B — £ saving / month</p>
                <input
                  className="detail-input"
                  type="number"
                  min={0}
                  value={targetPounds}
                  onChange={(e) => {
                    setTargetMode('gbp')
                    setTargetPounds(e.target.value)
                  }}
                  placeholder="e.g. 15000"
                />
                <p className="detail-muted" style={{ marginTop: 6 }}>
                  Target saving: <strong>{formatGBP(Math.round(targetSavingFromPounds || 0))}</strong> / month
                </p>
              </div>
            </div>

            <div className="burn-intel__bar" aria-label="Before and after burn">
              <div className="burn-intel__bar-row">
                <div className="burn-intel__bar-cell burn-intel__bar-cell--current">
                  <span>Current burn</span>
                  <strong style={{ color: '#DC2626' }}>{formatGBP(Math.round(currentMonthlyBurn))}</strong>
                </div>
                <div className="burn-intel__bar-cell burn-intel__bar-cell--target">
                  <span>Target burn</span>
                  <strong style={{ color: '#1B2B8C' }}>{formatGBP(Math.round(targetBurn))}</strong>
                </div>
              </div>
            </div>

            <p className="detail-muted" style={{ marginTop: 10 }}>
              Target saving: <strong>{formatGBP(Math.round(targetSaving))}</strong> / month.{' '}
              {savingFor24Mo != null ? (
                <>
                  To reach <strong>24 months runway</strong> you need to save{' '}
                  <strong>{formatGBP(Math.round(savingFor24Mo))}</strong> per month.
                </>
              ) : (
                'Upload a longer history to compute runway targets.'
              )}
            </p>
          </>
        )}
      </section>

      <section className="detail-section">
        <div className="burn-intel__ai-head">
          <div className="burn-intel__ai-head-text">
            <div className="burn-intel__title-row">
              <h2 className="detail-section__title burn-intel__ai-title">AI opportunities</h2>
              <span className="burn-intel__badge-spend">Spend</span>
            </div>
            <p className="burn-intel__subtitle-spend">Spend actions — reduce costs without cutting headcount</p>
            <p className="detail-section__lead burn-intel__ai-lead">
              Five concrete opportunities ranked by impact. We never recommend headcount or salary cuts.
            </p>
          </div>
          <button type="button" className="detail-btn detail-btn--dark" onClick={handleFetchOpportunities} disabled={aiLoading || txnLoading}>
            {aiLoading ? 'Generating…' : 'Generate 5 actions'}
          </button>
        </div>
        {aiError ? <p className="detail-muted" style={{ color: '#DC2626' }}>{aiError}</p> : null}
        {!txnLoading && !txnRows.length ? (
          <p className="detail-muted">
            Upload a bank CSV first. <Link to="/upload">Upload statement</Link>
          </p>
        ) : null}
        {opps.length ? (
          <div className="burn-intel__cards" style={{ marginTop: 14 }}>
            {sortedOpps.map((o) => {
              const saving = toMoneyRange(o.estimatedMonthlySaving) || { low: 0, high: 0 }
              const actionedTitles = new Set(actioned.map((a) => String(a.title)))
              const isActioned = actionedTitles.has(String(o.title))
              const effort = String(o.effort || '').trim()
              return (
                <article
                  key={`${o.title}-${o.category}`}
                  className="burn-intel__opp"
                  style={{ '--bi-opp-border': categoryColour(o.category, effort) }}
                >
                  <div className="burn-intel__opp-head">
                    <span className="burn-intel__badge">{o.category}</span>
                    <span className="burn-intel__pill">{formatGBP(Math.round(Number(o.currentMonthlySpend) || 0))}/mo</span>
                  </div>
                  <h3 className="burn-intel__title">{o.title}</h3>
                  <p className="burn-intel__body">{o.recommendedAction}</p>
                  <div className="burn-intel__meta">
                    <span className="burn-intel__pill burn-intel__pill--save">
                      Save {formatGBP(Math.round(saving.low))}-{formatGBP(Math.round(saving.high))}/month
                    </span>
                    <span className="burn-intel__pill">{Math.round(Number(o.runwayExtensionDays) || 0)} days runway</span>
                    <span
                      className={[
                        'burn-intel__pill',
                        effort === 'Low'
                          ? 'burn-intel__pill--effort-low'
                          : effort === 'High'
                            ? 'burn-intel__pill--effort-high'
                            : 'burn-intel__pill--effort-medium',
                      ].join(' ')}
                    >
                      Effort: {effort || 'Medium'}
                    </span>
                    <span className="burn-intel__pill">{isActioned ? 'Actioned' : 'Open'}</span>
                  </div>

                  <div className="burn-intel__actions">
                    <a
                      className="burn-intel__btn burn-intel__btn--primary"
                      href={makeCalendarUrl({ category: o.category, title: o.title, recommendation: o.recommendedAction })}
                      onClick={() =>
                        insertAudit({
                          action_type: 'schedule_review',
                          category: o.category,
                          description: `Scheduled review: ${o.title}`,
                          metadata: { opportunity: o },
                        })
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Schedule review
                    </a>
                    <a
                      className="burn-intel__btn"
                      href={makeMailto({
                        category: o.category,
                        amount: Number(o.currentMonthlySpend) || 0,
                        savingLow: saving.low,
                        savingHigh: saving.high,
                        days: Number(o.runwayExtensionDays) || 0,
                        title: o.title,
                        recommendation: o.recommendedAction,
                      })}
                      onClick={() =>
                        insertAudit({
                          action_type: 'draft_email',
                          category: o.category,
                          description: `Drafted email: ${o.title}`,
                          metadata: { opportunity: o },
                        })
                      }
                    >
                      Draft email
                    </a>
                    <button
                      type="button"
                      className="burn-intel__btn burn-intel__btn--outline"
                      onClick={() => handleGenerateBrief(o)}
                    >
                      Generate brief
                    </button>
                    <button
                      type="button"
                      className="burn-intel__btn"
                      onClick={() => handleMarkActioned(o)}
                      disabled={isActioned}
                    >
                      {isActioned ? 'Actioned' : 'Mark actioned'}
                    </button>
                  </div>

                  {isActioned ? (
                    <div className="burn-intel__status">
                      <svg
                        className="burn-intel__status-check"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          d="M5 12l4 4L19 6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Status: Actioned
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="detail-muted" style={{ marginTop: 10 }}>
            Click “Generate 5 actions” to create ranked burn reduction opportunities from your last 90 days of spend.
          </p>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Actioned savings tracker</h2>
        <div className="detail-grid3">
          <div className="detail-stat" style={{ borderColor: 'rgba(27, 43, 140, 0.28)', background: 'rgba(27, 43, 140, 0.06)' }}>
            <p className="detail-stat__cap">Total savings identified</p>
            <p className="detail-stat__val" style={{ color: '#1B2B8C' }}>
              {formatGBP(Math.round(totalOppIdentified.low))}–{formatGBP(Math.round(totalOppIdentified.high))}
            </p>
          </div>
          <div className="detail-stat" style={{ borderColor: 'rgba(22, 163, 74, 0.28)', background: 'rgba(22, 163, 74, 0.06)' }}>
            <p className="detail-stat__cap">Total actioned</p>
            <p className="detail-stat__val detail-stat__val--green">
              {formatGBP(Math.round(actionedTotals.actionedLow))}–{formatGBP(Math.round(actionedTotals.actionedHigh))}
            </p>
          </div>
          <div className="detail-stat" style={{ borderColor: 'rgba(107, 114, 128, 0.2)', background: 'rgba(107, 114, 128, 0.06)' }}>
            <p className="detail-stat__cap">Remaining opportunity</p>
            <p className="detail-stat__val" style={{ color: '#6B7280' }}>
              {formatGBP(Math.round(remainingOpp.low))}–{formatGBP(Math.round(remainingOpp.high))}
            </p>
          </div>
        </div>

        {actioned.length ? (
          <div style={{ marginTop: 14 }}>
            {actioned.map((a) => (
              <div key={a.id} className="detail-row" style={{ marginBottom: 10 }}>
                <div>
                  <p className="detail-row__title">{a.title}</p>
                  <p className="detail-muted" style={{ margin: 0 }}>
                    {a.category} · actioned {a.actioned_at ? new Date(a.actioned_at).toLocaleDateString('en-GB') : '—'}
                  </p>
                </div>
                <div className="detail-row__val" style={{ color: '#166534' }}>
                  {formatGBP(Math.round(Number(a.estimated_saving_low) || 0))}–{formatGBP(Math.round(Number(a.estimated_saving_high) || 0))}/mo
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-muted" style={{ marginTop: 10 }}>
            Mark actions as actioned to track your savings pipeline.
          </p>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Burn forecast</h2>
        <p className="detail-section__lead">
          Before/after projection: current burn in red, optimised burn in navy (using your actioned savings).
        </p>
        <div style={{ width: '100%', height: 240, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={forecast.points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(15,15,15,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
                width={44}
              />
              <Tooltip content={<BurnTooltip />} />
              <Line type="monotone" dataKey="current" stroke="#DC2626" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="optimised" stroke="#1B2B8C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="burn-intel__bar" aria-label="Forecast summary">
          <div className="burn-intel__bar-row">
            <div className="burn-intel__bar-cell burn-intel__bar-cell--current">
              <span>Projected burn</span>
              <strong style={{ color: '#DC2626' }}>{formatGBP(Math.round(currentMonthlyBurn))}/mo</strong>
            </div>
            <div className="burn-intel__bar-cell burn-intel__bar-cell--target">
              <span>Optimised burn</span>
              <strong style={{ color: '#1B2B8C' }}>
                {formatGBP(Math.round(Math.max(0, currentMonthlyBurn - actionedTotals.actionedHigh)))}/mo
              </strong>
            </div>
          </div>
        </div>
        <p className="detail-muted" style={{ marginTop: 10 }}>
          Runway extension if all actioned savings confirmed: <strong>{Number.isFinite(forecast.runwayExtMo) ? forecast.runwayExtMo.toFixed(1) : '0.0'} months</strong>
        </p>
      </section>

      <section className="detail-section burn-intel__policy-card">
        <h2 className="detail-section__title">My Treasury Policies</h2>
        <p className="detail-section__lead">
          Treasury Autopilot — we maintain the CFO&apos;s runway automatically. Configure policies and we enforce them via alerts and action tracking.
        </p>

        <div className="detail-grid3" style={{ marginTop: 12 }}>
          <div className="detail-stat">
            <label className="detail-stat__cap" htmlFor="min-runway">
              Minimum runway target (months)
            </label>
            <input
              id="min-runway"
              className="detail-input"
              type="number"
              min={1}
              value={policy.min_runway_months}
              onChange={(e) => setPolicy((p) => ({ ...p, min_runway_months: Number(e.target.value) || 6 }))}
            />
            <p className="detail-muted" style={{ marginTop: 8 }}>
              Status:{' '}
              <strong style={{ color: policyStatus.runwayOk ? '#1B2B8C' : '#DC2626' }}>
                {currentRunwayMo == null ? 'Unknown' : policyStatus.runwayOk ? 'Meeting policy' : 'Breaching policy'}
              </strong>
            </p>
          </div>
          <div className="detail-stat">
            <label className="detail-stat__cap" htmlFor="burn-spike">
              Burn spike alert threshold (%)
            </label>
            <input
              id="burn-spike"
              className="detail-input"
              type="number"
              min={5}
              max={60}
              value={policy.burn_spike_pct}
              onChange={(e) => setPolicy((p) => ({ ...p, burn_spike_pct: Number(e.target.value) || 15 }))}
            />
            <p className="detail-muted" style={{ marginTop: 8 }}>
              Status:{' '}
              <strong style={{ color: policyStatus.burnSpikeOk ? '#1B2B8C' : '#DC2626' }}>
                {policyStatus.burnSpikeOk ? 'No spike detected' : 'Spike detected'}
              </strong>
            </p>
          </div>
          <div className="detail-stat">
            <p className="detail-stat__cap">Weekly Slack summary</p>
            <label className="detail-toggle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={policy.weekly_slack_summary}
                onChange={(e) => setPolicy((p) => ({ ...p, weekly_slack_summary: e.target.checked }))}
              />
              <span className="detail-muted" style={{ margin: 0 }}>
                {policy.weekly_slack_summary ? 'Enabled' : 'Disabled'}
              </span>
            </label>
            <p className="detail-muted" style={{ marginTop: 8 }}>
              Status: <strong style={{ color: '#1B2B8C' }}>Configured</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" className="detail-btn detail-btn--dark" onClick={savePrefsAndPolicy} disabled={!userId || txnLoading}>
            Save policies
          </button>
          {!policyLoaded || !prefsLoaded ? <span className="detail-muted">Loading current policies…</span> : null}
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Slack integration</h2>
        <p className="detail-section__lead">Add an incoming webhook URL. We will send automatic burn spike alerts on page load.</p>
        <input
          className="detail-input"
          type="url"
          placeholder="https://hooks.slack.com/services/…"
          value={prefs.slack_webhook_url}
          onChange={(e) => setPrefs((p) => ({ ...p, slack_webhook_url: e.target.value }))}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="detail-btn detail-btn--dark" onClick={handleSlackTest} disabled={!prefs.slack_webhook_url?.trim()}>
            Test
          </button>
          <button type="button" className="detail-btn detail-btn--dark" onClick={savePrefsAndPolicy} disabled={!userId}>
            Save
          </button>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Monthly email preference</h2>
        <p className="detail-section__lead">Monthly Burn Intelligence Report (sending via Resend is a future session).</p>
        <label className="detail-toggle" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={prefs.burn_intelligence_email}
            onChange={(e) => setPrefs((p) => ({ ...p, burn_intelligence_email: e.target.checked }))}
          />
          <span className="detail-muted" style={{ margin: 0 }}>
            {prefs.burn_intelligence_email ? 'Enabled' : 'Disabled'}
          </span>
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="detail-btn detail-btn--dark" onClick={savePrefsAndPolicy} disabled={!userId}>
            Save preference
          </button>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section__title">Audit log</h2>
        {audit.length ? (
          <div className="burn-intel__timeline" style={{ marginTop: 10 }}>
            {audit.map((a) => (
              <div key={a.id} className="burn-intel__timeline-item">
                <span className="burn-intel__timeline-icon" aria-hidden>
                  ↗
                </span>
                <div className="burn-intel__timeline-body">
                  <p className="burn-intel__timeline-desc">{a.description}</p>
                  <p className="burn-intel__timeline-time">{daysAgoLabel(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-muted">No audit entries yet.</p>
        )}
      </section>

      <p className="detail-muted" style={{ marginTop: 6 }}>
        Back to <Link to="/app">Treasury Autopilot</Link>
      </p>
    </div>
  )
}

