/* eslint-disable */
// Local demo backend — emulates the subset of supabase-js this app uses,
// backed by localStorage, pre-seeded with test accounts and content.
// DEMO ONLY: data lives in your browser, never sent anywhere. Reset any time
// from the browser console: EW_DEMO_RESET()

import { FALLBACK_BANKS, type GameType } from '../../games/engine'

const DB_KEY = 'ew-demo-db-v1'

interface AuthUser {
  id: string
  email: string
  password: string
  email_confirmed_at: string
}

interface Db {
  version: number
  auth_users: AuthUser[]
  currentUserId: string | null
  tables: Record<string, Record<string, unknown>[]>
}

// ---------- helpers ----------

function uid(prefix: string): string {
  return `${prefix}-${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`
}

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

const DAY = 86_400_000

// ---------- seed ----------

function seed(): Db {
  const admin = 'u-coach'
  const s1 = 'u-omar'
  const s2 = 'u-layla'
  const s3 = 'u-youssef'
  const hwId = 'hw-favorite-place'
  const liveSession = 'sess-conversation'
  const endedSession = 'sess-grammar-past'
  const future1 = 'sess-debate'
  const future2 = 'sess-movie-night'

  return {
    version: 1,
    currentUserId: null,
    auth_users: [
      { id: admin, email: 'coach@demo.test', password: 'Passw0rd!', email_confirmed_at: iso() },
      { id: s1, email: 'omar@demo.test', password: 'Passw0rd!', email_confirmed_at: iso() },
      { id: s2, email: 'layla@demo.test', password: 'Passw0rd!', email_confirmed_at: iso() },
      { id: s3, email: 'youssef@demo.test', password: 'Passw0rd!', email_confirmed_at: iso() }
    ],
    tables: {
      profiles: [
        { id: admin, email: 'coach@demo.test', display_name: 'Sara Hassan', nickname: 'Coach_Sara', avatar: '👩‍🎓', level: 'Advanced', role: 'organizer', points: 1240, streak: 12, streak_freezes: 2, badges: [], learning_goals: 'Help every member speak with confidence', onboarded: true },
        { id: s1, email: 'omar@demo.test', display_name: 'Omar K.', nickname: 'Omar_99', avatar: '🦁', level: 'Beginner', role: 'student', points: 320, streak: 4, streak_freezes: 0, badges: [], learning_goals: 'Improve speaking confidence for work', onboarded: true },
        { id: s2, email: 'layla@demo.test', display_name: 'Layla M.', nickname: 'Layla_Learns', avatar: '🐼', level: 'Intermediate', role: 'student', points: 780, streak: 7, streak_freezes: 1, badges: [], learning_goals: 'Watch films without subtitles', onboarded: true },
        { id: s3, email: 'youssef@demo.test', display_name: 'Youssef A.', nickname: 'YoussefA', avatar: '🚀', level: 'Intermediate', role: 'student', points: 640, streak: 3, streak_freezes: 0, badges: [], learning_goals: 'Pass a job interview in English', onboarded: true }
      ],
      sessions: [
        { id: liveSession, title: 'Conversation Club — Week 2', arabic_title: 'نادي المحادثة — الأسبوع الثاني', description: 'Speaking practice in small groups.', level: 'Intermediate', format: 'Hybrid', location: 'Main Hall', meeting_link: 'https://meet.example.com/conversation-club', starts_at: iso(-30 * 60_000), duration_minutes: 60, ended_at: null },
        { id: future2, title: 'Movie Night: Short Film Session', arabic_title: 'أمسية الفيلم القصير', description: 'We watch and discuss an award-winning short film.', level: 'Intermediate', format: 'Virtual', location: null, meeting_link: 'https://meet.example.com/movie-night', starts_at: iso(2 * DAY), duration_minutes: 60, ended_at: null },
        { id: future1, title: 'Debate Evening', arabic_title: 'أمسية المناظرة', description: 'Structured debates for advanced speakers.', level: 'Advanced', format: 'In-Person', location: 'Room B', meeting_link: null, starts_at: iso(5 * DAY), duration_minutes: 90, ended_at: null },
        { id: endedSession, title: 'Grammar Lab: Present Perfect', arabic_title: 'مختبر القواعد: المضارع التام', description: 'Master present perfect vs past simple.', level: 'Beginner', format: 'Virtual', location: null, meeting_link: 'https://meet.example.com/grammar-lab', starts_at: iso(-3 * DAY), duration_minutes: 45, ended_at: iso(-3 * DAY + 50 * 60_000) }
      ],
      rsvps: [
        { session_id: liveSession, user_id: admin },
        { session_id: liveSession, user_id: s2 },
        { session_id: future2, user_id: s1 },
        { session_id: future1, user_id: s3 }
      ],
      checkins: [
        { id: uid('chk'), session_id: liveSession, user_id: admin, checked_in_at: iso(-20 * 60_000) },
        { id: uid('chk'), session_id: liveSession, user_id: s2, checked_in_at: iso(-15 * 60_000) },
        { id: uid('chk'), session_id: endedSession, user_id: s2, checked_in_at: iso(-3 * DAY) },
        { id: uid('chk'), session_id: endedSession, user_id: s3, checked_in_at: iso(-3 * DAY) }
      ],
      session_ratings: [
        { id: uid('rate'), session_id: endedSession, student_id: s2, rating: 5, note: 'Really clear explanations.' },
        { id: uid('rate'), session_id: endedSession, student_id: s3, rating: 4, note: null }
      ],
      announcements: [
        { id: uid('ann'), title: 'Welcome to the English Workshop!', body: 'Our new bilingual hub is live. Check Sessions for the weekly schedule and introduce yourself in Chat.', category: 'General', pinned: true, author_id: admin },
        { id: uid('ann'), title: 'Movie Night announced 🎬', body: 'We will watch and discuss an award-winning short film. RSVP on the Sessions tab.', category: 'Event', pinned: false, author_id: admin },
        { id: uid('ann'), title: 'Homework 1 published', body: 'Write 150 words about your favorite place. Submit under Homework before June 20, 2026.', category: 'Homework', pinned: false, author_id: admin }
      ],
      homework_assignments: [
        { id: hwId, title: 'My Favorite Place', description: 'Write 150 words describing your favorite place and why you love it.', deadline: 'June 20, 2026', organizer_id: admin, peer_review_open: false }
      ],
      homework_submissions: [
        { id: 'sub-layla', assignment_id: hwId, student_id: s2, content: 'My favorite place is my grandmother\'s garden. Every summer, the air smells of jasmine and fresh mint...', grade: null, feedback: null },
        { id: 'sub-youssef', assignment_id: hwId, student_id: s3, content: 'The place I love most is the old library downtown. It is quiet, full of stories, and the librarians know everyone by name...', grade: null, feedback: null }
      ],
      peer_review_participants: [],
      peer_reviews: [],
      chat_messages: [
        { id: uid('msg'), author_id: s3, body: 'Evening everyone! Anyone joining the debate night?', created_at: iso(-4 * 3600_000) },
        { id: uid('msg'), author_id: s2, body: 'Yes! Also excited for movie night 🎬', created_at: iso(-3 * 3600_000) },
        { id: uid('msg'), author_id: admin, body: 'Great energy this week — remember homework is due June 20.', created_at: iso(-2 * 3600_000) }
      ],
      notifications: [
        { id: uid('ntf'), user_id: admin, title: 'New RSVP', body: 'Layla_Learns RSVPed to Conversation Club — Week 2.', read: false, created_at: iso(-1 * 3600_000) }
      ],
      resources: [
        { id: uid('res'), title: 'Phrasal Verbs Glossary', category: 'Vocabulary', file_type: 'Glossary', file_url: null, size_label: '1.2 MB • 340 downloads', downloads: 340 },
        { id: uid('res'), title: 'Listening Pack: Airport Dialogues', category: 'Listening', file_type: 'Audio', file_url: null, size_label: '18 MB • 120 downloads', downloads: 120 },
        { id: uid('res'), title: 'Tense Summary Notes', category: 'Grammar', file_type: 'Note', file_url: null, size_label: '0.8 MB • 512 downloads', downloads: 512 }
      ],
      scenario_templates: [
        { id: 'scn-airport', title: 'Airport Check-in', arabic_title: 'تسجيل الوصول في المطار', prompt: 'One of you is the check-in agent, the other is a nervous traveler whose flight was delayed.' },
        { id: 'scn-restaurant', title: 'Restaurant Order', arabic_title: 'الطلب في مطعم', prompt: 'Order a meal, ask about ingredients, and handle a wrong dish politely.' },
        { id: 'scn-interview', title: 'Job Interview', arabic_title: 'مقابلة عمل', prompt: 'One of you interviews the other for a dream job. Practice formal register.' }
      ],
      game_rounds: [],
      game_answers: [],
      game_submissions: [],
      game_votes: [],
      breakout_rooms: [],
      breakout_room_members: [],
      breakout_messages: [],
      moderation_reports: []
    }
  }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const db = JSON.parse(raw) as Db
      if (db.version === 1) return db
    }
  } catch {
    /* corrupted store — reseed */
  }
  const fresh = seed()
  save(fresh)
  return fresh
}

