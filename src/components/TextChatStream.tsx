import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { ReportButton } from './ReportButton'
import type { ChatMessage } from '../lib/types'

interface StreamMessage {
  id: string
  author_id: string
  body: string
  created_at: string
  author_nickname: string | null
  author_avatar: string | null
  author_role: string | null
}

const SELECT_WITH_AUTHOR = 'id,author_id,body,created_at,author:profiles(nickname,avatar,role)'

function mapRow(row: Record<string, unknown>): StreamMessage {
  const author = row.author as { nickname?: string; avatar?: string; role?: string } | null
  return {
    id: row.id as string,
    author_id: row.author_id as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author_nickname: author?.nickname ?? null,
    author_avatar: author?.avatar ?? null,
    author_role: author?.role ?? null
  }
}

/**
 * Shared text chat stream (F3): used by main community chat and breakout rooms
 * via one component and one shared Report control — never two implementations.
 */
export function TextChatStream({
  table,
  filter,
  placeholder,
  emptyLabel
}: {
  table: 'chat_messages' | 'breakout_messages'
  filter?: { column: string; value: string }
  placeholder: string
  emptyLabel?: ReactNode
}) {
  const { authSession } = useApp()
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let query = supabase.from(table).select(SELECT_WITH_AUTHOR).order('created_at', { ascending: true })
    if (filter) query = query.eq(filter.column, filter.value)

    void query.then(({ data }) => {
      if (data) setMessages((data as Record<string, unknown>[]).map(mapRow))
    })

    const channelFilter = filter ? `${filter.column}=eq.${filter.value}` : undefined
    const channel = supabase
      .channel(`${table}-${filter?.value ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: channelFilter }, (payload) => {
        void loadOne(payload.new.id as string)
      })
      .subscribe()

    async function loadOne(id: string) {
      let q = supabase.from(table).select(SELECT_WITH_AUTHOR).eq('id', id)
      if (filter) q = q.eq(filter.column, filter.value)
      const { data } = await q.single()
      if (!data) return
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, mapRow(data)]))
    }

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, filter?.column, filter?.value])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !authSession) return
    setDraft('')
    const insert: Record<string, unknown> = { author_id: authSession.user.id, body }
    if (filter) insert[filter.column] = filter.value
    await supabase.from(table).insert(insert)
  }

  const reportSource = table === 'chat_messages' ? 'chat' : 'breakout'
  const me = authSession?.user.id

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && <div className="py-8 text-center text-sm opacity-60">{emptyLabel}</div>}
        {messages.map((m) => {
          const own = m.author_id === me
          const staffMsg = m.author_role === 'host' || m.author_role === 'organizer' || m.author_role === 'admin'
          return (
            <div key={m.id} className={`flex gap-2 ${own ? 'flex-row-reverse' : ''}`}>
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol-100 text-base dark:bg-petrol-800">
                {m.author_avatar ?? '👤'}
              </span>
              <div className={`max-w-[75%] ${own ? 'text-end' : ''}`}>
                <div className={`mb-0.5 flex items-center gap-2 text-xs opacity-70 ${own ? 'justify-end' : ''}`}>
                  <span className="font-bold">{m.author_nickname ?? 'Member'}</span>
                  {staffMsg && <span className="pill bg-petrol-600 !text-[10px] text-white">🛡 Organizer</span>}
                  <time>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <div
                  className={`inline-block rounded-xl px-3 py-2 text-start text-sm shadow-sm ${
                    staffMsg
                      ? 'bg-petrol-600 text-white dark:bg-petrol-500'
                      : own
                        ? 'bg-brass-500 !text-white'
                        : 'bg-mist-100 dark:bg-mist-800'
                  }`}
                >
                  {m.body}
                </div>
                {canShowReport(own) && (
                  <div className="mt-0.5 text-end">
                    <ReportButton messageSource={reportSource} messageId={m.id} compact />
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          className="input-base"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          aria-label={placeholder}
        />
        <button type="submit" disabled={!draft.trim()} className="btn-primary px-5 disabled:opacity-50" aria-label="send">
          ➤
        </button>
      </form>
    </div>
  )
}

function canShowReport(own: boolean): boolean {
  return !own
}
