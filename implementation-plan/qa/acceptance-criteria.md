# Acceptance Criteria — Definition of Done

Self-verify each feature against its section here before updating the status table in `00-INDEX.md`. Every feature also inherits the global checks in `01-shared-conventions.md` (RLS-first, i18n both languages, design-system gate) and `02-design-system-checklist.md` — not repeated per row below.

## F1 — Peer Review

- [ ] Two-user RLS test: authenticated as student B, confirm student A's reviewer identity is unreachable through every endpoint that touches `peer_reviews`, not just the obvious one.
- [ ] Attempting a second review for the same `(assignment_id, reviewer_id)` returns a constraint violation, not a silent overwrite.
- [ ] N=1 submission shows a graceful "not enough submissions" state, no crash, no self-assigned review.
- [ ] Late submitter after `peer_review_open` flips true is correctly excluded from that cycle, with UI copy explaining why.
- [ ] Staff view shows both reviewer and author real names.
- [ ] Assignment mapping is computed server-side (RPC), never sent to a student's client in raw form.

## F2 — Calendar Export

- [ ] `.ics` file opens correctly in at least two calendar apps (e.g. Google Calendar import + Apple Calendar) with correct local time after import.
- [ ] Google Calendar link pre-fills title/time/location correctly.
- [ ] Virtual session uses `meetingLink`; in-person uses `location` verbatim.
- [ ] Confirmed (not assumed) whether `sessions` stores `timestamptz` and has a duration field — documented in the PR if a placeholder duration was used.

## F3 — Breakout Rooms

- [ ] Concurrency test: simulate two simultaneous joins at capacity−1; confirm exactly one succeeds, the other gets a clear "room full" error, never over-capacity.
- [ ] Non-member cannot read or post to a room's messages (RLS test).
- [ ] Report button is confirmed as either shared-with-main-chat or genuinely new — not built twice independently (see flag in `F3-breakout-rooms.md`).
- [ ] Occupancy counts update in realtime for users not currently in the room.
- [ ] Rooms/messages are cleaned up or clearly archived on session end.

## F4 — Session Ratings

- [ ] "Session ended" determination method is confirmed with a human decision, not silently assumed.
- [ ] Duplicate rating attempt for the same `(session_id, student_id)` is blocked at the DB level (test by direct request, not just UI).
- [ ] Staff aggregate view shows average + note list with no way to infer submission order from the returned array ordering.
- [ ] Student sees only their own submission, never another student's or the raw average.

## F5 — More Game Types

- [ ] Confirmed the real `GameEngine`/`HotSeatStrategy` interface was read before implementation (not guessed).
- [ ] At least one non-select-one `renderMode` (vote or free-text) renders correctly, proving the shell refactor actually generalizes and wasn't quietly special-cased for Hot Seat.
- [ ] Self-voting is blocked at the query level for the vote mechanic, verified by direct request, not just hidden in UI.
- [ ] Every new type has a working offline/failure fallback bank, matching the existing Hot Seat resilience pattern.
- [ ] Round config (type/difficulty/rounds/timer) persists on the round record — verified by a host refresh mid-round not breaking late joiners.

## F6 — Admin Analytics

- [ ] Confirmed whether game rounds can actually be joined to a `session_id` before shipping the per-session score report — if not possible, this is flagged, not silently worked around.
- [ ] Dashboard shows a "last updated" indicator if backed by a materialized/cached view.
- [ ] Verified query performance against a realistic data volume, not just an empty/seed dataset.

## F7 — AI Chat Room

- [ ] Edge Function rejects a non-staff JWT independently of any client-side gating (test by calling the function directly with a student token).
- [ ] `vault.decrypted_secrets` confirmed unreachable via PostgREST by any client-callable role (explicit negative test, not an assumption).
- [ ] Grep test: raw Gemini/YouTube/OMDb key values never appear in any Edge Function response body, log line, or client console across a full success + a full failure path.
- [ ] Every PRD Failure State (missing key, Gemini timeout/rate-limit, no candidate passes hard gates, malformed JSON, unavailable enrichment data, conflicting sources) triggers its exact specified user-facing message — tested individually, not just the happy path.
- [ ] Output JSON validated against the PRD's exact schema (exactly 4 activities, no invented fields) on every generation, with malformed responses discarded rather than partially rendered.
- [ ] Key rotation flow validates the new key *before* committing it (test with a deliberately invalid key).
- [ ] Runtime rule enforced: candidates with `duration_minutes ≥ 15` (or where end credits can't be reliably excluded and would push it over) are hard-rejected, never presented.
- [ ] Follow-up commands ("make activity 2 easier") modify only the targeted part of `prior_result`, verified by diffing the response against the input.

## Design-system rollout

- [ ] Every screen touched by a §17 feature also passes the `02-design-system-checklist.md` gate before that feature is marked done — not deferred to a separate pass.