function save(db: Db): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

let memoryDb: Db | null = null
function db(): Db {
  if (!memoryDb) memoryDb = load()
  return memoryDb
}

;(window as unknown as Record<string, unknown>).EW_DEMO_RESET = () => {
  localStorage.removeItem(DB_KEY)
  location.reload()
}

// ---------- realtime emulation ----------

type Listener = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void
const tableListeners = new Map<string, Set<Listener>>()

function emit(table: string, eventType: string, newRow: Record<string, unknown>, oldRow: Record<string, unknown> = {}): void {
  const listeners = tableListeners.get(table)
  if (!listeners) return
  for (const l of listeners) l({ eventType, new: newRow, old: oldRow })
}

function matchesFilter(row: Record<string, unknown>, filter?: string): boolean {
  if (!filter) return true
  const m = filter.match(/^(\w+)=eq\.(.+)$/)
  if (!m) return true
  return String(row[m[1]]) === m[2]
}

// ---------- query engine ----------

interface Request {
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  payload?: Record<string, unknown>
  opts?: Record<string, unknown>
}

function singular(table: string): string {
  return table.replace(/ies$/, 'y').replace(/s$/, '')
}

const RELATION_FKS: Record<string, string[]> = {
  profiles: ['author_id', 'user_id', 'student_id', 'player_id', 'reviewer_id', 'reporter_id', 'added_by', 'organizer_id', 'created_by', 'updated_by'],
  homework_submissions: ['reviewee_submission_id'],
  sessions: ['session_id'],
  homework_assignments: ['assignment_id']
}

