/**
 * Vercel serverless: GET = health; POST JSON body = { mode:'opportunities', payload:{spendByCategoryGbp:[...] } }
 * → Anthropic tool_use → { opportunities: [...] }
 *
 * Mirrors api/treasury-actions.js structure.
 * Env: ANTHROPIC_API_KEY (server-side in Vercel).
 */
const { pathToFileURL } = require('url')
const path = require('path')

let sharedPromise

async function loadShared() {
  if (!sharedPromise) {
    const abs = path.join(__dirname, '..', 'src', 'lib', 'burnIntelligenceShared.js')
    sharedPromise = import(pathToFileURL(abs).href)
  }
  return sharedPromise
}

module.exports = async function handler(req, res) {
  const {
    BURN_INTELLIGENCE_SYSTEM_PROMPT,
    BURN_OPPORTUNITIES_TOOL,
    buildBurnOpportunitiesUserPrompt,
    parseBurnOpportunitiesToolUse,
    validateBurnOpportunitiesBody,
  } = await loadShared()

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Burn intelligence actions API is alive',
      endpoint: '/api/burn-intelligence-actions',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // This endpoint is only for the "Generate 5 Actions" flow.
  const validated = validateBurnOpportunitiesBody(req.body)
  if (!validated) {
    return res.status(400).json({ error: 'Missing or invalid spendByCategoryGbp' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const userPrompt = buildBurnOpportunitiesUserPrompt(validated.spendByCategoryGbp)

  try {
    const Anthropic = require('@anthropic-ai/sdk').default
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2400,
      system: BURN_INTELLIGENCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [BURN_OPPORTUNITIES_TOOL],
      tool_choice: { type: 'tool', name: 'submit_burn_opportunities' },
    })

    const opportunities = parseBurnOpportunitiesToolUse(message)
    if (!opportunities) {
      return res.status(502).json({ error: 'Unexpected AI response' })
    }

    return res.status(200).json({ opportunities })
  } catch (err) {
    console.error('[burn-intelligence-actions]', err)
    return res.status(502).json({ error: 'AI request failed' })
  }
}

module.exports.default = module.exports

