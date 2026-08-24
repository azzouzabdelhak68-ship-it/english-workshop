import { useState } from 'react'
import { GEMINI_MODELS, GROQ_MODELS } from '../../lib/constants'
import { Modal } from '../ui'
import type { AiSettingsStatus } from '../../lib/types'
import { useApp } from '../../context/AppContext'

interface Props {
  open: boolean
  onClose(): void
  status: AiSettingsStatus | null
  busy: boolean
  googleKeyInput: string
  setGoogleKeyInput(v: string): void
  groqKeyInput: string
  setGroqKeyInput(v: string): void
  googleModelInput: string
  setGoogleModelInput(v: string): void
  groqModelInput: string
  setGroqModelInput(v: string): void
  onSaveKey: (provider: 'google' | 'groq', e: React.FormEvent) => void
  onSaveModel: (provider: 'google' | 'groq', e: React.FormEvent) => void
  onRemove: (provider: 'google' | 'groq') => void
  onSetChatProvider: (provider: 'google' | 'groq') => void
}

export function SettingsModal(p: Props) {
  const { t } = useApp()
  const [tab, setTab] = useState<'google' | 'groq'>('google')
  const isGoogle = tab === 'google'
  const configured = isGoogle ? p.status?.configured : p.status?.groq_configured
  const last4 = isGoogle ? p.status?.last4 : p.status?.groq_last4
  const modelVal = isGoogle ? p.googleModelInput : p.groqModelInput
  const modelOptions = isGoogle ? GEMINI_MODELS : GROQ_MODELS
  const currentModel = isGoogle ? p.status?.gemini_model : p.status?.groq_model

  return (
    <Modal open={p.open} onClose={p.onClose} title={t('aiChatSettings')}>
      {/* Chat provider switch — controls which engine the AI Chat Room uses */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-mist-100 p-2 dark:bg-mist-800">
        <span className="text-xs font-bold">AI Chat uses:</span>
        <button
          onClick={() => p.onSetChatProvider('google')}
          className={`rounded-full px-3 py-1 text-xs font-bold ${p.status?.ai_chat_provider !== 'groq' ? 'bg-petrol-700 text-white' : 'bg-white text-mist-900 dark:bg-mist-700 dark:text-mist-100'}`}
        >
          🔵 Google
        </button>
        <button
          onClick={() => p.onSetChatProvider('groq')}
          className={`rounded-full px-3 py-1 text-xs font-bold ${p.status?.ai_chat_provider === 'groq' ? 'bg-petrol-700 text-white' : 'bg-white text-mist-900 dark:bg-mist-700 dark:text-mist-100'}`}
        >
          🟠 Groq
        </button>
        <span className="ms-auto text-[10px] opacity-60">{p.status?.ai_chat_provider === 'groq' ? 'Groq engine' : 'Google engine'}</span>
      </div>

      {/* Provider tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('google')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${isGoogle ? 'bg-petrol-700 text-white' : 'bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100'}`}
        >
          🔵 Google Gemini
        </button>
        <button
          onClick={() => setTab('groq')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${!isGoogle ? 'bg-petrol-700 text-white' : 'bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100'}`}
        >
          🟠 Groq
        </button>
      </div>

      <p className="mb-2 text-xs opacity-70">
        {configured ? `${t('apiKeyConfigured')} · ${t('last4Label', { last4: last4 ?? '' })}` : t('apiKeyNotConfigured')}
        {currentModel && ` · ${currentModel}`}
      </p>

      <form onSubmit={(e) => p.onSaveKey(tab, e)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {isGoogle ? 'Google AI API key' : 'Groq API key'}
          <input
            type="password"
            required
            className="input-base"
            placeholder={isGoogle ? 'AIza…' : 'gsk_…'}
            value={isGoogle ? p.googleKeyInput : p.groqKeyInput}
            onChange={(e) => (isGoogle ? p.setGoogleKeyInput(e.target.value) : p.setGroqKeyInput(e.target.value))}
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={p.busy} className="btn-primary disabled:opacity-60">
          {p.busy ? t('loading') : t('save')}
        </button>
      </form>

      {configured && (
        <form onSubmit={(e) => p.onSaveModel(tab, e)} className="mt-3 flex flex-col gap-3 border-t border-mist-200 pt-3 dark:border-mist-700">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {isGoogle ? t('aiModelLabel') : 'Groq model'}
            <select className="input-base" value={modelVal} onChange={(e) => isGoogle ? p.setGoogleModelInput(e.target.value) : p.setGroqModelInput(e.target.value)}>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={p.busy || modelVal === currentModel} className="btn-secondary disabled:opacity-60">
            {p.busy ? t('loading') : t('save')}
          </button>
        </form>
      )}

      {configured && (
        <button onClick={() => p.onRemove(tab)} disabled={p.busy} className="btn-secondary mt-3 w-full !text-red-700 dark:!text-red-400">
          {t('removeKey')}
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed opacity-60">
        The keys are validated server-side before being stored in Supabase Vault and are never returned to the browser — only masked state.
      </p>
    </Modal>
  )
}
