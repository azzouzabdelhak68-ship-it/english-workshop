import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { BreakoutRoom, RoomMember, ScenarioTemplate, Session } from '../lib/types'
import { Modal } from '../components/ui'
import { TextChatStream } from '../components/TextChatStream'

export function BreakoutRoomsPanel({
  session,
  profileId,
  onClose
}: {
  session: Session
  profileId: string
  onClose: () => void
}) {
  const { t, isStaff } = useApp()
  const [rooms, setRooms] = useState<BreakoutRoom[]>([])
  const [members, setMembers] = useState<RoomMember[]>([])
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [scenarioId, setScenarioId] = useState('')

  useEffect(() => {
    void reload()
    void supabase.from('scenario_templates').select('*').then(({ data }) => setTemplates((data as ScenarioTemplate[]) ?? []))
    const channel = supabase
      .channel(`breakout-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breakout_room_members' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'breakout_rooms' }, () => void reload())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session.id])

  async function reload() {
    const [r, m] = await Promise.all([
      supabase.from('breakout_rooms').select('*').eq('session_id', session.id).order('created_at'),
      supabase.from('breakout_room_members').select('*')
    ])
    setRooms((r.data as BreakoutRoom[]) ?? [])
    setMembers((m.data as RoomMember[]) ?? [])
  }

  const myMembership = members.find((m) => m.student_id === profileId)
  useEffect(() => {
    if (myMembership) setActiveRoom(myMembership.room_id)
  }, [myMembership?.room_id])

  async function join(room: BreakoutRoom) {
    if (myMembership) {
      await supabase.from('breakout_room_members').delete().eq('room_id', myMembership.room_id).eq('student_id', profileId)
    }
    const { error } = await supabase.from('breakout_room_members').insert({ room_id: room.id, student_id: profileId })
    if (!error) setActiveRoom(room.id)
    else alert(t('roomFullMsg'))
    void reload()
  }

  async function leave() {
    if (!myMembership) return
    await supabase.from('breakout_room_members').delete().eq('room_id', myMembership.room_id).eq('student_id', profileId)
    setActiveRoom(null)
    void reload()
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault()
    const template = templates.find((x) => x.id === scenarioId)
    await supabase.from('breakout_rooms').insert({
      session_id: session.id,
      label: label.trim() || 'Room',
      capacity: 6,
      scenario_prompt: template ? `${template.title}: ${template.prompt}` : null
    })
    setLabel('')
    setScenarioId('')
    setCreateOpen(false)
    void reload()
  }

  const active = rooms.find((r) => r.id === activeRoom)

  return (
    <Modal open onClose={onClose} title={`${t('breakoutRooms')} — ${session.title}`} wide>
      {active ? (
        <div className="flex h-[60vh] flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-bold">{active.label}</p>
            <button onClick={leave} className="btn-secondary !min-h-[40px] px-4 py-1.5 text-sm !text-red-700 dark:!text-red-400">
              {t('leaveRoom')}
            </button>
          </div>
          {active.scenario_prompt && (
            <p className="mb-2 rounded-lg bg-brass-100 px-3 py-2 text-xs font-semibold dark:bg-brass-900/50 dark:text-brass-100">
              🎭 {active.scenario_prompt}
            </p>
          )}
          <TextChatStream
            table="breakout_messages"
            filter={{ column: 'room_id', value: active.id }}
            placeholder={t('saySomething')}
            emptyLabel={t('saySomething')}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{t('pickScenario')}</p>
            <button onClick={() => setCreateOpen(true)} className="btn-secondary !min-h-[40px] px-4 py-1.5 text-sm">
              + {t('createRoom')}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {rooms.map((r) => {
              const count = members.filter((m) => m.room_id === r.id).length
              const full = count >= r.capacity
              return (
                <button
                  key={r.id}
                  disabled={full}
                  onClick={() => void join(r)}
                  className="app-card flex items-center justify-between p-3 text-start transition hover:shadow-lg disabled:opacity-50"
                >
                  <span>
                    <span className="block font-bold">{r.label}</span>
                    {r.scenario_prompt && (
                      <span className="mt-0.5 block line-clamp-1 text-xs opacity-60">🎭 {r.scenario_prompt}</span>
                    )}
                  </span>
                  <span className={`pill ${full ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-petrol-100 text-petrol-800 dark:bg-petrol-800 dark:text-petrol-100'}`}>
                    {t('occupancy', { current: count, capacity: r.capacity })}
                  </span>
                </button>
              )
            })}
          </div>

          <h4 className="mb-2 mt-6 font-bold">🎭 {t('scenarioRooms')}</h4>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setScenarioId(tpl.id)
                  setCreateOpen(true)
                }}
                className="pill bg-mist-200 py-2 text-mist-900 hover:bg-mist-300 dark:bg-mist-800 dark:text-mist-100"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </>
      )}

      {createOpen && (
        <Modal open onClose={() => setCreateOpen(false)} title={t('createRoom')}>
          <form onSubmit={createRoom} className="flex flex-col gap-3">
            <input className="input-base" placeholder={t('roomLabel')} value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} />
            <select className="input-base" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <option value="">—</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title}
                </option>
              ))}
            </select>
            <p className="text-xs opacity-60">{t('capacity')}: 6</p>
            <button type="submit" className="btn-primary">
              {t('createRoom')}
            </button>
          </form>
        </Modal>
      )}
    </Modal>
  )
}
