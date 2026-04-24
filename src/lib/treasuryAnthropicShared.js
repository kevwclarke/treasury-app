/**
 * Shared Anthropic prompts + tool schema + parsing for AI Treasury Actions.
 * Used by CRA client (localhost direct API) and Vercel serverless (dynamic import).
 */

export const SYSTEM_PROMPT = [
  'You are a senior treasury advisor to startup CFOs. You give specific, actionable advice based on real financial data. Always quantify the impact in pounds. Never give generic advice. Be direct and specific.',
  'Never recommend cutting salaries, reducing headcount, or any action that could harm staff retention — startups live and die by their team.',
  'Never recommend actions requiring board approval unless you explicitly flag that board approval is needed.',
  'Focus exclusively on treasury decisions: yield optimisation, FSCS protection, FX hedging, cash timing, and banking relationships.',
  'If burn is a concern, frame it as a hiring pace observation, not a cost-cutting instruction.',
  'Always recommend actions the CFO can execute themselves within a week.',
].join(' ')

export const TREASURY_ACTIONS_TOOL = {
  name: 'submit_treasury_actions',
  description: 'Exactly three prioritised treasury actions with annual GBP impact and effort.',
  input_schema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            action: { type: 'string' },
            impact_gbp_per_year: { type: 'number' },
            effort: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          },
          required: ['title', 'action', 'impact_gbp_per_year', 'effort'],
        },
      },
    },
    required: ['actions'],
  },
}

export const METRIC_KEYS = [
  'totalCash',
  'currentYield',
  'bestRate',
  'annualOppCost',
  'concentrationPct',
  'topInstitution',
  'unprotectedAmount',
  'monthlyBurn',
  'runway',
  'topCategory',
  'topCategoryPct',
]

export function buildTreasuryActionsUserPrompt(m) {
  return `This company has £${m.totalCash} in cash earning ${m.currentYield}% when the best available same-liquidity rate is ${m.bestRate}%. Their annual opportunity cost is £${m.annualOppCost}. They have ${m.concentrationPct}% of cash in ${m.topInstitution} with £${m.unprotectedAmount} unprotected by FSCS. Their monthly burn is £${m.monthlyBurn} giving ${m.runway} months runway. Their largest spend category is ${m.topCategory} at ${m.topCategoryPct}% of burn. Give exactly 3 prioritised actions ranked by financial impact. For each action provide: a short title, the specific action to take, the exact pound value impact per year, and effort level as Low Medium or High.`
}

function normaliseEffort(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'low') return 'Low'
  if (s === 'high') return 'High'
  return 'Medium'
}

export function parseToolUse(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return null
  for (const b of blocks) {
    if (b?.type === 'tool_use' && b.name === 'submit_treasury_actions' && b.input?.actions) {
      const actions = b.input.actions.map((a, i) => ({
        rank: i + 1,
        title: String(a.title ?? '').trim(),
        action: String(a.action ?? '').trim(),
        impactGbpPerYear: Number(a.impact_gbp_per_year),
        effort: normaliseEffort(a.effort),
      }))
      if (actions.every((x) => x.title && x.action && Number.isFinite(x.impactGbpPerYear))) {
        return actions
      }
    }
  }
  return null
}

export function validateMetricsBody(body) {
  if (!body || typeof body !== 'object') return null
  const m = {}
  for (const k of METRIC_KEYS) {
    if (body[k] === undefined || body[k] === null) return null
    if (k === 'topCategoryPct') {
      const n = Number(body[k])
      if (!Number.isFinite(n)) return null
      m[k] = n
    } else {
      const s = String(body[k])
      if (s.length > 500) return null
      m[k] = s
    }
  }
  return m
}
