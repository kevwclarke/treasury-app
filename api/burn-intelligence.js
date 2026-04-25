/**
 * Vercel serverless: POST { mode, payload } → Anthropic → opportunities / brief HTML.
 * Env: ANTHROPIC_API_KEY (server-side).
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error' })

  const mode = req.body?.mode
  const payload = req.body?.payload
  if (mode !== 'opportunities' && mode !== 'brief') {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk').default
    const client = new Anthropic({ apiKey })

    if (mode === 'opportunities') {
      const spend = payload?.spendByCategoryGbp
      if (!Array.isArray(spend) || spend.length === 0) {
        return res.status(400).json({ error: 'Missing spendByCategoryGbp' })
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

      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2400,
        system,
        messages: [{ role: 'user', content: user }],
      })

      const text = (message?.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        return res.status(502).json({ error: 'AI returned invalid JSON' })
      }
      const opportunities = parsed?.opportunities
      if (!Array.isArray(opportunities) || opportunities.length !== 5) {
        return res.status(502).json({ error: 'Unexpected AI response shape' })
      }
      return res.status(200).json({ opportunities })
    }

    // brief
    const opp = payload?.opportunity
    if (!opp || typeof opp !== 'object') {
      return res.status(400).json({ error: 'Missing opportunity' })
    }

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

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2200,
      system: briefSystem,
      messages: [{ role: 'user', content: briefUser }],
    })

    const html = (message?.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<!doctype')) {
      // ensure it's at least HTML-ish; still return raw for the client to download.
      return res.status(200).json({ html: `<!doctype html><html><head><meta charset=\"utf-8\" /></head><body>${html}</body></html>` })
    }
    return res.status(200).json({ html })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[burn-intelligence]', err)
    return res.status(502).json({ error: 'AI request failed' })
  }
}

module.exports.default = module.exports

