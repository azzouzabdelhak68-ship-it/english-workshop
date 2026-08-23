import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { WorkshopActivity } from '../../lib/types'

interface Props {
  n: number
  activity: WorkshopActivity
  busy: boolean
  editing: boolean
  onEdit(): void
  onCancelEdit(): void
  onSubmitEdit(instruction: string): void
}

const EDIT_CHIPS = [
  { key: 'chipEasier', phrase: 'Make this activity easier with more scaffolding.' },
  { key: 'chipForPairs', phrase: 'Make this activity suitable for pairs.' },
  { key: 'chipAddArabicHints', phrase: 'Add Arabic support hints to this activity.' },
  { key: 'chipMoreFormalShort', phrase: 'Make the language of this activity more formal.' },
  { key: 'chipLonger', phrase: 'Extend this activity with an extra step and more time.' }
] as const

export function ActivityItem(p: Props) {
  const { t } = useApp()
  const [copied, setCopied] = useState(false)
  const [instr, setInstr] = useState('')
  const a = p.activity

  function copy() {
    const lines = [
      `${p.n}. ${a.title}`,
      `${t('goalLabel')}: ${a.goal}`,
      `🕒 ${t('timingMin', { min: a.timing_min })} · 👥 ${a.grouping}`,
      `${a.prompt}`
    ]
    if (a.arabicHint) lines.push(a.arabicHint)
    lines.push(`🧩 ${t('skillsLabel')}: ${a.skill_focus.join(', ')}`)
    lines.push(`${t('expectedOutputLabel')}: ${a.expected_output}`)
    void navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <li
      className={`group relative rounded-xl border border-mist-200 p-4 transition-shadow hover:shadow-md dark:border-mist-700 ${
        p.busy && p.editing ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-petrol-700 text-xs font-bold text-white">
          {p.n}
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-bold">{a.title}</h4>
        <div className="no-print flex gap-1 md:opacity-0 md:transition-opacity md:focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            onClick={p.onEdit}
            aria-label={t('editActivity')}
            disabled={p.busy}
            className="grid h-8 w-8 place-items-center rounded-lg text-sm hover:bg-mist-100 disabled:opacity-40 dark:hover:bg-mist-800"
          >
            ✏️
          </button>
          <button
            onClick={copy}
            aria-label={t('copyActivity')}
            className="grid h-8 w-8 place-items-center rounded-lg text-sm hover:bg-mist-100 dark:hover:bg-mist-800"
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm italic opacity-80">{a.goal}</p>
      <div className="no-print mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-80">
        <span>🕒 {t('timingMin', { min: a.timing_min })}</span>
        <span>👥 {a.grouping}</span>
      </div>
      <p className="mt-2 border-s-2 border-brass-300 ps-3 text-sm leading-relaxed dark:border-brass-700">
        {a.prompt}
      </p>
      {a.arabicHint && (
        <p dir="rtl" className="mt-1 font-arabic text-start text-sm leading-loose opacity-90">
          {a.arabicHint}
        </p>
      )}
      <p className="mt-2 text-xs opacity-70">🧩 {t('skillsLabel')}: {a.skill_focus.join(', ')}</p>
      <p className="mt-1 text-xs opacity-70">{t('expectedOutputLabel')}: {a.expected_output}</p>

      {p.editing && (
        <div className="no-print mt-3 rounded-lg bg-mist-100 p-3 dark:bg-mist-800">
          <label className="sr-only" htmlFor={`edit-instr-${p.n}`}>{t('editInstructionPh')}</label>
          <textarea
            id={`edit-instr-${p.n}`}
            className="input-base min-h-[72px]"
            placeholder={t('editInstructionPh')}
            maxLength={300}
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') p.onCancelEdit()
            }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EDIT_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setInstr((v) => (v ? `${v} ${c.phrase}` : c.phrase))}
                className="pill min-h-[28px] bg-mist-200 px-2 !text-xs !text-mist-900 hover:bg-mist-300 dark:bg-mist-700 dark:!text-mist-100"
              >
                {t(c.key)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={p.onCancelEdit} disabled={p.busy} className="btn-secondary px-3 py-1.5 text-sm">
              {t('cancelEdit')}
            </button>
            <button
              onClick={() => p.onSubmitEdit(instr.trim())}
              disabled={p.busy || !instr.trim()}
              className="btn-primary px-4 py-1.5 text-sm disabled:opacity-60"
            >
              {p.busy ? t('loading') : t('runEdit')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
