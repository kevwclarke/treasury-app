import {
  BURN_BRIEF_SYSTEM_PROMPT,
  BURN_INTELLIGENCE_SYSTEM_PROMPT,
  BURN_OPPORTUNITIES_TOOL,
  parseBurnOpportunitiesToolUse,
} from '../lib/burnIntelligenceShared.js'

/**
 * System prompts for localhost Anthropic must match production serverless routes.
 * Opportunities + brief include the 30-day cost-of-inaction rule (verbatim):
 *
 * For each action you recommend, add one sentence at the end stating the cost of inaction — specifically:
 * 'If this is not actioned in the next 30 days, the cost is £X' — where X is the pound value lost or foregone in that
 * 30-day period based on the numbers provided. Make this specific and calculated, not generic.
 *
 * Source of truth: `../lib/burnIntelligenceShared.js` (imports `../lib/anthropicCostOfInaction.js`).
 */

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
        system: BURN_INTELLIGENCE_SYSTEM_PROMPT,
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
    const toolOpps = parseBurnOpportunitiesToolUse(message)
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

    const briefSystem = BURN_BRIEF_SYSTEM_PROMPT
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