const UNIQUE_KEYS: Record<string, string[][]> = {
  homework_submissions: [['assignment_id', 'student_id']],
  peer_reviews: [['assignment_id', 'reviewer_id']],
  session_ratings: [['session_id', 'student_id']],
  rsvps: [['session_id', 'user_id']],
  checkins: [['session_id', 'user_id']],
  game_answers: [['round_id', 'player_id', 'question_index']],
  game_votes: [['submission_id', 'voter_id']],
  breakout_room_members: [['room_id', 'student_id']],
  game_submissions: [['round_id', 'player_id']]
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map((x) => x.trim())
}

function resolveEmbed(parentRow: Record<string, unknown>, table: string, colsSpec: string): Record<string, unknown> | null {
  const fks = RELATION_FKS[table] ?? []
  for (const fk of fks) {
    const fkVal = parentRow[fk]
    if (!fkVal) continue
    const target = db().tables[table]?.find((r) => r.id === fkVal)
    if (!target) continue
    return projectRow(target, colsSpec) as Record<string, unknown>
  }
  return null
}

function projectRow(row: Record<string, unknown>, colsSpec: string): Record<string, unknown> {
  const specs = splitTopLevel(colsSpec, ',')
  const out: Record<string, unknown> = {}
  for (const spec of specs) {
    if (spec === '*') {
      Object.assign(out, row)
      continue
    }
    // alias:table!hint(nested) | table(nested) | alias:table(nested)
    const rel = spec.match(/^(?:(\w+):)?(\w+)(?:![^()]*)?\((.*)\)$/)
    if (rel) {
      const [, alias, relTable, inner] = rel
      const embedded = resolveEmbed(row, relTable, inner)
      if (embedded !== null) out[alias ?? relTable] = embedded
      continue
    }
    out[spec] = row[spec]
  }
  return out
}

class Builder implements PromiseLike<{ data: unknown; error: unknown }> {
  private table: string
  private req: Request
  private filters: Array<(row: Record<string, unknown>) => boolean> = []
  private orderCol: string | null = null
  private orderAsc = true
  private limitN: number | null = null
  private wantSingle = false
  private selectCols: string | null = null
  private countOpt: string | null = null
  private headOpt = false

  constructor(table: string, req: Request) {
    this.table = table
    this.req = req
  }

  select(cols = '*', opts?: { count?: string; head?: boolean }): Builder {
    this.selectCols = cols
    this.countOpt = opts?.count ?? null
    this.headOpt = !!opts?.head
    return this
  }

