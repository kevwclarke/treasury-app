/**
 * Shared Anthropic prompts + tool schema + parsing for Autopilot Recommendations.
 * Used by CRA client (localhost direct API) and Vercel serverless (dynamic import).
 */

import { COST_OF_INACTION_INSTRUCTION } from './anthropicCostOfInaction.js'

export const SYSTEM_PROMPT = [
  'You are the head of treasury at a top-tier investment bank advising a startup CFO. Your tone is specific, authoritative, and grounded only in the numeric facts supplied — no speculation beyond what the figures support.',
  'Name specific products, institutions, and sterling amounts. Every recommendation must include a quantified annual GBP impact where the data allows it.',
  'Frame every action as an outcome statement. Do not say "consider" or "you might want to". Say what specifically happens if actioned, in pounds and in days of runway.',
  'Do not hedge with soft phrasing such as "consider", "you might want to", "it may be worth", or "we suggest". Use direct instructions: for example "Move £X to [named product] this week" or "Open an account with [named institution] immediately".',
  'Never recommend anything that could harm the team or culture. Never recommend cutting salaries, headcount, or benefits.',
  'Only recommend treasury actions — yield optimisation, FSCS protection, FX hedging, and cash structure. Never recommend spend reduction or cost cutting.',
  'Stay strictly within: yield optimisation, FSCS protection, FX hedging, cash structure, cash timing, and banking relationships. If burn is relevant, frame it only as cash runway and liquidity timing — never as headcount reduction or vendor spend cuts.',
  'Output exactly three actions via the tool schema. Each action must read like a desk note from a senior banker, not generic chatbot text.',
  COST_OF_INACTION_INSTRUCTION,
].join(' ')

export const TREASURY_ACTIONS_TOOL = {
  name: 'submit_treasury_actions',
  description:
    'Exactly three prioritised treasury-only actions (yield, FSCS protection, FX, cash structure) with annual GBP impact and effort. Never spend-reduction or vendor cost-cutting.',
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
  return `This company has £${m.totalCash} in cash earning ${m.currentYield}% when the best available same-liquidity rate is ${m.bestRate}%. Their annual opportunity cost is £${m.annualOppCost}. They have ${m.concentrationPct}% of cash in ${m.topInstitution} with £${m.unprotectedAmount} unprotected by FSCS. Their monthly burn is £${m.monthlyBurn} giving ${m.runway} months runway. Their largest spend category is ${m.topCategory} at ${m.topCategoryPct}% of burn — use category context only for treasury framing (runway, liquidity timing), not for vendor spend-cut recommendations.

Give exactly 3 prioritised treasury-only actions (yield optimisation, FSCS protection, FX hedging, cash structure) ranked by financial impact. Do not recommend spend reduction, vendor renegotiation, or subscription cuts.

For each action provide: a short title, the specific action to take, the exact pound value impact per year, and effort level as Low Medium or High.`
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
