# F6 — Admin Analytics Dashboard (PRD §17.6)

**Objective:** Overview cards (total students, active today, upcoming sessions, reported items), per-student progress (attendance %, points, streak, homework status), per-session report (attendance, scores, ratings — print/PDF deferred).

**Build this last** (per `00-INDEX.md` execution order) — it's a read/aggregation layer over data that F1 (reviews), F3 (reports), F4 (ratings), F5 (game scores) produce. Building it before those exist means validating against fabricated data shapes that won't match reality once the real features land.

## ⚠️ Scalability — don't compute live on every page load

A dashboard hit repeatedly by staff during a live session is the worst-case load pattern — exactly when the underlying tables (check-ins, chat, game answers) are also being written to most heavily. Naive `select count(*) ... group by ...` across full history on every request degrades as the platform accumulates history over multiple cohorts and years.

**Recommendation:** a materialized view (`admin_overview_stats`), refreshed on a schedule (Supabase `pg_cron`, e.g. every 5 minutes) rather than computed live per request. Show a "last updated Xm ago" indicator in the UI — set expectations explicitly rather than silently serving stale data as if it were real-time.

## Open decisions to flag

- **Attendance-% period.** All-time vs. current term/cohort isn't specified. Default to all-time with a date-range filter, since staff will plausibly want both.
- **Per-session game scores require a `session_id` link on game rounds that may not currently exist.** §5's nav puts "Live Games" and "Sessions" as *separate* tabs, and nothing in §1–16 explicitly ties a game round to a specific session. **Verify this join is actually possible before building the per-session score report** — if game participation isn't currently associated with a `session_id`, this requirement needs a schema addition (a nullable FK on the game-round table) flagged to the human, not a guessed join that silently produces wrong or empty results.

## Print/PDF

Explicitly deferred per PRD ("later"). Do not build export now — structure the report view with clean, semantic, `@media print`-friendly markup so PDF/print becomes a cheap follow-up rather than a rewrite, without spending implementation time on an actual export path today.

## Acceptance criteria

See `qa/acceptance-criteria.md#f6`.
