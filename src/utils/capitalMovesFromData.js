import { formatGBP, formatPct } from './treasuryFormat'
import { YIELD_BEST_PCT, YIELD_CURRENT_PCT } from './treasuryYield'
import { LIQUIDITY_TARGET_MONTHS } from './treasuryLiquidity'
import { FUNDRAISE_RUNWAY_ALERT_MONTHS } from './treasuryRunway'

/** @typedef {import('../components/ModuleCapitalMoves').CapitalMoveAction} CapitalMoveAction */

function annualFromMonthlyImpact(monthly) {
  return Math.max(0, monthly) * 12
}

/**
 * @param {{
 *   totalCash: number,
 *   annualOppCost: number,
 *   monthlyOppCost: number,
 *   currentYieldPct?: number,
 *   bestYieldPct?: number,
 *   topProduct?: { name: string, ratePct: number } | null,
 *   onApplyTop?: () => void,
 * }} ctx
 * @returns {CapitalMoveAction[]}
 */
export function buildYieldCapitalMoves(ctx) {
  const cash = Math.max(0, Number(ctx.totalCash) || 0)
  const annual = Math.max(0, Number(ctx.annualOppCost) || 0)
  const monthly = Math.max(0, Number(ctx.monthlyOppCost) || 0)
  const best = ctx.bestYieldPct ?? YIELD_BEST_PCT
  const cur = ctx.currentYieldPct ?? YIELD_CURRENT_PCT
  const actions = []

  if (cash <= 0) return actions

  if (annual >= 2500) {
    const top = ctx.topProduct
    actions.push({
      id: 'yield-sweep-top-rate',
      titleCaps: 'SWEEP TO TOP RATE',
      description: `Allocate idle balances into ${top ? `${top.name} at ${formatPct(top.ratePct, 2)}` : `a top-rated sleeve at ${formatPct(best, 2)}`} while keeping your liquidity buffer intact.`,
      who: 'CFO',
      time: 'Within 30 days',
      impactGbpYear: annual,
      costWaiting30: monthly,
      primaryLabel: top ? `Apply — ${top.name}` : 'Review yield options',
      onPrimary: top && ctx.onApplyTop ? ctx.onApplyTop : undefined,
      primaryHref: top && ctx.onApplyTop ? undefined : '/app/yield',
    })
  }

  if (annual >= 8000 && best > cur + 0.25) {
    actions.push({
      id: 'yield-close-blended-gap',
      titleCaps: 'CLOSE BLENDED GAP',
      description: `Lift blended yield from ${formatPct(cur, 2)} toward ${formatPct(best, 2)} on ${formatGBP(Math.round(cash))} — staged transfers reduce forgone interest.`,
      who: 'Finance Team',
      time: 'This week',
      impactGbpYear: Math.min(annual, monthly * 12 * 0.35),
      costWaiting30: monthly * 0.9,
      primaryLabel: 'Open marketplace',
      primaryHref: '/app/opportunities',
    })
  }

  return actions.slice(0, 3)
}

/** @param {{ concentration: ReturnType<typeof import('./treasuryConcentration').computeConcentrationFromTransactions> }} ctx */
export function buildConcentrationCapitalMoves(ctx) {
  const c = ctx.concentration
  const actions = []
  const maxPct = Number(c.maxPct) || 0
  const unprot = Math.max(0, Number(c.unprotectedTotal) || 0)
  const total = Math.max(0, Number(c.totalCash) || 0)
  if (total <= 0) return actions

  if (maxPct > 50 || unprot > 50_000) {
    const topRow = (c.institutionRows || []).slice().sort((a, b) => b.balance - a.balance)[0]
    const name = topRow?.name || 'your lead bank'
    actions.push({
      id: 'conc-diversify',
      titleCaps: 'SPLIT DEPOSITS ACROSS BANKS',
      description: `Move excess above FSCS limits out of ${name} (${formatPct(maxPct, 1)} of cash) into a second authorised institution.`,
      who: 'CFO',
      time: 'Within 30 days',
      impactGbpYear: unprot * 0.02,
      costWaiting30: unprot * 0.002,
      primaryLabel: 'Review institutions',
      primaryHref: '/app/concentration',
    })
  }

  if (unprot > 10_000 && actions.length < 2) {
    actions.push({
      id: 'conc-fscs-buffer',
      titleCaps: 'CAP FSCS EXPOSURE',
      description: `Ring-fence ${formatGBP(Math.round(unprot))} that sits above £85k FSCS protection per bank until diversified.`,
      who: 'Finance Team',
      time: 'This week',
      impactGbpYear: unprot * 0.015,
      costWaiting30: unprot * 0.0015,
      primaryLabel: 'View FSCS breakdown',
      primaryHref: '/app/concentration',
    })
  }

  return actions.slice(0, 2)
}

