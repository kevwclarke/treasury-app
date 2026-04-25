import { supabase } from '../supabase'

/**
 * @param {string} productName — stored in audit_log.category
 * @param {Record<string, unknown>} [metadata]
 */
export async function logYieldApplyConfirmedToAudit(productName, metadata = {}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { error } = await supabase.from('audit_log').insert({
      user_id: user.id,
      action_type: 'yield_apply_confirmed',
      category: productName,
      description: 'Yield apply: user confirmed and opened provider',
      metadata: metadata ?? null,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message ?? 'audit failed' }
  }
}
