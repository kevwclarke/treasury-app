/**
 * Production: POST to Vercel `/api/treasury-actions` (no browser → Anthropic; avoids CORS).
 * Localhost: call Anthropic from the browser using REACT_APP_ANTHROPIC_API_KEY (CRA injects at build time).
 *
 * Advisor system prompt: `SYSTEM_PROMPT` in `../lib/treasuryAnthropicShared.js` (shared with the API route).
 */

import {
  SYSTEM_PROMPT,
  TREASURY_ACTIONS_TOOL,
  buildTreasuryActionsUserPrompt,
  parseToolUse,
  validateMetricsBody,
} from '../lib/treasuryAnthropicShared'

/**
 * System prompt for localhost Anthropic calls must match production `/api/treasury-actions`.
 * It includes the 30-day cost-of-inaction rule (verbatim):
 *
 * For each action you recommend, add one sentence at the end stating the cost of inaction — specifically:
 * 'If this is not actioned in the next 30 days, the cost is £X' — where X is the pound value lost or foregone in that
 * 30-day period based on the numbers provided. Make this specific and calculated, not generic.
 *
 * Source of truth: `../lib/treasuryAnthropicShared.js` → `SYSTEM_PROMPT` (imports `../lib/anthropicCostOfInaction.js`).
 */

function isLocalDevHostname() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

function treasuryActionsUrl() {
  const base = process.env.REACT_APP_TREASURY_ACTIONS_API_BASE?.replace(/\/$/, '') ?? ''
  return `${base}/api/treasury-actions`
}

async function fetchTreasuryActionsViaServer({ metrics, signal }) {
  const res = await fetch(treasuryActionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(metrics),
    signal,
  })

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Invalid response from treasury actions API')
  }

  if (!res.ok) {
    throw new Error(data?.error || `Treasury actions request failed (${res.status})`)
  }

  if (!Array.isArray(data?.actions)) {
    throw new Error('Unexpected response shape from treasury actions API')
  }

  return data.actions
}

async function fetchTreasuryActionsViaAnthropicBrowser({ metrics, signal }) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Missing REACT_APP_ANTHROPIC_API_KEY. Add it to .env.local for local Autopilot Recommendations.',
    )
  }

  const validated = validateMetricsBody(metrics)
  if (!validated) {
    throw new Error('Missing or invalid financial metrics')
  }

  const userPrompt = buildTreasuryActionsUserPrompt(validated)

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const message = await client.messages.create(
    {
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [TREASURY_ACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_treasury_actions' },
    },
    signal ? { signal } : undefined,
  )

  const actions = parseToolUse(message)
  if (!actions) {
    throw new Error('Unexpected AI response')
  }

  return actions
}

/**
 * @param {{ metrics: Record<string, string | number>, signal?: AbortSignal }} opts
 * @returns {Promise<Array<{ rank: number, title: string, action: string, impactGbpPerYear: number, effort: string }>>}
 */
export async function fetchTreasuryAnthropicActions({ metrics, signal }) {
  if (isLocalDevHostname()) {
    return fetchTreasuryActionsViaAnthropicBrowser({ metrics, signal })
  }
  return fetchTreasuryActionsViaServer({ metrics, signal })
}
