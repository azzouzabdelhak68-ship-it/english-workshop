import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { AVATAR_PRESETS, LEVELS, placementTestAnswerCorrect } from '../lib/constants'

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { t, profile } = useApp()
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [level, setLevel] = useState(profile?.level ?? 'Intermediate')
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_PRESETS[0])
  const [goals, setGoals] = useState('')
  const [showPlacement, setShowPlacement] = useState(false)
  const [placementResult, setPlacementResult] = useState('')
  const [busy, setBusy] = useState(false)

  async function answerPlacement(option: string) {
    if (placementTestAnswerCorrect(option)) {
      setLevel('Intermediate')
      setPlacementResult(t('scoreSetIntermediate'))
    }
    setShowPlacement(false)
  }

  async function finish() {
    if (!profile) return
    setBusy(true)
    await supabase
      .from('profiles')
      .update({
        nickname: nickname.trim(),
        level,
        avatar,
        learning_goals: goals || null,
        onboarded: true
      })
      .eq('id', profile.id)
    setBusy(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[color:var(--background)] p-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-mist-200 dark:bg-mist-800">
          <div
            className="h-full rounded-full bg-petrol-700 transition-all dark:bg-petrol-400"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide opacity-60">{t('onboardingStep', { step })}</p>

        {step === 1 && (
          <section>
            <h2 className="mb-2 text-2xl font-extrabold">{t('obNicknameTitle')}</h2>
            <p className="mb-6 text-sm opacity-70">{t('obNicknameHint')}</p>
            <input
              autoFocus
              className="input-base text-lg"
              value={nickname}
              minLength={2}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('obNicknameHint')}
            />
            <button disabled={nickname.trim().length < 2} onClick={() => setStep(2)} className="btn-primary mt-8 w-full disabled:opacity-50">
              {t('submit')}
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="mb-6 text-2xl font-extrabold">{t('obLevelTitle')}</h2>
            <div className="flex flex-col gap-3">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  onClick={() => {
                    setLevel(lv)
                    setStep(3)
                  }}
                  className={`btn-secondary justify-between ${level === lv ? 'ring-2 ring-petrol-600' : ''}`}
                >
                  <span>{lv}</span>
                  {level === lv && <span>✓</span>}
                </button>
              ))}
            </div>
            {showPlacement ? (
              <div className="app-card mt-6 p-4">
                <p className="mb-3 font-semibold">{t('obPlacementQ')}</p>
                <div className="flex flex-col gap-2">
                  {['finished', 'had finished', 'was finishing'].map((opt) => (
                    <button key={opt} onClick={() => answerPlacement(opt)} className="btn-secondary min-h-[44px] py-2">
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : placementResult ? (
              <p className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                {placementResult} — {level}
              </p>
            ) : (
              <button onClick={() => setShowPlacement(true)} className="mt-6 text-sm font-semibold text-petrol-700 underline dark:text-petrol-300">
                {t('obNotSure')}
              </button>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="mb-6 text-2xl font-extrabold">{t('obAvatarTitle')}</h2>
            <div className="grid grid-cols-5 gap-3">
              {AVATAR_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAvatar(a)
                    setStep(4)
                  }}
                  aria-label={`avatar ${a}`}
                  className={`app-card flex aspect-square items-center justify-center text-3xl transition hover:scale-105 ${
                    avatar === a ? 'ring-2 ring-brass-500' : ''
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 className="mb-2 text-2xl font-extrabold">{t('obGoalsTitle')}</h2>
            <p className="mb-4 text-sm opacity-70">{profile?.email}</p>
            <textarea
              rows={3}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="input-base"
              placeholder={t('obGoalsHint')}
            />
            <ul className="mt-4 space-y-1 text-sm opacity-80">
              <li>✓ {t('obNicknameTitle')}: {nickname}</li>
              <li>✓ {t('obLevelTitle')}: {level}</li>
              <li>✓ {t('obAvatarTitle')}: {avatar}</li>
            </ul>
            <button disabled={busy} onClick={finish} className="btn-primary mt-8 w-full disabled:opacity-60">
              {busy ? t('loading') : t('obFinish')}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
