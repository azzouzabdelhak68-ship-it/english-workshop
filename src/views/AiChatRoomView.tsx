import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { AiSettingsStatus, MovieSessionResult } from '../lib/types'
import { LEVELS, GEMINI_MODELS } from '../lib/constants'
import { Modal, Banner } from '../components/ui'
import { TextChatStream } from '../components/TextChatStream'

type ErrCode = 'NO_API_KEY' | 'AI_UNAVAILABLE' | 'NO_CANDIDATE' | 'INVALID_JSON'

interface SysMsg {
  id: number
  text: string
  kind: 'phase' | 'err'
}

const ERR_KEY: Record<ErrCode, Parameters<ReturnType<typeof useApp>['t']>[0]> = {
  NO_API_KEY: 'errNoApiKey',
  AI_UNAVAILABLE: 'errAiUnavailable',
  NO_CANDIDATE: 'errNoCandidate',
  INVALID_JSON: 'errInvalidJson'
}

export function AiChatRoomView() {
  const { t, profile } = useApp()
  const [status, setStatus] = useState<AiSettingsStatus | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [sysMsgs, setSysMsgs] = useState<SysMsg[]>([])
  const [result, setResult] = useState<MovieSessionResult | null>(null)
  const [input, setInput] = useState('')
  const [level, setLevel] = useState(profile?.level ?? 'Intermediate')
  const msgId = useRef(0)

  useEffect(() => {
    void loadStatus()
  }, [])

  async function loadStatus() {
    const { data } = await supabase.from('ai_settings_status').select('*').single()
    setStatus((data as AiSettingsStatus) ?? null)
  }

  function pushSys(text: string, kind: SysMsg['kind'] = 'phase') {
    setSysMsgs((prev) => [...prev, { id: ++msgId.current, text, kind }])
  }

  async function generate(userMessage: string) {
    setBusy(true)
    pushSys(t('searchingPhase'))
    try {
      const res = await supabase.functions.invoke('gemini-movie-session', {
        body: {
          user_message: userMessage,
          workshop_level: level,
          chosen_movie: result?.session.film ?? null,
          prior_result: result
        }
      })
      if (res.error) throw res.error
      const data = res.data as { ok?: boolean; error_code?: ErrCode; result?: MovieSessionResult }
      if (!data.ok) throw Object.assign(new Error(data.error_code ?? 'AI_UNAVAILABLE'), { code: data.error_code })
      pushSys(`🎬 ${data.result?.candidates.length ?? 0}`)
      pushSys(t('draftingPhase'))
      setResult(data.result ?? null)
    } catch (e) {
      const code = ((e as { code?: ErrCode }).code ?? 'AI_UNAVAILABLE') as ErrCode
      setSysMsgs((prev) => [...prev, { id: ++msgId.current, text: t(ERR_KEY[code]), kind: 'err' }])
    } finally {
      setBusy(false)
    }
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data } = await supabase.functions.invoke('update-ai-key', { body: { action: 'set', key: keyInput.trim() } })
    setBusy(false)
    if (data?.ok) {
      setKeyInput('')
      setSettingsOpen(false)
      void loadStatus()
    } else {
      alert(t('keyInvalid'))
    }
  }

  async function removeKey() {
    setBusy(true)
    await supabase.functions.invoke('update-ai-key', { body: { action: 'remove' } })
    setBusy(false)
    setSettingsOpen(false)
    void loadStatus()
  }

  async function saveModel(e: React.FormEvent) {
    e.preventDefault()
    if (!modelInput) return
    setBusy(true)
    const { data } = await supabase.functions.invoke('update-ai-key', { body: { action: 'set_model', model: modelInput } })
    setBusy(false)
    if (data?.ok) {
      setSettingsOpen(false)
      void loadStatus()
      pushSys(t('modelSaved'))
    } else {
      alert(t('keyInvalid'))
    }
  }

  async function createDraftSession(r: MovieSessionResult) {
    const starts = new Date(Date.now() + 2 * 86_400_000).toISOString()
    await supabase.from('sessions').insert({
      title: r.session.title,
      arabic_title: r.session.arabicTitle,
      description: `${r.session.description}\n\n🎬 ${t('filmLabel')}: ${r.session.film}`,
      level: LEVELS.includes(r.session.level as never) ? r.session.level : level,
      format: 'Virtual',
      meeting_link: r.session.link,
      starts_at: starts,
      duration_minutes: r.session.duration_minutes,
      created_by: profile?.id
    })
    pushSys(t('sessionCreatedOk'))
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

      <div className="app-card mt-4 flex items-center justify-between p-4">
        <div>
          <p className="font-bold">🔑 {t('aiChatSettings')}</p>
          <p className="text-sm opacity-70">{status?.configured ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}</p>
          {status?.configured && status.last4 && (
            <p className="text-xs opacity-50">{t('last4Label', { last4: status.last4 })}</p>
          )}
          {status?.configured && status.gemini_model && (
            <p className="text-xs font-semibold opacity-70">⚙️ {status.gemini_model}</p>
          )}
        </div>
        <button
          onClick={() => {
            setModelInput(status?.gemini_model ?? GEMINI_MODELS[0])
            setSettingsOpen(true)
          }}
          className="btn-secondary !min-h-[40px] px-4 py-2 text-sm"
        >
          ⚙️ {status?.configured ? t('replaceKey') : t('enterApiKey')}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-60">{t('learnerLevelLabel')}</span>
        {LEVELS.map((lv) => (
          <button key={lv} onClick={() => setLevel(lv)} className={`pill min-h-[36px] px-3 ${level === lv ? 'bg-petrol-700 !text-white' : 'bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100'}`}>
            {lv}
          </button>
        ))}
      </div>

      {sysMsgs.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {sysMsgs.map((m) => (
            <p key={m.id} className={`rounded-lg px-3 py-2 text-xs font-semibold ${m.kind === 'err' ? 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100' : 'bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100'}`}>
              {m.text.startsWith('🎬') ? m.text.replace(/(\d+)/, String(m.text.match(/\d+/)?.[0] ?? 0)) : m.text}
            </p>
          ))}
        </div>
      )}

      {result && (
        <article className="app-card mt-4 overflow-hidden">
          <header className="bg-petrol-700 p-5 !text-white">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">{t('workshopSession')}</p>
            <h3 className="mt-1 text-xl font-extrabold">{result.session.title}</h3>
            {result.session.arabicTitle && <p dir="rtl" className="font-arabic text-sm opacity-85">{result.session.arabicTitle}</p>}
            <p className="mt-2 text-sm opacity-85">
              🎬 {t('filmLabel')}: <strong>{result.session.film}</strong>
              {result.session.link && (
                <>
                  {' • '}
                  <a href={result.session.link} target="_blank" rel="noreferrer" className="underline">
                    watch
                  </a>
                </>
              )}
            </p>
            <p className="text-xs opacity-75">
              {t('totalWorkshopTime')}: {t('timingMin', { min: result.session.duration_minutes })} • {result.session.level}
            </p>
          </header>
          <div className="p-5">
            <p className="text-sm leading-relaxed opacity-85">{result.session.description}</p>
            <h4 className="mb-2 mt-4 font-bold">{t('activitiesLabel', { count: result.activities.length })}</h4>
            <ol className="space-y-3">
              {result.activities.map((a, i) => (
                <li key={i} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pill bg-petrol-700 !text-white">{i + 1}</span>
                    <strong>{a.title}</strong>
                    <span className="pill bg-brass-500 !text-white">{t('timingMin', { min: a.timing_min })}</span>
                    <span className="pill bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100">{a.grouping}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{a.goal}</p>
                  <p className="mt-1 text-sm opacity-85">{a.prompt}</p>
                  {a.arabicHint && (
                    <p dir="rtl" className="font-arabic mt-1 text-xs text-brass-700 dark:text-brass-300">💡 {a.arabicHint}</p>
                  )}
                  <p className="mt-2 text-xs opacity-70">
                    ✅ {t('expectedOutputLabel')}: {a.expected_output}
                  </p>
                  <p className="mt-1 text-xs opacity-60">
                    🧩 {t('skillsLabel')}: {a.skill_focus.join(', ')}
                  </p>
                </li>
              ))}
            </ol>
            <button onClick={() => void createDraftSession(result)} className="btn-primary mt-4 w-full">
              📅 {t('createSessionFromDraft')}
            </button>
          </div>
        </article>
      )}

      <div className="app-card mt-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c} disabled={busy} onClick={() => void generate(c)} className="pill min-h-[40px] bg-mist-200 px-4 !text-mist-900 hover:bg-mist-300 disabled:opacity-50 dark:bg-mist-800 dark:!text-mist-100">
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
          <input className="input-base" placeholder={t('suggestNextSession')} value={input} onChange={(e) => setInput(e.target.value)} aria-label={t('suggestNextSession')} />
          <button type="submit" disabled={busy} className="btn-primary px-5 disabled:opacity-60">
            {busy ? t('workingState') : '➤'}
          </button>
        </form>
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t('aiChatSettings')}>
        <form onSubmit={saveKey} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('enterApiKey')}
            <input type="password" required className="input-base" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? t('loading') : t('save')}
          </button>
        </form>
        {status?.configured && (
          <form onSubmit={saveModel} className="mt-3 flex flex-col gap-3 border-t border-mist-200 pt-3 dark:border-mist-700">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {t('aiModelLabel')}
              <select className="input-base" value={modelInput} onChange={(e) => setModelInput(e.target.value)}>
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || modelInput === status.gemini_model} className="btn-secondary disabled:opacity-60">
              {busy ? t('loading') : t('save')}
            </button>
          </form>
        )}
        {status?.configured && (
          <button onClick={removeKey} disabled={busy} className="btn-secondary mt-3 w-full !text-red-700 dark:!text-red-400">
            {t('removeKey')}
          </button>
        )}
        <p className="mt-3 text-[11px] leading-relaxed opacity-60">
          The key is validated server-side before being stored in Supabase Vault and is never returned to the browser — only its masked state.
        </p>
      </Modal>
    </div>
  )
}