  eq(col: string, val: unknown): Builder {
    this.filters.push((r) => r[col] === val)
    return this
  }

  gte(col: string, val: unknown): Builder {
    this.filters.push((r) => String(r[col]) >= String(val))
    return this
  }

  or(expr: string): Builder {
    const parts = splitTopLevel(expr, ',')
    this.filters.push((row) =>
      parts.some((p) => {
        const m = p.match(/^(\w+)\.ilike\.(.+)$/)
        if (!m) return false
        const needle = m[2].split('%').join('').toLowerCase()
        return String(row[m[1]] ?? '').toLowerCase().includes(needle)
      })
    )
    return this
  }

  order(col: string, opts?: { ascending?: boolean }): Builder {
    this.orderCol = col
    this.orderAsc = opts?.ascending !== false
    return this
  }

  limit(n: number): Builder {
    this.limitN = n
    return this
  }

  single(): Builder {
    this.wantSingle = true
    return this
  }

  insert(payload: Record<string, unknown>): Builder {
    this.req.op = 'insert'
    this.req.payload = payload
    return this
  }

  update(payload: Record<string, unknown>): Builder {
    this.req.op = 'update'
    this.req.payload = payload
    return this
  }

  delete(): Builder {
    this.req.op = 'delete'
    return this
  }

  upsert(payload: Record<string, unknown>, opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Builder {
    this.req.op = 'upsert'
    this.req.payload = payload
    this.req.opts = opts
    return this
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.exec()).then(onfulfilled, onrejected)
  }

  exec(): { data: unknown; error: unknown } {
    const d = db()
    const rows = d.tables[this.table]
    if (this.table.startsWith('view:') || VIRTUAL_TABLES[this.table]) {
      return this.execVirtual()
    }
    if (!rows) return { data: null, error: { message: `unknown table ${this.table}` } }

    switch (this.req.op) {
      case 'select':
        return this.execSelect(rows)
      case 'insert':
        return this.execInsert(rows)
      case 'upsert':
        return this.execUpsert(rows)
      case 'update': {
        const updated: Record<string, unknown>[] = []
        rows.forEach((r) => {
          if (this.filters.every((f) => f(r))) {
            Object.assign(r, this.req.payload)
            updated.push({ ...r })
          }
        })
        save(d)
        updated.forEach((u) => emit(this.table, 'UPDATE', u))
        return { data: this.headOpt ? null : updated, error: null }
      }
      case 'delete': {
        const kept: Record<string, unknown>[] = []
        const removed: Record<string, unknown>[] = []
        rows.forEach((r) => (this.filters.every((f) => f(r)) ? removed.push(r) : kept.push(r)))
        d.tables[this.table] = kept
        save(d)
        removed.forEach((rm) => emit(this.table, 'DELETE', {}, rm))
        return { data: null, error: null }
      }
    }
    return { data: null, error: null }
  }

