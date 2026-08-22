# F3 — Breakout Rooms (PRD §17.3)

**Objective:** Inside a live session, opt-in rooms of 4–6 for conversation practice. Self-select/join/leave, room list + occupancy count, no host assignment required. Text-only. Every room message has a Report button → moderation queue. No mandatory staff presence.

## Data model

```sql
create table breakout_rooms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  label text not null,
  capacity smallint not null default 6,
  created_at timestamptz not null default now()
);

create table breakout_room_members (
  room_id uuid not null references breakout_rooms(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, student_id)
);

create table breakout_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references breakout_rooms(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table breakout_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references breakout_messages(id) on delete cascade,
  reporter_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewed','dismissed'))
);
```

Enable RLS on all four in the same migration.

## ⚠️ Concurrency — the actual hard part of this feature

Capacity enforcement under simultaneous joins is a classic **time-of-check-to-time-of-use (TOCTOU)** race: two students clicking "Join" on a 5/6-full room in the same instant, each doing a naive "count then insert if under capacity," can both read 5/6, both insert, and the room ends up at 7.

**Fix:** enforce capacity with a `before insert` trigger on `breakout_room_members`:

```sql
create or replace function check_room_capacity() returns trigger as $$
begin
  if (select count(*) from breakout_room_members where room_id = new.room_id) >= 
     (select capacity from breakout_rooms where id = new.room_id) then
    raise exception 'Room is full';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_room_capacity
  before insert on breakout_room_members
  for each row execute function check_room_capacity();
```

Triggers execute inside the same transaction as the INSERT, so Postgres serializes this correctly without needing explicit row locking or a separate RPC — simplest correct option, prefer it over a client-side check-then-insert.

## Realtime

Subscribe to `breakout_room_members` INSERT/DELETE per session (occupancy) and `breakout_messages` INSERT per joined room, reusing the existing Supabase Realtime pattern from §12 chat. Leaving a room deletes the membership row; on "Leave" click or session end. Cleanup on session end can reuse the `ended_at` mechanism introduced in **F4** — don't invent a second "session is over" signal here.

## RLS

- `breakout_room_members` SELECT: open to any authenticated user (occupancy counts need to be publicly browsable before joining, per PRD — "room list + occupancy count" — this exposes only `student_id`/nickname via join, which is already visible elsewhere in the app, e.g. leaderboards).
- `breakout_messages` SELECT/INSERT: only current room members — `exists (select 1 from breakout_room_members where room_id = breakout_messages.room_id and student_id = auth.uid())`.
- `breakout_reports` INSERT: any authenticated user, for a message they can currently see (same room-membership check). SELECT: staff only (`isStaffRole`) for the moderation queue — do not restrict to `reporter_id = auth.uid()`, staff need the full queue.

## ⚠️ Flag to human: Report button ambiguity

PRD §17.3 says the Report button is "same as main chat." As written, §12 (Community Chat, already implemented) does **not** describe a report button at all. This is a real discrepancy, not something to silently resolve: either the main chat is *also* getting a report button that isn't documented in §12, or §17.3 is forward-referencing something that doesn't exist yet either. **Do not build two independently-designed Report UIs.** Recommend: build one shared Report control now, and note in the PR that it may also need retrofitting onto §12 main chat — ask the human to confirm scope rather than guessing.

## Frontend

Room list with occupancy pills (`3/6`), Join/Leave, per-room text stream. **Extract a shared `<TextChatStream>` component** (channel id, `canReport: boolean`) used by both §12 main chat and breakout rooms, rather than copy-pasting the chat UI. A copy-paste here creates two implementations that will diverge on the very next chat feature (reactions, edits, etc.) — exactly the kind of duplication the project's "preserve architecture, minimize technical debt" preference calls out.

**Roleplay Scenario Rooms (PRD §17.5)** are really a specialization of this feature (small group + a scenario prompt), not a `GameEngine` strategy — see `F5-more-game-types.md` for the cross-reference; don't build two separate small-group-room subsystems.
