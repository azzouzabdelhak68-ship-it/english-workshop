import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { GEMINI_FOCUS_PRESETS } from '../lib/constants'
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  openDraft,
  renameDraft,
  saveDraft
} from '../lib/ai-chat'
import type { AiSettingsStatus, DraftMeta, MovieSessionResult, TranscriptMsg } from '../lib/types'
import { LEVELS } from '../lib/constants'
import { Banner } from '../components/ui'
import { SettingsModal } from '../components/ai/SettingsModal'
import { ChatStream } from '../components/ai/ChatStream'
import { DraftsMenu } from '../components/ai/DraftsMenu'
import { SessionResultCard } from '../components/ai/SessionResultCard'

type ErrCode = 'NO_API_KEY' | 'AI_UNAVAILABLE' | 'NO_CANDIDATE' | 'INVALID_JSON'
type Busy = 'idle' | 'generating' | 'editing' | 'publishing'

const ERR_KEY: Record<ErrCode, Parameters<ReturnType<typeof useApp>['t']>[0]> = {
  NO_API_KEY: 'errNoApiKey',
  AI_UNAVAILABLE: 'errAiUnavailable',
  NO_CANDIDATE: 'errNoCandidate',
  INVALID_JSON: 'errInvalidJson'
}

export function AiChatRoomView() {
  const { t, profile } = useApp()
  const [status, setStatus] = useState<AiSettingsStatus | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([])
  const [result, setResult] = useState<MovieSessionResult | null>(null)
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate')
  const [preset, setPreset] = useState<string | null>(null)
  const [busyState, setBusy] = useState<Busy>('idle')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<DraftMeta[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [input, setInput] = useState('')
  const [saveState, setSaveState] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean')
  const msgId = useRef(0)
  const saveTimer = useRef<number | null>(null)

  const busy = busyState !== 'idle'

  useEffect(() => {
    void loadStatus()
    void restoreLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── transcript helpers ─────────────────────────────────────────
  const pushMsg = useCallback((m: Omit<TranscriptMsg, 'id' | 'at'>) => {
    setTranscript((prev) => [...prev.slice(-199), { ...m, id: ++msgId.current, at: new Date().toISOString() }])
  }, [])
  const pushSysKey = useCallback(
    (kind: TranscriptMsg['kind'], key: string, vars?: Record<string, string | number>) =>
      pushMsg({ role: 'sys', kind, key, vars }),
    [pushMsg]
  )
  const pushSysRaw = useCallback(
    (kind: TranscriptMsg['kind'], raw: string) => pushMsg({ role: 'sys', kind, raw }),
    [pushMsg]
  )

  // ── persistence ────────────────────────────────────────────────
  const persist = useCallback(
    async (patch: { result?: MovieSessionResult | null; bumpTitle?: boolean } = {}) => {
      if (!sessionId) return
      setSaveState('saving')
      const ok = await saveDraft(sessionId, {
        title: draftTitle || undefined,
        level,
        focus_preset: preset,
        transcript,
        ...(patch.result !== undefined ? { result: patch.result } : {})
      })
      setSaveState(ok ? 'saved' : 'error')
      if (ok) window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'clean' : s)), 1500)
    },
    [sessionId, draftTitle, level, preset, transcript]
  )

  const scheduleSave = useCallback(() => {
    setSaveState('dirty')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void persist(), 1200)
  }, [persist])

  useEffect(() => {
    if (!sessionId) return
    scheduleSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, level, preset])

  useEffect(() => {
    function onHidden() {
      if (document.visibilityState === 'hidden' && sessionId) void persist()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [persist, sessionId])

  async function refreshDrafts() {
    setDrafts(await listDrafts())
  }

  async function loadStatus() {
    const { data } = await supabase.from('ai_settings_status').select('*').single()
    setStatus((data as AiSettingsStatus) ?? null)
    await refreshDrafts()
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId
    if (!profile) return null
    const id = await createDraft({
      owner: profile.id,
      title: draftTitle || undefined,
      level,
      focus_preset: preset,
      transcript
    })
    if (id) {
      setSessionId(id)
      await refreshDrafts()
    }
    return id
  }

  async function restoreLatest() {
    const list = await listDrafts()
    setDrafts(list)
    if (list.length === 0) return
    const opened = await openDraft(list[0].id)
    if (!opened) return
    setSessionId(opened.id)
    setDraftTitle(opened.title)
    setLevel(opened.level)
    setPreset(opened.focus_preset)
    setTranscript(opened.transcript)
    setResult(opened.result)
    if (opened.transcript.length > 0 || opened.result) {
      pushSysRaw('phase', '')
      setTranscript((prev) => [
        ...prev.slice(0, -1),
        { id: ++msgId.current, role: 'sys' as const, kind: 'phase' as const, key: 'draftResumed', vars: { title: opened.title }, at: new Date().toISOString() }
      ])
    }
  }

  // ── settings flows (L05–L09 preserved) ────────────────────────
  async function saveKey(e: React.FormEvent) {
    e.preventDefault()
    setBusy('publishing')
    const { data } = await supabase.functions.invoke('update-ai-key', { body: { action: 'set', key: keyInput.trim() } })
    setBusy('idle')
    if (data?.ok) {
      setKeyInput('')
      setSettingsOpen(false)
      void loadStatus()
    } else {
      alert(t('keyInvalid'))
    }
  }

  async function saveModel(e: React.FormEvent) {
    e.preventDefault()
    if (!modelInput) return
    setBusy('publishing')
    const { data } = await supabase.functions.invoke('update-ai-key', { body: { action: 'set_model', model: modelInput } })
    setBusy('idle')
    if (data?.ok) {
      setSettingsOpen(false)
      void loadStatus()
    } else {
      alert(t('keyInvalid'))
    }
  }

  async function removeKey() {
    setBusy('publishing')
    await supabase.functions.invoke('update-ai-key', { body: { action: 'remove' } })
    setBusy('idle')
    setSettingsOpen(false)
    void loadStatus()
  }

  // ── generation ────────────────────────────────────────────────
  async function generate(userMessage: string) {
    setBusy('generating')
    await ensureSession()
    pushMsg({ role: 'user', kind: 'user', raw: userMessage })
    pushSysKey('phase', 'searchingPhase')
    try {
      const prefix = GEMINI_FOCUS_PRESETS.find((p) => p.id === preset)?.promptPrefix
      const res = await supabase.functions.invoke('gemini-movie-session', {
        body: {
          user_message: prefix ? `${prefix}\n${userMessage}` : userMessage,
          workshop_level: level,
          chosen_movie: result?.session.film ?? null,
          prior_result: result
        }
      })
      if (res.error) throw res.error
      const data = res.data as { ok?: boolean; error_code?: ErrCode; result?: MovieSessionResult }
      if (!data.ok) throw Object.assign(new Error(data.error_code ?? 'AI_UNAVAILABLE'), { code: data.error_code })
      pushSysKey('phase', 'foundCandidates', { count: data.result?.candidates.length ?? 0 })
      pushSysKey('phase', 'draftingPhase')
      pushSysKey('ok', 'sessionReady')
      setResult(data.result ?? null)
      setEditingIdx(null)
    } catch (e) {
      const code = ((e as { code?: ErrCode }).code ?? 'AI_UNAVAILABLE') as ErrCode
      pushSysKey('err', ERR_KEY[code])
    } finally {
      setBusy('idle')
      void persist({ result })
      void refreshDrafts()
    }
  }

  async function submitEdit(idx: number, instruction: string) {
    if (!result) return
    setBusy('editing')
    try {
      const res = await supabase.functions.invoke('gemini-movie-session', {
        body: {
          user_message: '',
          workshop_level: level,
          chosen_movie: result.session.film ?? null,
          prior_result: result,
          edit_activity_index: idx,
          edit_instruction: instruction
        }
      })
      if (res.error) throw res.error
      const data = res.data as { ok?: boolean; error_code?: ErrCode; result?: MovieSessionResult }
      if (!data.ok || !data.result) throw Object.assign(new Error(data.error_code ?? 'AI_UNAVAILABLE'), { code: data.error_code })
      const next: MovieSessionResult = structuredClone(result)
      next.activities[idx] = data.result.activities[idx]
      setResult(next)
      setEditingIdx(null)
      pushSysKey('phase', 'activityUpdated', { n: idx + 1 })
    } catch (e) {
      const code = ((e as { code?: ErrCode }).code ?? 'AI_UNAVAILABLE') as ErrCode
      pushSysKey('err', ERR_KEY[code])
    } finally {
      setBusy('idle')
      void persist({ result })
    }
  }

  // ── publish (L17 preserved) ────────────────────────────────────
  async function publish() {
    if (!result) return
    setBusy('publishing')
    const starts = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const { error } = await supabase.from('sessions').insert({
      title: draftTitle || result.session.title,
      arabic_title: result.session.arabicTitle,
      description: `${result.session.description}\n\n🎬 ${t('filmLabel')}: ${result.session.film}`,
      level: ['Beginner', 'Intermediate', 'Advanced'].includes(result.session.level as never)
        ? result.session.level
        : level,
      format: 'Virtual',
      meeting_link: result.session.link,
      starts_at: starts,
      duration_minutes: result.session.duration_minutes,
      created_by: profile?.id
    })
    setBusy('idle')
    if (error) {
      pushSysKey('err', 'errAiUnavailable')
    } else {
      pushSysKey('ok', 'sessionCreatedOk')
    }
    void persist({ result })
  }

  // ── draft ops ──────────────────────────────────────────────────
  async function openOne(id: string) {
    const d = await openDraft(id)
    if (!d) return
    setSessionId(d.id)
    setDraftTitle(d.title)
    setLevel(d.level)
    setPreset(d.focus_preset)
    setTranscript(d.transcript)
    setResult(d.result)
    void refreshDrafts()
  }

  async function newDraft() {
    if (sessionId) void persist()
    setSessionId(null)
    setDraftTitle('')
    setTranscript([])
    setResult(null)
    setEditingIdx(null)
    msgId.current = 0
  }

  async function rename(id: string, title: string) {
    await renameDraft(id, title)
    if (id === sessionId) setDraftTitle(title)
    pushSysKey('phase', 'draftRenamed', { title })
    void refreshDrafts()
  }

  async function duplicate(id: string) {
    await duplicateDraft(id)
    pushSysKey('phase', 'draftDuplicated')
    void refreshDrafts()
  }

  async function remove(id: string) {
    await deleteDraft(id)
    if (id === sessionId) await newDraft()
    void refreshDrafts()
  }

  const chips = [
    t('chipSuggestShortMovie'),
    t('chipRegenerateActivities'),
    t('chipMoreFormal'),
    t('chipMakeEasier'),
    t('chipAlternativeMovie'),
    t('chipCreateDraft')
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-10">
      <Banner kind="info">🔒 {t('aiChatStaffOnly')}</Banner>

      {/* header cockpit */}
      <div className="app-card relative mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-bold">🔑 {t('aiChatSettings')}</p>
          <p className="text-sm opacity-70">{status?.configured ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}</p>
          {status?.configured && status.last4 && (
            <p className="text-xs opacity-50">{t('last4Label', { last4: status.last4 })}</p>
          )}
          {status?.configured && status.gemini_model && (
            <p className="text-xs font-semibold opacity-70">⚙️ {status.gemini_model}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveState !== 'clean' && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                saveState === 'error'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'bg-mist-200 text-mist-700 dark:bg-mist-800 dark:text-mist-200'
              }`}
            >
              {saveState === 'saving' || saveState === 'dirty'
                ? t('draftSaving')
                : saveState === 'saved'
                  ? t('draftSaved')
                  : `⚠️ ${t('draftSaving')}`}
            </span>
          )}
          <button
            aria-haspopup="menu"
            aria-expanded={draftsOpen}
            onClick={() => setDraftsOpen(!draftsOpen)}
            className="btn-secondary !min-h-[40px] px-4 py-2 text-sm"
          >
            📚 {t('draftsTitle')} ({drafts.length})
          </button>
          <button
            onClick={() => {
              setModelInput(status?.gemini_model ?? '')
              setSettingsOpen(true)
            }}
            className="btn-secondary !min-h-[40px] px-4 py-2 text-sm"
          >
            ⚙️ {status?.configured ? t('replaceKey') : t('enterApiKey')}
          </button>
        </div>
        <DraftsMenu
          open={draftsOpen}
          drafts={drafts}
          activeId={sessionId}
          busy={busy}
          onOpen={(id) => {
            setDraftsOpen(false)
            void openOne(id)
          }}
          onNew={() => {
            setDraftsOpen(false)
            void newDraft()
          }}
          onRename={(id, tt) => void rename(id, tt)}
          onDuplicate={(id) => void duplicate(id)}
          onDelete={(id) => void remove(id)}
          onClose={() => setDraftsOpen(false)}
        />
      </div>

      {/* level pills (L10 byte-preserved classes) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-60">{t('learnerLevelLabel')}</span>
        {LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setLevel(lv)}
            className={`pill min-h-[36px] px-3 ${level === lv ? 'bg-petrol-700 !text-white' : 'bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100'}`}
          >
            {lv}
          </button>
        ))}
      </div>

      {/* focus presets (F-E) */}
      <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide opacity-60">{t('focusLabel')}</span>
        {GEMINI_FOCUS_PRESETS.map((fp) => (
          <button
            key={fp.id}
            aria-pressed={preset === fp.id}
            onClick={() => setPreset(preset === fp.id ? null : fp.id)}
            className={`pill min-h-[40px] shrink-0 px-3 text-sm ${
              preset === fp.id
                ? '!border !border-brass-400 bg-brass-100 !text-brass-900 dark:border-brass-700 dark:bg-brass-900/40 dark:!text-brass-100'
                : 'bg-mist-200 !text-mist-900 hover:bg-mist-300 dark:bg-mist-800 dark:!text-mist-100'
            }`}
          >
            {t(fp.labelKey)}
          </button>
        ))}
      </div>

      {/* chat stream */}
      <ChatStream msgs={transcript} busy={busy} hasContent={transcript.length > 0 || !!result} />

      {/* result */}
      {result && (
        <SessionResultCard
          result={result}
          presetLabel={preset ? t(GEMINI_FOCUS_PRESETS.find((x) => x.id === preset)?.labelKey as never) : null}
          published={false}
          busy={busy}
          editingIdx={editingIdx}
          onEdit={(i) => setEditingIdx(i)}
          onCancelEdit={() => setEditingIdx(null)}
          onSubmitEdit={(instr) => editingIdx !== null && void submitEdit(editingIdx, instr)}
          onPublish={() => void publish()}
        />
      )}

      {/* composer */}
      <div className="app-card sticky bottom-0 mt-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="no-print mb-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              disabled={busy}
              onClick={() => void generate(c)}
              className="pill min-h-[40px] bg-mist-200 px-4 !text-mist-900 hover:bg-mist-300 disabled:opacity-50 dark:bg-mist-800 dark:!text-mist-100"
            >
              {c}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!input.trim()) return
            void generate(input.trim())
            setInput('')
          }}
          className="flex gap-2"
        >
          <input
            className="input-base"
            placeholder={t('suggestNextSession')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (input.trim()) {
                  void generate(input.trim())
                  setInput('')
                }
              }
            }}
            aria-label={t('suggestNextSession')}
          />
          <button type="submit" disabled={busy} className="btn-primary px-5 disabled:opacity-60">
            {busy ? t('workingState') : '➤'}
          </button>
        </form>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={status}
        busy={busy}
        modelInput={modelInput}
        setModelInput={setModelInput}
        onSaveKey={saveKey}
        keyInput={keyInput}
        setKeyInput={setKeyInput}
        onSaveModel={saveModel}
        onRemove={removeKey}
      />
    </div>
  )
}
