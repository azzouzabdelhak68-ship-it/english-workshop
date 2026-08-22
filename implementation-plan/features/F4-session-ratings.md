# F4 — Session Ratings & Feedback (PRD §17.4)

**Objective:** After a session ends, 1–5 stars + optional anonymous note, one per student per session. Organizer sees anonymous aggregate (average + anonymized notes list); students see only their own submission; no public average.

## 🛑 Blocker precondition — "session ended" does not currently exist as a durable concept

§7 mentions a `Live / Grace Open` status, but that's scoped to the Host Session Control Panel's live check-in window display — not a durable flag that reliably reflects reality afterward (a session could be left "Live" and never explicitly closed). **This feature cannot ship correctly without deciding how "ended" is determined — this is a genuine PRD gap, not an inference error.**

Recommended fix, to be confirmed with the human before building:
- Add `ended_at timestamptz null` to `sessions`.
- Set it either by an explicit staff "End Session" action (doesn't currently exist — would need adding to the Host Session Control Panel), or by a scheduled job comparing `now()` to `session_date + duration_minutes`.
- **Build this once here; F3 (breakout room cleanup) reuses the same flag rather than inventing a second "is this session over" signal.**

## Data model

```sql
create table session_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
alter table session_ratings enable row level security;
```

The `unique (session_id, student_id)` constraint enforces "one per session" **at the database level**, not just a disabled button in the UI — client-only enforcement is trivially bypassed by a second tab or a replayed request.

## RLS

- INSERT: `student_id = auth.uid()`.
- SELECT, student: own row only.
- SELECT, staff: **through an aggregate view, not the raw table** — a staff UI that queries the raw table risks accidentally rendering rows in insertion order, which can be cross-referenced against check-in timestamps to infer who gave which rating (the same small-N anonymity problem as **F1** — see that file's warning, same root cause).

```sql
create view session_rating_aggregates as
select
  session_id,
  avg(rating) as average_rating,
  count(*) as response_count,
  array_agg(note order by random()) filter (where note is not null) as notes
from session_ratings
group by session_id;
```

The `order by random()` on the notes array is deliberate — it breaks the insertion-order-to-identity correlation before the data ever reaches a staff screen. Small detail, real leak if skipped.

## Frontend

Rating prompt appears when `session.ended_at is not null` and no existing rating exists for `(session, current user)`. **[OPEN DECISION]** — PRD doesn't specify the trigger UI. Recommend a **non-blocking, dismissible card** (e.g. surfaced at the top of the Sessions view after a session the student attended has ended) rather than a modal that gates navigation — forcing a rating before letting someone leave the page is poor UX for a free community product and risks skewing ratings toward whoever is most annoyed into a quick response.

## Acceptance criteria

See `qa/acceptance-criteria.md#f4`.