/** @param {{ runwayCore: ReturnType<typeof import('./treasuryRunway').computeRunwayFromTransactions>, burnMomDeltaPct: number | null }} ctx */
export function buildRunwayBurnCapitalMoves(ctx) {
  const r = ctx.runwayCore
  const actions = []
  const base = r.baseRunwayMo
  const burn = Math.max(0, Number(r.monthlyBurn) || 0)
  const cash = Math.max(0, Number(r.totalCash) || 0)
  if (cash <= 0 || burn <= 0 || base == null || !Number.isFinite(base)) return actions

  if (base < FUNDRAISE_RUNWAY_ALERT_MONTHS) {
    const shortfallMo = FUNDRAISE_RUNWAY_ALERT_MONTHS - base
    actions.push({
      id: 'rb-extend-runway',
      titleCaps: 'EXTEND RUNWAY NOW',
      description: `At ${base.toFixed(1)} months runway you are inside the ${FUNDRAISE_RUNWAY_ALERT_MONTHS}-month raise buffer — model burn cuts or inflows before cash forces decisions.`,
      who: 'CFO',
      time: 'This week',
      impactGbpYear: burn * 12 * 0.15,
      costWaiting30: burn * shortfallMo * 0.05,
      primaryLabel: 'Open scenarios',
      primaryHref: '/app/scenarios',
    })
  }

  const d = ctx.burnMomDeltaPct
  if (d != null && Number.isFinite(d) && d > 8) {
    actions.push({
      id: 'rb-burn-trajectory',
      titleCaps: 'SLOW BURN TRAJECTORY',
      description: `Monthly outflows are ${d.toFixed(1)}% above your 90-day trend — freeze discretionary spend until trajectory stabilises.`,
      who: 'Finance Team',
      time: 'Ongoing',
      impactGbpYear: annualFromMonthlyImpact(burn * (d / 100)),
      costWaiting30: burn * (d / 100),
      primaryLabel: 'Review burn intelligence',
      primaryHref: '/app/burn-intelligence',
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: 'rb-monitor',
      titleCaps: 'MONITOR RUNWAY MONTHLY',
      description: `Maintain discipline on ${formatGBP(Math.round(burn))}/mo burn with ${base.toFixed(1)} months runway.`,
      who: 'CFO',
      time: 'Ongoing',
      impactGbpYear: 0,
      costWaiting30: 0,
      primaryLabel: 'View runway detail',
      primaryHref: '/app/runway',
    })
  }

  return actions.slice(0, 2)
}

/** @param {{ liq: ReturnType<typeof import('./treasuryLiquidity').computeLiquidityBuffer> }} ctx */
export function buildLiquidityCapitalMoves(ctx) {
  const liq = ctx.liq
  const actions = []
  if (liq.monthlyBurn <= 0 || liq.bufferMonths == null) return actions
  if (liq.bufferMonths == null || liq.bufferMonths >= LIQUIDITY_TARGET_MONTHS) return actions

  const gap = Math.max(0, liq.targetCash6mo - liq.totalCash)
  actions.push({
    id: 'liq-restore-buffer',
    titleCaps: 'RESTORE LIQUIDITY BUFFER',
    description: `Raise instantly-accessible cash toward ${LIQUIDITY_TARGET_MONTHS} months of cover (${formatGBP(Math.round(liq.targetCash6mo))} target vs ${formatGBP(Math.round(liq.totalCash))} now).`,
    who: 'CFO',
    time: 'This week',
    impactGbpYear: liq.monthlyBurn * 0.5,
    costWaiting30: gap > 0 ? Math.min(liq.monthlyBurn, gap * 0.08) : liq.monthlyBurn * 0.05,
    primaryLabel: 'View buffer detail',
    primaryHref: '/app/liquidity',
  })

  return actions
}