  private execSelect(rows: Record<string, unknown>[]): { data: unknown; error: unknown } {
    let matched = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.countOpt === 'exact') {
      return { data: this.headOpt ? null : [], error: null, count: matched.length } as unknown as { data: unknown; error: unknown }
    }
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = a[this.orderCol!] as number
        const bv = b[this.orderCol!] as number
        return this.orderAsc ? av - bv : bv - av
      })
    }
    let data: unknown = matched.map((r) => projectRow(r, this.selectCols ?? '*'))
    if (typeof this.limitN === 'number') {
      const limited = (data as Record<string, unknown>[]).slice(0, this.limitN)
      data = limited
      matched = matched.slice(0, this.limitN)
    }
    if (this.wantSingle) {
      const arr = data as Record<string, unknown>[]
      return { data: arr[0] ?? null, error: arr.length === 0 ? null : null }
    }
    return { data, error: null }
  }

  private execInsert(rows: Record<string, unknown>[]): { data: unknown; error: unknown } {
    const d = db()
    const payload = this.req.payload as Record<string, unknown>
    const uniques = UNIQUE_KEYS[this.table] ?? []
    for (const combo of uniques) {
      const exists = rows.some((r) => combo.every((k) => r[k] === payload[k]))
      if (exists) return { data: null, error: { message: 'duplicate key value violates unique constraint' } }
    }
    if (this.table === 'breakout_room_members') {
      const room = d.tables.breakout_rooms.find((r) => r.id === payload.room_id)
      const count = rows.filter((r) => r.room_id === payload.room_id).length
      if (room && count >= (room.capacity as number)) {
        return { data: null, error: { message: 'ROOM_FULL' } }
      }
    }
    if (this.table === 'game_votes') {
      const submission = d.tables.game_submissions.find((r) => r.id === payload.submission_id)
      if (submission && submission.player_id === payload.voter_id) {
        return { data: null, error: { message: 'SELF_VOTE_BLOCKED' } }
      }
    }
    const row = { id: uid('row'), ...payload }
    rows.push(row)
    save(d)
    emit(this.table, 'INSERT', row)
    const result = { data: row, error: null }
    if (this.selectCols && this.wantSingle) return result
    return result
  }

  private execUpsert(rows: Record<string, unknown>[]): { data: unknown; error: unknown } {
    const payload = this.req.payload as Record<string, unknown>
    const existing = rows.find(
      (r) => Object.entries(payload).every(([k, v]) => !(k in r)) || this.matchesConflictKey(r, payload)
    )
    if (existing && this.matchesConflictKey(existing, payload)) {
      if ((this.req.opts as { ignoreDuplicates?: boolean } | undefined)?.ignoreDuplicates) {
        return { data: existing, error: null }
      }
      Object.assign(existing, payload)
      save(db())
      emit(this.table, 'UPDATE', existing)
      return { data: existing, error: null }
    }
    this.req.op = 'insert'
    return this.execInsert(rows)
  }

  private matchesConflictKey(row: Record<string, unknown>, payload: Record<string, unknown>): boolean {
    const uniques = UNIQUE_KEYS[this.table] ?? []
    return uniques.some((combo) => comboKeysPresent(combo, payload) && combo.every((k) => row[k] === payload[k]))
  }

  private execVirtual(): { data: unknown; error: unknown } {
    const d = db()
    const t = this.table
    if (t === 'session_rating_aggregates') {
      const bySession = new Map<string, Record<string, unknown>[]>()
      for (const r of d.tables.session_ratings) {
        const list = bySession.get(r.session_id as string) ?? []
        list.push(r)
        bySession.set(r.session_id as string, list)
      }
      const all = [...bySession.entries()].map(([sessionId, rs]) => ({
        session_id: sessionId,
        average_rating: Math.round((rs.reduce((a, r) => a + Number(r.rating), 0) / rs.length) * 100) / 100,
        response_count: rs.length,
        notes: rs.map((r) => r.note).filter(Boolean).sort(() => Math.random() - 0.5)
      }))
      return this.finishVirtual(all)
    }
    if (t === 'admin_overview_stats') {
      const today = new Date().toISOString().slice(0, 10)
      return this.finishVirtual([
        {
          total_students: d.tables.profiles.filter((p) => p.role === 'student').length,
          active_today: new Set(d.tables.checkins.filter((c) => String(c.checked_in_at).slice(0, 10) === today).map((c) => c.user_id)).size,
          upcoming_sessions: d.tables.sessions.filter((s) => !s.ended_at && String(s.starts_at) >= iso()).length,
          reported_items: d.tables.moderation_reports.filter((r) => r.status === 'open').length,
          refreshed_at: iso()
        }
      ])
    }
    if (t === 'admin_student_progress') {
      return this.finishVirtual(
        d.tables.profiles
          .filter((p) => p.role === 'student')
          .map((p) => ({
            student_id: p.id,
            nickname: p.nickname,
            avatar: p.avatar,
            level: p.level,
            points: p.points,
            streak: p.streak,
            total_checkins: d.tables.checkins.filter((c) => c.user_id === p.id).length,
            homework_submitted: d.tables.homework_submissions.filter((h) => h.student_id === p.id).length,
            game_correct: d.tables.game_answers.filter((g) => g.player_id === p.id && g.correct === true).length
          }))
      )
    }
    if (t === 'admin_session_report') {
      return this.finishVirtual(
        d.tables.sessions.map((s) => ({
          session_id: s.id,
          title: s.title,
          starts_at: s.starts_at,
          ended_at: s.ended_at,
          attendance: d.tables.checkins.filter((c) => c.session_id === s.id).length,
          rsvps: d.tables.rsvps.filter((r) => r.session_id === s.id).length,
          avg_rating: (() => {
            const rs = d.tables.session_ratings.filter((x) => x.session_id === s.id)
            return rs.length ? Math.round((rs.reduce((a, r) => a + Number(r.rating), 0) / rs.length) * 100) / 100 : null
          })(),
          rating_responses: d.tables.session_ratings.filter((x) => x.session_id === s.id).length
        }))
      )
    }
    if (t === 'peer_reviews_for_author') {
      const all = d.tables.peer_reviews.map((pr) => {
        const sub = d.tables.homework_submissions.find((h) => h.id === pr.reviewee_submission_id)
        return { assignment_id: pr.assignment_id, author_id: sub?.student_id ?? null, rating: pr.rating, comment: pr.comment }
      })
      return this.finishVirtual(all)
    }
    if (t === 'ai_settings_status') {
      return { data: null, error: null } // demo mode: never configured
    }
    return { data: null, error: null }
  }

  private finishVirtual(all: Record<string, unknown>[]): { data: unknown; error: unknown } {
    let matched = all.filter((r) => this.filters.every((f) => f(r)))
    if (this.orderCol) {
      matched = [...matched].sort((a, b) =>
        this.orderAsc ? String(a[this.orderCol!]).localeCompare(String(b[this.orderCol!])) : String(b[this.orderCol!]).localeCompare(String(a[this.orderCol!]))
      )
    }
    if (typeof this.limitN === 'number') matched = matched.slice(0, this.limitN)
    if (this.wantSingle) return { data: matched[0] ?? null, error: null }
    return { data: matched, error: null }
  }
}

