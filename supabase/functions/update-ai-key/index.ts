import { preflight, json } from '../_shared/cors.ts'
import { isAllowedGeminiModel } from '../_shared/gemini-models.ts'
import { isAllowedGroqModel } from '../_shared/groq-models.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Staff-only key rotation for Gemini (Google) and Groq. Both stored in Vault.
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'

type Provider = 'google' | 'groq'

function normalizeProvider(v: unknown): Provider {
  return v === 'groq' ? 'groq' : 'google'
}

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

  let body: { action?: string; key?: string; model?: string; provider?: string }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false }, 400)
  }

  const provider = normalizeProvider(body.provider)

  if (body.action === 'set_chat_provider') {
    const p: Provider = body.provider === 'groq' ? 'groq' : 'google'
    await admin.from('ai_settings').upsert({ id: true, ai_chat_provider: p, updated_by: userData.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    console.log(JSON.stringify({ event: 'ai_chat_provider_changed', provider: p, by: userData.user.id }))
    const { data: cur } = await admin.from('ai_settings').select('configured, groq_configured, last4, groq_last4, gemini_model, groq_model, ai_chat_provider').eq('id', true).single()
    return json({ ok: true, ...cur as object })
  }

  if (body.action === 'set_model') {
    const model = (body.model ?? '').trim()
    if (provider === 'google') {
      if (!isAllowedGeminiModel(model)) return json({ ok: false, reason: 'invalid_format' })
      await admin.from('ai_settings').upsert({ id: true, gemini_model: model, updated_by: userData.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      console.log(JSON.stringify({ event: 'ai_model_changed', provider, by: userData.user.id, model }))
      const { data: cur } = await admin.from('ai_settings').select('configured, groq_configured, last4, groq_last4, gemini_model, groq_model, ai_chat_provider').eq('id', true).single()
      return json({ ok: true, ...cur as object, model })
    } else {
      if (!isAllowedGroqModel(model)) return json({ ok: false, reason: 'invalid_format' })
      await admin.from('ai_settings').upsert({ id: true, groq_model: model, updated_by: userData.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      console.log(JSON.stringify({ event: 'ai_model_changed', provider, by: userData.user.id, model }))
      const { data: cur } = await admin.from('ai_settings').select('configured, groq_configured, last4, groq_last4, gemini_model, groq_model, ai_chat_provider').eq('id', true).single()
      return json({ ok: true, ...cur as object, groq_model: model })
    }
  }

  if (body.action === 'remove') {
    if (provider === 'google') {
      const { data: current } = await admin.from('ai_settings').select('gemini_key_secret_id').eq('id', true).single()
      if (current?.gemini_key_secret_id) await admin.rpc('delete_vault_secret', { p_id: current.gemini_key_secret_id })
      await admin.from('ai_settings').update({ gemini_key_secret_id: null, configured: false, last4: null, updated_by: userData.user.id, updated_at: new Date().toISOString() }).eq('id', true)
      console.log(JSON.stringify({ event: 'ai_key_removed', provider, by: userData.user.id }))
    } else {
      const { data: current } = await admin.from('ai_settings').select('groq_key_secret_id').eq('id', true).single()
      if ((current as Record<string, unknown>)?.groq_key_secret_id) await admin.rpc('delete_vault_secret', { p_id: (current as Record<string, string>).groq_key_secret_id })
      await admin.from('ai_settings').update({ groq_key_secret_id: null, groq_configured: false, groq_last4: null, updated_by: userData.user.id, updated_at: new Date().toISOString() }).eq('id', true)
      console.log(JSON.stringify({ event: 'ai_key_removed', provider, by: userData.user.id }))
    }
    const { data: cur } = await admin.from('ai_settings').select('configured, groq_configured, last4, groq_last4, gemini_model, groq_model, ai_chat_provider').eq('id', true).single()
    return json({ ok: true, ...cur as object })
  }

  if (body.action === 'set') {
    const key = (body.key ?? '').trim()
    if (!key || key.length < 20) return json({ ok: false, reason: 'invalid_format' })

    // Validate per provider BEFORE committing
    try {
      if (provider === 'google') {
        const test = await fetch(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) })
        if (!test.ok) return json({ ok: false, reason: 'validation_failed' })
      } else {
        const test = await fetch(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) })
        if (!test.ok) return json({ ok: false, reason: 'validation_failed' })
      }
    } catch {
      return json({ ok: false, reason: 'validation_failed' })
    }

    if (provider === 'google') {
      const { data: existing } = await admin.from('ai_settings').select('gemini_key_secret_id').eq('id', true).single()
      const { data: secretId, error: secretErr } = await admin.rpc('create_vault_secret', { p_secret: key, p_name: 'gemini_api_key' })
      let newSecretId: string | null = typeof secretId === 'string' ? secretId : null
      if (secretErr || !newSecretId) return json({ ok: false, reason: 'storage_failed' })
      if ((existing as Record<string, unknown>)?.gemini_key_secret_id && (existing as Record<string, string>).gemini_key_secret_id !== newSecretId) {
        await admin.rpc('delete_vault_secret', { p_id: (existing as Record<string, string>).gemini_key_secret_id })
      }
      await admin.from('ai_settings').upsert({
        id: true, gemini_key_secret_id: newSecretId, configured: true, last4: key.slice(-4),
        ...(isAllowedGeminiModel(body.model) ? { gemini_model: body.model } : {}),
        updated_by: userData.user.id, updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      console.log(JSON.stringify({ event: 'ai_key_rotated', provider, by: userData.user.id, configured: true }))
    } else {
      const { data: existing } = await admin.from('ai_settings').select('groq_key_secret_id').eq('id', true).single()
      const { data: secretId, error: secretErr } = await admin.rpc('create_vault_secret', { p_secret: key, p_name: 'groq_api_key' })
      let newSecretId: string | null = typeof secretId === 'string' ? secretId : null
      if (secretErr || !newSecretId) return json({ ok: false, reason: 'storage_failed' })
      if ((existing as Record<string, unknown>)?.groq_key_secret_id && (existing as Record<string, string>).groq_key_secret_id !== newSecretId) {
        await admin.rpc('delete_vault_secret', { p_id: (existing as Record<string, string>).groq_key_secret_id })
      }
      await admin.from('ai_settings').upsert({
        id: true, groq_key_secret_id: newSecretId, groq_configured: true, groq_last4: key.slice(-4),
        ...(isAllowedGroqModel(body.model) ? { groq_model: body.model } : {}),
        updated_by: userData.user.id, updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      console.log(JSON.stringify({ event: 'ai_key_rotated', provider, by: userData.user.id, configured: true }))
    }

    const { data: cur } = await admin.from('ai_settings').select('configured, groq_configured, last4, groq_last4, gemini_model, groq_model, ai_chat_provider').eq('id', true).single()
    return json({ ok: true, ...cur as object })
  }

  return json({ ok: false, reason: 'unknown_action' }, 400)
})
