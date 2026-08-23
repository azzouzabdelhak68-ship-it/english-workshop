import { GEMINI_MODELS } from '../../lib/constants'
import { Modal } from '../ui'
import type { AiSettingsStatus } from '../../lib/types'
import { useApp } from '../../context/AppContext'

interface Props {
  open: boolean
  onClose(): void
  status: AiSettingsStatus | null
  busy: boolean
  modelInput: string
  setModelInput(m: string): void
  onSaveKey(e: React.FormEvent): void
  keyInput: string
  setKeyInput(k: string): void
  onSaveModel(e: React.FormEvent): void
  onRemove(): void
}

export function SettingsModal(p: Props) {
  const { t } = useApp()
  return (
    <Modal open={p.open} onClose={p.onClose} title={t('aiChatSettings')}>
      <form onSubmit={p.onSaveKey} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('enterApiKey')}
          <input type="password" required className="input-base" value={p.keyInput} onChange={(e) => p.setKeyInput(e.target.value)} autoComplete="off" />
        </label>
        <button type="submit" disabled={p.busy} className="btn-primary disabled:opacity-60">
          {p.busy ? t('loading') : t('save')}
        </button>
      </form>

      {p.status?.configured && (
        <form onSubmit={p.onSaveModel} className="mt-3 flex flex-col gap-3 border-t border-mist-200 pt-3 dark:border-mist-700">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('aiModelLabel')}
            <select className="input-base" value={p.modelInput} onChange={(e) => p.setModelInput(e.target.value)}>
              {GEMINI_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={p.busy || p.modelInput === p.status.gemini_model} className="btn-secondary disabled:opacity-60">
            {p.busy ? t('loading') : t('save')}
          </button>
        </form>
      )}

      {p.status?.configured && (
        <button onClick={p.onRemove} disabled={p.busy} className="btn-secondary mt-3 w-full !text-red-700 dark:!text-red-400">
          {t('removeKey')}
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed opacity-60">
        The key is validated server-side before being stored in Supabase Vault and is never returned to the browser — only its masked state.
      </p>
    </Modal>
  )
}