function comboKeysPresent(combo: string[], payload: Record<string, unknown>): boolean {
  return combo.every((k) => payload[k] !== undefined)
}

const VIRTUAL_TABLES: Record<string, boolean> = {
  session_rating_aggregates: true,
  admin_overview_stats: true,
  admin_student_progress: true,
  admin_session_report: true,
  peer_reviews_for_author: true,
  ai_settings_status: true
}

// ---------- rpc implementations ----------

function rpc(name: string, params: Record<string, unknown>): { data: unknown; error: unknown } {
  const d = db()
  const me = d.currentUserId

  if (name === 'record_checkin') {
    const sessionId = params.p_session_id as string
    const session = d.tables.sessions.find((s) => s.id === sessionId)
    if (!session) return err('SESSION_ENDED')
    if (session.ended_at) return err('SESSION_ENDED')
    const exists = d.tables.checkins.some((c) => c.session_id === sessionId && c.user_id === me)
    if (!exists) {
      const row = { id: uid('chk'), session_id: sessionId, user_id: me, checked_in_at: iso() }
      d.tables.checkins.push(row)
      const prof = d.tables.profiles.find((p) => p.id === me)
      if (prof) prof.points = Number(prof.points) + 20
      d.tables.notifications.unshift({
        id: uid('ntf'),
        user_id: me,
        title: 'Attendance verified',
        body: 'You earned +20 points for checking in.',
        read: false,
        created_at: iso()
      })
      save(d)
      emit('checkins', 'INSERT', row)
    }
    return ok(null)
  }

  if (name === 'staff_check_in') {
    const row = { id: uid('chk'), session_id: params.p_session_id, user_id: params.p_user_id, checked_in_at: iso() }
    const exists = d.tables.checkins.some((c) => c.session_id === row.session_id && c.user_id === row.user_id)
    if (!exists) {
      d.tables.checkins.push(row)
      save(d)
      emit('checkins', 'INSERT', row)
    }
    return ok(null)
  }

  if (name === 'grant_streak_freeze') {
    const prof = d.tables.profiles.find((p) => p.id === me)
    if (!prof || Number(prof.points) < 25) return ok(false)
    prof.points = Number(prof.points) - 25
    prof.streak_freezes = Number(prof.streak_freezes) + 1
    save(d)
    emit('profiles', 'UPDATE', prof as unknown as Record<string, unknown>)
    return ok(true)
  }

  if (name === 'award_game_points') {
    if (params.p_reason === 'correct_answer') {
      const prof = d.tables.profiles.find((p) => p.id === me)
      if (prof) {
        prof.points = Number(prof.points) + 100
        save(d)
        emit('profiles', 'UPDATE', prof as unknown as Record<string, unknown>)
      }
    }
    return ok(null)
  }

  if (name === 'open_peer_review') {
    const hw = d.tables.homework_assignments.find((a) => a.id === params.p_assignment_id)
    if (!hw) return err('REVIEW_NOT_OPEN')
    const subs = d.tables.homework_submissions.filter((s) => s.assignment_id === hw.id)
    if (subs.length < 2) return err('NOT_ENOUGH_SUBMISSIONS')
    for (const s of subs) {
      const exists = d.tables.peer_review_participants.some(
        (p) => p.assignment_id === hw.id && p.student_id === s.student_id
      )
      if (!exists) d.tables.peer_review_participants.push({ assignment_id: hw.id, student_id: s.student_id, frozen_at: iso() })
    }
    hw.peer_review_open = true
    save(d)
    emit('homework_assignments', 'UPDATE', hw as unknown as Record<string, unknown>)
    return ok(null)
  }

  if (name === 'submit_peer_review') {
    const assignmentId = params.p_assignment_id as string
    const hw = d.tables.homework_assignments.find((a) => a.id === assignmentId)
    if (!hw || !hw.peer_review_open) return err('REVIEW_NOT_OPEN')
    const ordered = d.tables.peer_review_participants
      .filter((p) => p.assignment_id === assignmentId)
      .sort((a, b) => String(a.frozen_at).localeCompare(String(b.frozen_at)))
      .map((p) => p.student_id as string)
    if (ordered.length < 2) return err('NOT_ENOUGH_SUBMISSIONS')
    const idx = ordered.indexOf(me!)
    if (idx === -1) return err('NOT_PARTICIPANT')
    const target = ordered[(idx % ordered.length) + 1] ?? ordered[0]
    if (idx === ordered.length - 1) return submitForTarget(d, assignmentId, me!, ordered[0], params)
    return submitForTarget(d, assignmentId, me!, target, params)
  }

  if (name === 'refresh_admin_stats_rpc') {
    return ok(null)
  }

  return err(`unknown rpc ${name}`)
}

