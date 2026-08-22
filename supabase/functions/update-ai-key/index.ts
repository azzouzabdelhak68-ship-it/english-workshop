import { preflight, json } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Staff-only key rotation for the Gemini key. Stored in Supabase Vault so staff
// can rotate/remove it at runtime without a deploy. The raw key is NEVER echoed
// back in any response — only { ok, configured, last4 }.

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

Deno.serve(async (req) => {
  const pf = preflight(req)
  if (pf) return pf
  if (req.method !== 'POST') return json({ ok: false, message: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  if (userErr || !userData.user) return json({ ok: false }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
  if (!prof || !['host', 'organizer', 'admin'].includes(prof.role)) return json({ ok: false }, 403)

  let body: { action?: string; key?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false }, 400)
  }

  if (body.action === 'remove') {
    const { data: current } = await admin.from('ai_settings').select('gemini_key_secret_id').eq('id', true).single()
    if (current?.gemini_key_secret_id) {
      await admin.schema('vault').from('secrets').delete().eq('id', current.gemini_key_secret_id)
    }
    await admin.from('ai_settings').update({
      gemini_key_secret_id: null,
      configured: false,
      last4: null,
      updated_by: userData.user.id,
      updated_at: new Date().toISOString()
    }).eq('id', true)
    console.log(JSON.stringify({ event: 'ai_key_removed', by: userData.user.id }))
    return json({ ok: true, configured: false })
  }

  if (body.action === 'set') {
    const key = (body.key ?? '').trim()
    if (!key || key.length < 20) return json({ ok: false, reason: 'invalid_format' })

    // Validate BEFORE committing — a broken paste must fail loudly now,
    // not silently disable the feature on the next generation.
    try {
      const test = await fetch(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(8000)
      })
      if (!test.ok) return json({ ok: false, reason: 'validation_failed' })
    } catch {
      return json({ ok: false, reason: 'validation_failed' })
    }

    const { data: existing } = await admin.from('ai_settings').select('gemini_key_secret_id').eq('id', true).single()

    const { data: secretId, error: secretErr } = await admin.rpc('vault_create_secret', {
      p_secret: key,
      p_name: 'gemini_api_key'
    })

    let newSecretId: string | null = typeof secretId === 'string' ? secretId : null
    if (secretErr || !newSecretId) {
      const inserted = await admin.schema('vault').from('secrets').insert({ secret: key, name: 'gemini_api_key' }).select('id').single()
      newSecretId = inserted.data?.id ?? null
      if (!newSecretId) return json({ ok: false, reason: 'storage_failed' })
    }

    if (existing?.gemini_key_secret_id && existing.gemini_key_secret_id !== newSecretId) {
      await admin.schema('vault').from('secrets').delete().eq('id', existing.gemini_key_secret_id)
    }

    await admin.from('ai_settings').update({
      gemini_key_secret_id: newSecretId,
      configured: true,
      last4: key.slice(-4),
      updated_by: userData.user.id,
      updated_at: new Date().toISOString()
    }).eq('id', true)

    console.log(JSON.stringify({ event: 'ai_key_rotated', by: userData.user.id, configured: true }))
    return json({ ok: true, configured: true })
  }

  return json({ ok: false, reason: 'unknown_action' }, 400)
})
