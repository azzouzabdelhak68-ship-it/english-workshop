import { supabase } from './supabase'
import type { AiChatSessionRow, DraftMeta, MovieSessionResult, TranscriptMsg } from './types'

// Data layer for AI Chat Room draft persistence (AI_ROOM_PLAN.md §6.8).
// All calls go through the shared supabase client → demo-aware automatically.

const MAX_TRANSCRIPT = 200

function toMeta(row: { id: string; title: string; updated_at: string; result: unknown }): DraftMeta {
  return { id: row.id, title: row.title, updated_at: row.updated_at, has_result: !!row.result }
}

export async function listDrafts(): Promise<DraftMeta[]> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id,title,updated_at,result')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return (data as Array<{ id: string; title: string; updated_at: string; result: unknown }>).map(toMeta)
}

export interface OpenedDraft {
  id: string
  title: string
  level: AiChatSessionRow['level']
  focus_preset: string | null
  transcript: TranscriptMsg[]
  result: MovieSessionResult | null
}

export async function openDraft(id: string): Promise<OpenedDraft | null> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id,title,level,focus_preset,transcript,result')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as {
    id: string; title: string; level: AiChatSessionRow['level']
    focus_preset: string | null; transcript: TranscriptMsg[]; result: MovieSessionResult | null
  }
  return {
    id: row.id,
    title: row.title,
    level: row.level,
    focus_preset: row.focus_preset,
    transcript: Array.isArray(row.transcript) ? row.transcript : [],
    result: row.result ?? null
  }
}

export async function createDraft(seed: {
  owner: string
  title?: string
  level?: AiChatSessionRow['level']
  focus_preset?: string | null
  transcript?: TranscriptMsg[]
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .insert({
      owner: seed.owner,
      title: seed.title ?? null,
      level: seed.level ?? 'Intermediate',
      focus_preset: seed.focus_preset ?? null,
      transcript: (seed.transcript ?? []).slice(-MAX_TRANSCRIPT),
      result: null
    })
    .select('id')
    .single()
  if (error || !data) return null
  return (data as { id: string }).id
}

export interface DraftPatch {
  title?: string
  level?: AiChatSessionRow['level']
  focus_preset?: string | null
  transcript?: TranscriptMsg[]
  result?: MovieSessionResult | null
}

export async function saveDraft(id: string, patch: DraftPatch): Promise<boolean> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) body.title = patch.title
  if (patch.level !== undefined) body.level = patch.level
  if (patch.focus_preset !== undefined) body.focus_preset = patch.focus_preset
  if (patch.transcript !== undefined) body.transcript = patch.transcript.slice(-MAX_TRANSCRIPT)
  if (patch.result !== undefined) body.result = patch.result
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .update(body)
    .eq('id', id)
    .select('id')
  if (error) return false
  // 0 rows ⇒ deleted elsewhere (E07): recreate self-heal is caller's job.
  return Array.isArray(data) && data.length > 0
}

export async function renameDraft(id: string, title: string): Promise<void> {
  await supabase.from('ai_chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function duplicateDraft(id: string): Promise<string | null> {
  const src = await openDraft(id)
  if (!src) return null
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null
  return createDraft({
    owner: userData.user.id,
    title: `${src.title} (copy)`,
    level: src.level,
    focus_preset: src.focus_preset,
    transcript: src.transcript
  }).then((newId) => {
    if (newId && src.result) void supabase.from('ai_chat_sessions').update({ result: src.result }).eq('id', newId)
    return newId
  })
}

export async function deleteDraft(id: string): Promise<void> {
  await supabase.from('ai_chat_sessions').delete().eq('id', id)
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/)
  return m ? m[1] : null
}

export function sumTimings(result: MovieSessionResult | null): number {
  if (!result) return 0
  return result.activities.reduce((acc, a) => acc + (Number(a.timing_min) || 0), 0)
}

export function formatPlaintextActivity(
  n: number,
  a: { title: string; goal: string; timing_min: number; grouping: string; prompt: string; arabicHint?: string; skill_focus: string[]; expected_output: string }
): string {
  const lines = [
    `${n}. ${a.title}`,
    `Goal: ${a.goal}`,
    `Time: ${a.timing_min} min · Grouping: ${a.grouping}`,
    `Prompt: ${a.prompt}`
  ]
  if (a.arabicHint) lines.push(`تلميح: ${a.arabicHint}`)
  lines.push(`Skills: ${a.skill_focus.join(', ')}`)
  lines.push(`Expected output: ${a.expected_output}`)
  return lines.join('\n')
}