function submitForTarget(
  d: Db,
  assignmentId: string,
  reviewerId: string,
  targetStudentId: string,
  params: Record<string, unknown>
): { data: unknown; error: unknown } {
  const targetSub = d.tables.homework_submissions.find(
    (s) => s.assignment_id === assignmentId && s.student_id === targetStudentId
  )
  if (!targetSub) return err('NOT_PARTICIPANT')
  if (d.tables.peer_reviews.some((r) => r.assignment_id === assignmentId && r.reviewer_id === reviewerId)) {
    return err('ALREADY_REVIEWED')
  }
  const row = {
    id: uid('rev'),
    assignment_id: assignmentId,
    reviewer_id: reviewerId,
    reviewee_submission_id: targetSub.id,
    rating: params.p_rating,
    comment: params.p_comment ?? null,
    created_at: iso()
  }
  d.tables.peer_reviews.push(row)
  save(d)
  emit('peer_reviews', 'INSERT', row)
  return ok(null)
}

function ok(data: unknown): { data: unknown; error: unknown } {
  return { data, error: null }
}

function err(message: string): { data: unknown; error: unknown } {
  return { data: null, error: { message } }
}

// ---------- edge function emulation ----------

const DEMO_QUIZ = [
  { prompt: 'Choose: "I ___ never been to London."', hint_ar: 'المضارع التام', options: ['have', 'has', 'am'], answer_index: 0 },
  { prompt: 'What does "look forward to" mean?', hint_ar: '', options: ['Anticipate happily', 'Search ahead', 'Look up'], answer_index: 0 },
  { prompt: 'Correct preposition: "married ___ a doctor"', hint_ar: '', options: ['to', 'with', 'for'], answer_index: 0 },
  { prompt: 'Plural of "child"?', hint_ar: '', options: ['children', 'childs', 'childes'], answer_index: 0 },
  { prompt: '"If I ___ rich, I would travel."', hint_ar: 'الشرط الثاني', options: ['were', 'am', 'be'], answer_index: 0 }
]

async function invokeFunction(name: string, body: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
  await new Promise((r) => setTimeout(r, 600))
  if (name === 'groq-generate') {
    if (body.mode === 'weekly-quiz') {
      return { data: { title: '🤖 AI Weekly Quiz Ready for Review', questions: DEMO_QUIZ }, error: null }
    }
    if (body.mode === 'game-questions') {
      const gameType = (body.game_type as GameType | undefined) ?? 'hot-seat'
      const bank = FALLBACK_BANKS[gameType] ?? FALLBACK_BANKS['hot-seat']
      return { data: { questions: bank.slice(0, 5) }, error: null }
    }
    if (body.mode === 'essay-feedback') {
      const len = String(body.text ?? '').split(/\s+/).filter(Boolean).length
      return {
        data: {
          feedback: `[Demo feedback] Your ${len}-word piece stays on topic and uses good concrete detail — strengths worth keeping. To improve: vary sentence openings and add one linking phrase between ideas (e.g. "What is more…").`
        },
        error: null
      }
    }
    return { data: null, error: { message: 'unknown_mode' } }
  }
  if (name === 'gemini-movie-session') {
    // Honest failure path: the demo environment has no Gemini/YouTube servers.
    return { data: { ok: false, error_code: 'NO_API_KEY' }, error: null }
  }
  if (name === 'update-ai-key') {
    // No Vault in demo mode — report honestly.
    return { data: { ok: false, reason: 'validation_failed' }, error: null }
  }
  return { data: null, error: { message: 'unknown_function' } }
}

