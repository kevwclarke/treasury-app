/** Anthropic Messages API for AI Treasury Actions. Model id is the Claude API alias (not deprecated). */

const SYSTEM_PROMPT = [
  'You are a senior treasury advisor to startup CFOs. You give specific, actionable advice based on real financial data. Always quantify the impact in pounds. Never give generic advice. Be direct and specific.',
  'Never recommend cutting salaries, reducing headcount, or any action that could harm staff retention — startups live and die by their team.',
  'Never recommend actions requiring board approval unless you explicitly flag that board approval is needed.',
  'Focus exclusively on treasury decisions: yield optimisation, FSCS protection, FX hedging, cash timing, and banking relationships.',
  'If burn is a concern, frame it as a hiring pace observation, not a cost-cutting instruction.',
  'Always recommend actions the CFO can execute themselves within a week.',
].join(' ')

const TREASURY_ACTIONS_TOOL = {
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

function normaliseEffort(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'low') return 'Low'
  if (s === 'high') return 'High'
  return 'Medium'
}

function parseToolUse(message) {
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

/**
 * Dynamic import keeps @anthropic-ai/sdk out of the initial bundle.
 * @param {{ userPrompt: string, signal?: AbortSignal }} opts
 */
export async function fetchTreasuryAnthropicActions({ userPrompt, signal }) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing REACT_APP_ANTHROPIC_API_KEY')
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const message = await client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [TREASURY_ACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_treasury_actions' },
    },
    { signal },
  )

  const parsed = parseToolUse(message)
  if (!parsed) throw new Error('Unexpected response from Claude')
  return parsed
}
