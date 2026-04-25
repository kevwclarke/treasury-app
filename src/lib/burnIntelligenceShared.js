/**
 * Shared Anthropic prompt + tool schema + parsing for Burn Intelligence opportunities.
 * Used by localhost browser (direct Anthropic) and Vercel serverless.
 */

export const BURN_INTELLIGENCE_SYSTEM_PROMPT =
  `You are a management consultant specialising in startup cost efficiency advising a startup CFO. ` +
  `You have been given this company's spend by category for the last 90 days. ` +
  `Identify exactly 5 specific actionable opportunities to reduce monthly burn without cutting headcount, reducing salaries, or harming culture. ` +
  `For each opportunity provide: a short title max 8 words, the specific category, the current monthly spend in that category, ` +
  `a concrete recommended action with specific implementation steps, an estimated monthly saving in pounds as a range, ` +
  `effort level as Low Medium or High, and the runway extension in days if actioned. ` +
  `Be specific — reference actual spend figures, name specific tools or vendors where identifiable, give concrete steps a CFO can take this week. ` +
  `Frame every recommendation as an outcome statement — what specifically happens if the CFO takes this action this week in pounds and days of runway. ` +
  `Never recommend headcount cuts or salary reductions.`

export const BURN_OPPORTUNITIES_TOOL = {
  name: 'submit_burn_opportunities',
  description: 'Exactly five burn reduction opportunities with savings ranges.',
  input_schema: {
    type: 'object',
    properties: {
      opportunities: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: { type: 'string' },
            currentMonthlySpend: { type: 'number' },
            recommendedAction: { type: 'string' },
            estimatedMonthlySaving: {
              type: 'object',
              properties: {
                low: { type: 'number' },
                high: { type: 'number' },
              },
              required: ['low', 'high'],
            },
            effort: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            runwayExtensionDays: { type: 'number' },
          },
          required: [
            'title',
            'category',
            'currentMonthlySpend',
            'recommendedAction',
            'estimatedMonthlySaving',
            'effort',
            'runwayExtensionDays',
          ],
        },
      },
    },
    required: ['opportunities'],
  },
}

export function buildBurnOpportunitiesUserPrompt(spendByCategoryGbp) {
  return [
    'Spend by category (GBP per month):',
    JSON.stringify(spendByCategoryGbp),
    '',
    'Return exactly 5 opportunities via the tool.',
  ].join('\n')
}

export function parseBurnOpportunitiesToolUse(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return null
  for (const b of blocks) {
    if (b?.type === 'tool_use' && b.name === 'submit_burn_opportunities' && b.input?.opportunities) {
      const opps = b.input.opportunities
      if (Array.isArray(opps) && opps.length === 5) return opps
    }
  }
  return null
}

export function validateBurnOpportunitiesBody(body) {
  const spend = body?.payload?.spendByCategoryGbp
  if (!Array.isArray(spend) || spend.length === 0) return null
  // Keep it simple: ensure each entry has category + monthlySpend number-ish.
  const cleaned = spend
    .map((r) => ({
      category: String(r?.category ?? '').trim(),
      monthlySpend: Number(r?.monthlySpend),
    }))
    .filter((r) => r.category && Number.isFinite(r.monthlySpend))
  if (!cleaned.length) return null
  return { spendByCategoryGbp: cleaned }
}