// ---------- public client ----------

function makeBuilder(table: string, req: Request): Builder {
  return new Builder(table, req)
}

export const demoClient = {
  from(table: string) {
    return makeBuilder(table, { op: 'select' })
  },
  rpc(name: string, params: Record<string, unknown> = {}) {
    return Promise.resolve(rpc(name, params))
  },
  functions: {
    invoke(name: string, opts?: { body?: Record<string, unknown> }) {
      return invokeFunction(name, opts?.body ?? {})
    }
  },
  channel(name: string) {
    const subs: Array<{ table: string; filter?: string; cb: Listener }> = []
    return {
      on(_cfg: unknown, opts: { event: string; schema?: string; table: string; filter?: string }, cb: Listener) {
        subs.push({ table: opts.table, filter: opts.filter, cb })
        return this
      },
      subscribe() {
        for (const s of subs) {
          let listeners = tableListeners.get(s.table)
          if (!listeners) {
            listeners = new Set()
            tableListeners.set(s.table, listeners)
          }
          listeners.add((payload) => {
            if (matchesFilter(payload.new, s.filter) || matchesFilter(payload.old, s.filter)) s.cb(payload)
          })
        }
        return { topic: name }
      }
    }
  },
  removeChannel(): Promise<void> {
    tableListeners.clear()
    return Promise.resolve()
  },
  auth: {
    async getSession() {
      const d = db()
      const user = d.auth_users.find((u) => u.id === d.currentUserId)
      return { data: { session: user ? { user: pubUser(user) } : null }, error: null }
    },
    async getUser() {
      const d = db()
      const user = d.auth_users.find((u) => u.id === d.currentUserId)
      return { data: { user: user ? pubUser(user) : null }, error: null }
    },
    onAuthStateChange(cb: (evt: string, session: unknown) => void) {
      window.addEventListener('ew-demo-auth', ((e: Event) => {
        const detail = (e as CustomEvent).detail
        cb(detail.event, detail.session)
      }) as EventListener)
      return {
        data: {
          subscription: {
            unsubscribe() {
              /* no-op in demo */
            }
          }
        }
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const d = db()
      const user = d.auth_users.find((u) => u.email.toLowerCase() === email.toLowerCase())
      if (!user || user.password !== password) return { error: { message: 'Invalid login credentials' } }
      d.currentUserId = user.id
      save(d)
      announce(user)
      return { error: null }
    },
    async signUp({ email, password }: { email: string; password: string }) {
      const d = db()
      if (d.auth_users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return { error: { message: 'User already registered' } }
      }
      const id = uid('u')
      d.auth_users.push({ id, email, password, email_confirmed_at: iso() })
      const nickname = email.split('@')[0]
      d.tables.profiles.push({
        id,
        email,
        display_name: nickname,
        nickname,
        avatar: '👨‍🎓',
        level: 'Beginner',
        role: 'student',
        points: 0,
        streak: 0,
        streak_freezes: 0,
        badges: [],
        learning_goals: null,
        onboarded: false
      })
      d.currentUserId = id
      save(d)
      announce(d.auth_users[d.auth_users.length - 1])
      return { error: null }
    },
    async resetPasswordForEmail() {
      return { error: null } // demo: no email server; sign in with seeded passwords
    },
    async signOut() {
      const d = db()
      d.currentUserId = null
      save(d)
      announce(null)
      return { error: null }
    }
  }
}

function pubUser(u: AuthUser) {
  return { id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at }
}

function announce(user: AuthUser | null) {
  window.dispatchEvent(
    new CustomEvent('ew-demo-auth', {
      detail: { event: user ? 'SIGNED_IN' : 'SIGNED_OUT', session: user ? { user: pubUser(user) } : null }
    })
  )
}
