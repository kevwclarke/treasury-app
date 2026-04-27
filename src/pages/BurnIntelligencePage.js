import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useTreasuryTransactions } from '../hooks/useTreasuryTransactions'
import { useCountUp } from '../hooks/useCountUp'
import { fetchBurnIntelligenceAi } from '../api/burnIntelligenceAnthropic'
import { BURN_CATEGORY_ORDER, categorisePayee } from '../utils/treasuryBurn'
import { formatGBP, formatPct } from '../utils/treasuryFormat'
import { computeRunwayFromTransactions } from '../utils/treasuryRunway'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ModuleCapitalMoves } from '../components/ModuleCapitalMoves'
import { TermTooltip } from '../components/TermTooltip'
import '../components/DetailPage.css'
import './BurnIntelligencePage.css'

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

function toMoneyRange(range) {
  const low = Number(range?.low)
  const high = Number(range?.high)
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null
  return { low, high }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function makeBurnScheduleUrl(opp, runwayMo, monthlyBurn) {
  const who = `CFO, Finance lead, and owner of the ${opp.category || 'category'} budget`
  const details = [
    `Who should attend: ${who}`,
    '',
    'What to discuss:',
    '- Validate current spend vs benchmarks',
    '- Agree negotiation targets and timeline',
    '- Assign owners for vendor outreach',
    '',
    `Context: ${String(opp.recommendedAction || '')}`,
    '',
    `Figures: ~${formatGBP(Math.round(monthlyBurn))}/mo burn`,
    runwayMo != null && Number.isFinite(runwayMo) ? `Runway ~${runwayMo.toFixed(1)} months.` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const text = `Review: ${opp.title}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&details=${encodeURIComponent(details)}`
}

function buildOpportunitySummaryHtml(opp, ctx) {
  const s = toMoneyRange(opp.estimatedMonthlySaving) || { low: 0, high: 0 }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(
    opp.title,
  )}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#111;line-height:1.5}</style></head><body>
<h1>${escapeHtml(opp.title)}</h1>
<p><strong>Category:</strong> ${escapeHtml(String(opp.category || ''))}</p>
<p>${escapeHtml(String(opp.recommendedAction || ''))}</p>
<p><strong>Current spend:</strong> ${formatGBP(Math.round(Number(opp.currentMonthlySpend) || 0))}/month</p>
<p><strong>Estimated saving:</strong> ${formatGBP(Math.round(s.low))}–${formatGBP(Math.round(s.high))}/month</p>
<p><strong>Runway extension:</strong> ~${Math.round(Number(opp.runwayExtensionDays) || 0)} days if savings confirmed</p>
<hr/>
<p style="color:#666;font-size:14px">Burn Intelligence summary — ${escapeHtml(ctx.generatedAt)}</p>
</body></html>`
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

  const [actioned, setActioned] = useState([])

  const [targetPct, setTargetPct] = useState(12)
  const [targetPounds, setTargetPounds] = useState('')
  const [targetMode, setTargetMode] = useState('pct') // 'pct' | 'gbp'

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [opps, setOpps] = useState([])

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
      const { data: ba } = await supabase
        .from('burn_actions')
        .select('*')
        .eq('user_id', userId)
        .order('actioned_at', { ascending: false })
      if (cancelled) return
      setActioned(Array.isArray(ba) ? ba : [])
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

  const insertAudit = useCallback(async ({ action_type, category, description, metadata }) => {
    if (!userId) return
    await supabase.from('audit_log').insert({
      user_id: userId,
      action_type,
      category: category || null,
      description,
      metadata: metadata || null,
    })
  }, [userId])

  const refreshActioned = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('burn_actions')
      .select('*')
      .eq('user_id', userId)
      .order('actioned_at', { ascending: false })
    setActioned(Array.isArray(data) ? data : [])
  }, [userId])

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
      if (!Array.isArray(data?.opportunities)) throw new Error('Unexpected response')
      setOpps(data.opportunities)
    } catch (e) {
      setAiError(e?.message || 'Request failed')
      setOpps([])
    } finally {
      setAiLoading(false)
    }
  }

  const handleDownloadSummary = useCallback(
    async (opp) => {
      if (!opp) return
      await insertAudit({
        action_type: 'download_summary',
        category: opp.category,
        description: `Downloaded summary: ${opp.title}`,
        metadata: { opportunity: opp },
      })
      const today = new Date().toISOString().slice(0, 10)
      const safeCat = String(opp.category || 'category').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const html = buildOpportunitySummaryHtml(opp, { generatedAt: new Date().toLocaleString('en-GB') })
      await downloadHtml(`${safeCat}-summary-${today}.html`, html)
    },
    [insertAudit],
  )

  const handleMarkActioned = useCallback(
    async (opp) => {
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
    },
    [insertAudit, refreshActioned, userId],
  )

  const sortedOpps = useMemo(() => {
    const actionedTitles = new Set(actioned.map((a) => String(a.title)))
    const open = opps.filter((o) => !actionedTitles.has(String(o.title)))
    const done = opps.filter((o) => actionedTitles.has(String(o.title)))
    return [...open, ...done]
  }, [actioned, opps])

  const toCapsSixWords = useCallback((title) => {
    return String(title || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .map((w) => w.toUpperCase())
      .join(' ')
  }, [])

  const burnCapitalMoves = useMemo(() => {
    const actionedTitles = new Set(actioned.map((a) => String(a.title)))
    const runwayMo = currentRunwayMo
    return sortedOpps
      .filter((o) => !actionedTitles.has(String(o.title)))
      .map((o) => {
        const saving = toMoneyRange(o.estimatedMonthlySaving) || { low: 0, high: 0 }
        const effort = String(o.effort || '').trim()
        const impactYear = saving.high * 12
        const wait30 = saving.high
        return {
          id: `opp-${String(o.title).slice(0, 80)}`,
          titleCaps: toCapsSixWords(o.title),
          description: String(
            o.recommendedAction ||
              `Negotiate ${o.category} spend using your latest 90-day transaction pattern.`,
          ),
          who: effort === 'High' ? 'CFO' : 'Finance Team',
          time: effort === 'Low' ? 'This week' : 'Within 30 days',
          impactGbpYear: impactYear,
          costWaiting30: wait30,
          primaryLabel: 'Download Summary',
          onPrimary: () => handleDownloadSummary(o),
          secondaryLabel: 'Schedule',
          secondaryHref: makeBurnScheduleUrl(o, runwayMo, currentMonthlyBurn),
          onSecondaryClick: () => {
            void insertAudit({
              action_type: 'schedule_review',
              category: o.category,
              description: `Opened schedule: ${o.title}`,
              metadata: { opportunity: o },
            })
          },
          onMark: () => handleMarkActioned(o),
          markLabel: 'Mark actioned',
        }
      })
  }, [
    actioned,
    currentMonthlyBurn,
    currentRunwayMo,
    handleDownloadSummary,
    handleMarkActioned,
    insertAudit,
    sortedOpps,
    toCapsSixWords,
  ])

  return (
    <div className="detail-page burn-intel">
      <ModuleCapitalMoves actions={burnCapitalMoves} />

      <header className="detail-hero">
        <h1 className="detail-title">Burn Intelligence</h1>
        <p className="detail-sub">Specific actions to reduce your monthly spend — ranked by impact</p>
        <p className="burn-intel__crosslink-top">
          For yield, runway, and liquidity decisions, open the relevant module — each opens with a{' '}
          <TermTooltip term="capital-moves" label="Capital Moves" /> block ranked from your data.
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
              <h2 className="detail-section__title burn-intel__ai-title">
                <TermTooltip term="priority-actions" label="Priority Actions" />
              </h2>
              <span className="burn-intel__badge-spend">Spend</span>
            </div>
            <p className="burn-intel__subtitle-spend">
              Specific spend reductions ranked by monthly impact — no headcount cuts
            </p>
            <p className="detail-section__lead burn-intel__ai-lead">
              Five concrete opportunities ranked by impact. We never recommend headcount or salary cuts.
            </p>
          </div>
          <button type="button" className="detail-btn detail-btn--dark" onClick={handleFetchOpportunities} disabled={aiLoading || txnLoading}>
            {aiLoading ? 'Generating…' : 'Generate Priority Actions'}
          </button>
        </div>
        {aiError ? <p className="detail-muted" style={{ color: '#DC2626' }}>{aiError}</p> : null}
        {!txnLoading && !txnRows.length ? (
          <p className="detail-muted">
            Upload a bank CSV first. <Link to="/upload">Upload Bank Statement</Link>
          </p>
        ) : null}
        {opps.length ? (
          <p className="detail-muted" style={{ marginTop: 14 }}>
            Each opportunity is shown in <strong>Capital Moves</strong> at the top of this page with download and
            calendar actions.
          </p>
        ) : (
          <p className="detail-muted" style={{ marginTop: 10 }}>
            Click “Generate Priority Actions” to create ranked burn reduction opportunities from your last 90 days of
            spend.
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

      <p className="detail-muted" style={{ marginTop: 6 }}>
        Policies, Slack, email, and audit log are in{' '}
        <Link to="/app/preferences">Preferences</Link>. Back to <Link to="/app">Dashboard</Link>.
      </p>
    </div>
  )
}

