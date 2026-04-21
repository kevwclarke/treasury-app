/**
 * Vercel serverless: GET = health; POST JSON body = financial metrics → Anthropic → { actions: [...] }
 * Env: ANTHROPIC_API_KEY (server-side in Vercel → Settings → Environment Variables)
 *
 * Must live at repo root: api/treasury-actions.js → URL /api/treasury-actions
 */
const {
  SYSTEM_PROMPT,
  TREASURY_ACTIONS_TOOL,
  buildTreasuryActionsUserPrompt,
  parseToolUse,
  validateMetricsBody,
} = require('../lib/treasuryAnthropicServer.cjs')

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Treasury actions API is alive',
      endpoint: '/api/treasury-actions',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const metrics = validateMetricsBody(req.body)
  if (!metrics) {
    return res.status(400).json({ error: 'Missing or invalid financial metrics' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const userPrompt = buildTreasuryActionsUserPrompt(metrics)

  try {
    const Anthropic = require('@anthropic-ai/sdk').default
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [TREASURY_ACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_treasury_actions' },
    })

    const actions = parseToolUse(message)
    if (!actions) {
      return res.status(502).json({ error: 'Unexpected AI response' })
    }

    return res.status(200).json({ actions })
  } catch (err) {
    console.error('[treasury-actions]', err)
    return res.status(502).json({ error: 'AI request failed' })
  }
}

module.exports = handler
module.exports.default = handler
