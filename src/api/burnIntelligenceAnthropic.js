function isLocalDevHostname() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

function burnIntelligenceUrl() {
  const base = process.env.REACT_APP_TREASURY_ACTIONS_API_BASE?.replace(/\/$/, '') ?? ''
  return `${base}/api/burn-intelligence-actions`
}

function burnIntelligenceBriefUrl() {
  const base = process.env.REACT_APP_TREASURY_ACTIONS_API_BASE?.replace(/\/$/, '') ?? ''
  return `${base}/api/burn-intelligence`
}

function concatTextBlocks(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return ''
  return blocks.map((b) => (b?.type === 'text' ? b.text : '')).join('').trim()
}

const BURN_OPPORTUNITIES_TOOL = {
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

function parseToolUseOpportunities(message) {
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

function extractJsonObject(text) {
  const t = String(text || '').trim()
  if (!t) return null
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return t.slice(start, end + 1)
}

async function fetchBurnIntelligenceViaServer({ mode, payload, signal }) {
  const url = mode === 'brief' ? burnIntelligenceBriefUrl() : burnIntelligenceUrl()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ mode, payload }),
    signal,
  })

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Invalid response from burn intelligence API')
  }

  if (!res.ok) {
    throw new Error(data?.error || `Burn intelligence request failed (${res.status})`)
  }

  return data
}

async function fetchBurnIntelligenceViaAnthropicBrowser({ mode, payload, signal }) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Missing REACT_APP_ANTHROPIC_API_KEY. Add it to .env.local for local Burn Intelligence AI.',
    )
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  if (mode === 'opportunities') {
    const spend = payload?.spendByCategoryGbp
    if (!Array.isArray(spend) || spend.length === 0) {
      throw new Error('Missing spendByCategoryGbp')
    }

    const system = `You are a management consultant specialising in startup cost efficiency advising a startup CFO. You have been given this company's spend by category for the last 90 days. Identify exactly 5 specific actionable opportunities to reduce monthly burn without cutting headcount, reducing salaries, or harming culture. For each opportunity provide: a short title max 8 words, the specific category, the current monthly spend in that category, a concrete recommended action with specific implementation steps, an estimated monthly saving in pounds as a range, effort level as Low Medium or High, and the runway extension in days if actioned. Be specific — reference actual spend figures, name specific tools or vendors where identifiable, give concrete steps a CFO can take this week. Frame every recommendation as an outcome statement — what specifically happens if the CFO takes this action this week in pounds and days of runway. Never recommend headcount cuts or salary reductions.`

    const user = [
      'Return ONLY valid JSON (no markdown, no backticks).',
      'Output shape:',
      '{ "opportunities": [',
      '  {',
      '    "title": "max 8 words",',
      '    "category": "one of the provided categories",',
      '    "currentMonthlySpend": 12345,',
      '    "recommendedAction": "2-3 sentences, outcome framed, with concrete steps",',
      '    "estimatedMonthlySaving": { "low": 1200, "high": 1800 },',
      '    "effort": "Low|Medium|High",',
      '    "runwayExtensionDays": 12',
      '  }',
      '] }',
      '',
      'Spend by category (GBP per month):',
      JSON.stringify(spend),
    ].join('\n')

    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 2400,
        system,
        messages: [{ role: 'user', content: user }],
        tools: [BURN_OPPORTUNITIES_TOOL],
        tool_choice: { type: 'tool', name: 'submit_burn_opportunities' },
      },
      signal ? { signal } : undefined,
    )

    // Debug: log the full raw message so we can see what Anthropic returned.
    // eslint-disable-next-line no-console
    console.log('[burn-intelligence] raw Anthropic message', message)

    // Prefer tool_use, but fall back to JSON-in-text parsing if necessary.
    const toolOpps = parseToolUseOpportunities(message)
    if (toolOpps) return { opportunities: toolOpps }

    const text = concatTextBlocks(message)
    const jsonCandidate = extractJsonObject(text) || text
    let parsed
    try {
      parsed = JSON.parse(jsonCandidate)
    } catch {
      throw new Error('Invalid JSON from Anthropic')
    }
    const opps = parsed?.opportunities
    if (!Array.isArray(opps) || opps.length !== 5) throw new Error('Unexpected AI response')
    return { opportunities: opps }
  }

  if (mode === 'brief') {
    const opp = payload?.opportunity
    if (!opp || typeof opp !== 'object') throw new Error('Missing opportunity')

    const briefSystem =
      'You are a startup CFO advisor and vendor negotiation specialist. Produce a one-page vendor negotiation brief as clean, print-ready HTML (no markdown). Use Inter font, white background, navy headings (#1E3A5F), and a professional layout with generous whitespace.'
    const briefUser = [
      'Return ONLY HTML. No markdown.',
      '',
      'Generate a structured one-page vendor negotiation brief with these sections, in this order:',
      '1) Executive Summary',
      '2) Current Spend Analysis',
      '3) Market Benchmark',
      '4) Our Ask',
      '5) Talking Points',
      '6) Expected Outcome',
      '',
      'Context (JSON):',
      JSON.stringify(opp),
    ].join('\n')

    const message = await client.messages.create(
      {
        model: 'claude-sonnet-4-5',
        max_tokens: 2200,
        system: briefSystem,
        messages: [{ role: 'user', content: briefUser }],
      },
      signal ? { signal } : undefined,
    )

    const html = concatTextBlocks(message)
    if (!html) throw new Error('Empty brief from Anthropic')
    return { html }
  }

  throw new Error('Invalid mode')
}

/**
 * Mirrors src/api/treasuryAnthropicActions.js:
 * - localhost => call Anthropic SDK directly (REACT_APP_ANTHROPIC_API_KEY)
 * - production => call serverless /api/burn-intelligence
 */
export async function fetchBurnIntelligenceAi({ mode, payload, signal }) {
  if (isLocalDevHostname()) {
    return fetchBurnIntelligenceViaAnthropicBrowser({ mode, payload, signal })
  }
  return fetchBurnIntelligenceViaServer({ mode, payload, signal })
}

