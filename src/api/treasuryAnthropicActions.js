/**
 * Calls the Vercel serverless route `/api/treasury-actions` (no browser → Anthropic; avoids CORS in production).
 * For local CRA without `vercel dev`, this path 404s unless proxied.
 */

function treasuryActionsUrl() {
  const base = process.env.REACT_APP_TREASURY_ACTIONS_API_BASE?.replace(/\/$/, '') ?? ''
  return `${base}/api/treasury-actions`
}

/**
 * @param {{ metrics: Record<string, string | number>, signal?: AbortSignal }} opts
 * @returns {Promise<Array<{ rank: number, title: string, action: string, impactGbpPerYear: number, effort: string }>>}
 */
export async function fetchTreasuryAnthropicActions({ metrics, signal }) {
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