/** @param {{ summary: ReturnType<typeof import('./treasuryCashflow').computeCashflowSummary>, lowCash: boolean }} ctx */
export function buildCashflowCapitalMoves(ctx) {
  const s = ctx.summary
  const actions = []
  const out = Math.max(0, s.avgMonthlyOut)
  const inn = Math.max(0, s.avgMonthlyIn)
  const net = s.netMonthly

  if (ctx.lowCash && out > 0) {
    actions.push({
      id: 'cf-low-cash',
      titleCaps: 'FIX LOW CASH WEEK',
      description: `Projected balance drops below one month of average outflow (${formatGBP(Math.round(out))}) within your forecast window — pull forward receipts or trim disbursements.`,
      who: 'Finance Team',
      time: 'This week',
      impactGbpYear: out * 2,
      costWaiting30: out * 0.25,
      primaryLabel: 'Review cash flow',
      primaryHref: '/app/cashflow',
    })
  }

  if (net < 0 && out > 0) {
    actions.push({
      id: 'cf-negative-net',
      titleCaps: 'CLOSE MONTHLY CASH GAP',
      description: `Average net monthly position is ${formatGBP(Math.round(net))} (in ${formatGBP(Math.round(inn))} vs out ${formatGBP(Math.round(out))}).`,
      who: 'CFO',
      time: 'Within 30 days',
      impactGbpYear: annualFromMonthlyImpact(-net),
      costWaiting30: Math.max(0, -net),
      primaryLabel: 'Stress-test scenarios',
      primaryHref: '/app/scenarios',
    })
  }

  return actions.slice(0, 2)
}

/**
 * @param {{ pairs: Array<{ code: string, gbp: number, pair: string, monthlyFc: number }> }} ctx
 */
export function buildFxCapitalMoves(ctx) {
  const pairs = Array.isArray(ctx.pairs) ? ctx.pairs : []
  const actions = []
  if (!pairs.length) return actions

  const totalGbp = pairs.reduce((s, p) => s + (Number(p.gbp) || 0), 0)
  const var5 = totalGbp * 0.05

  if (totalGbp > 20_000) {
    actions.push({
      id: 'fx-hedge-recurring',
      titleCaps: 'HEDGE RECURRING FX',
      description: `You have ~${formatGBP(Math.round(totalGbp))}/mo equivalent in non-GBP spend — lock or warehouse FX ahead of payroll and vendor runs.`,
      who: 'CFO / External Provider',
      time: 'Within 30 days',
      impactGbpYear: var5 * 12,
      costWaiting30: var5,
      primaryLabel: 'Review FX exposure',
      primaryHref: '/app/fx',
    })
  }

  if (pairs.length > 1 && actions.length < 2) {
    actions.push({
      id: 'fx-natural-hedge',
      titleCaps: 'MATCH CURRENCY FLOWS',
      description: `Align ${pairs.map((p) => p.code).join(' & ')} receipts with same-currency costs to shrink unhedged notional.`,
      who: 'Finance Team',
      time: 'Ongoing',
      impactGbpYear: var5 * 6,
      costWaiting30: var5 * 0.4,
      primaryLabel: 'Open FX module',
      primaryHref: '/app/fx',
    })
  }

  return actions.slice(0, 2)
}

export function summaryStatusYield(annualOpp) {
  if (annualOpp >= 80_000) return { label: 'Action Required', tone: 'red' }
  if (annualOpp >= 15_000) return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}

export function summaryStatusConcentration(maxPct, unprotected) {
  if (maxPct > 75 || unprotected > 500_000) return { label: 'Action Required', tone: 'red' }
  if (maxPct > 50 || unprotected > 85_000) return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}

export function summaryStatusRunway(baseMo) {
  if (baseMo == null || !Number.isFinite(baseMo)) return { label: 'Watch', tone: 'amber' }
  if (baseMo < FUNDRAISE_RUNWAY_ALERT_MONTHS) return { label: 'Action Required', tone: 'red' }
  if (baseMo < 15) return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}

export function summaryStatusBurn(deltaPct) {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return { label: 'Healthy', tone: 'green' }
  if (deltaPct > 12) return { label: 'Action Required', tone: 'red' }
  if (deltaPct > 5) return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}

export function summaryStatusCashflow(netMonthly, lowCash) {
  if (lowCash) return { label: 'Action Required', tone: 'red' }
  if (netMonthly < 0) return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}

export function summaryStatusLiquidity(band) {
  if (band === 'red') return { label: 'Action Required', tone: 'red' }
  if (band === 'amber') return { label: 'Watch', tone: 'amber' }
  return { label: 'Healthy', tone: 'green' }
}
