# F1 — Peer Review Flow (PRD §17.1)

**Objective:** After homework submission, anonymously assign each student one peer submission to rate + comment on. Students stay anonymous to each other; staff see both identities for moderation/grading. Opens only after organizer publishes the assignment. Duplicate review per assignment blocked.

## Preconditions — verify before writing any migration

- §9 already renders a `🔒 Anonymous Peer Review Active` badge driven by a `peerReviewOpen`-named flag. **Find the actual column** on the homework/assignment table before creating anything new — either it already exists (most likely, since the UI reads it today) and this feature just needs to *write* to it via a new staff action, or it's currently a hardcoded/mock value in the UI. Do not create a second, differently-named column for the same concept.
- Confirm the actual table/column names for homework assignments and submissions (`homework_assignments`, `homework_submissions` used below are **[ASSUMPTION]** names following the PRD's descriptive language, not confirmed schema).

## Data model

```sql
create table peer_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references homework_assignments(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_submission_id uuid not null references homework_submissions(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assignment_id, reviewer_id)  -- "duplicate peer review per assignment blocked" — one review per reviewer per assignment, matches PRD wording literally
);
alter table peer_reviews enable row level security;
```

⚠️ The unique constraint is `(assignment_id, reviewer_id)`, not per-submission — this encodes a 1-reviewer : 1-assignee model. If a later requirement wants a student to review *multiple* peers per assignment, this constraint (and the assignment algorithm below) must change first; don't build downstream logic that silently assumes multi-review.

## Assignment algorithm

- Run as a **Postgres function** (`open_peer_review(assignment_id)`), invoked via `supabase.rpc(...)` from the staff action, **not computed client-side.** Client-side assignment would require sending the full submission list — including author identities — to a student's browser to compute pairing, which breaks anonymity at the network layer even if the UI never renders it. The assignment mapping must never leave the server to a student session in raw form.
- Use **round-robin (shift-by-one)** over the list of submitters at the moment of opening, not pure random. Round-robin guarantees: no self-assignment, every submission gets exactly one reviewer, and it's deterministic/debuggable — pure random risks someone getting 0 reviewers and needs the same fixup logic anyway.
- **Edge case — N=1 submission:** cannot peer review (no one else exists). Fail gracefully: UI shows "Not enough submissions yet for peer review," staff action to open review is disabled, not a crash or a self-assigned review.
- **Edge case — late submitters:** freeze the assignment set at the moment `peer_review_open` flips true. Anyone who submits after that point is excluded from that review cycle rather than triggering a re-run (a re-run risks orphaning reviews already submitted against a mapping that's about to change). State this explicitly in the UI copy so it isn't silently confusing to a late submitter wondering why they have no review.

## RLS policies

1. **INSERT** on `peer_reviews`: `reviewer_id = auth.uid()`, and the `(assignment_id, reviewee_submission_id)` pair must match what the server actually assigned — verify via a security-definer function/join, not by trusting the client-supplied `reviewee_submission_id`. Without this check a student could submit a review against an arbitrary submission they weren't assigned to; the unique constraint alone doesn't stop that since it's keyed on `(assignment_id, reviewer_id)`, not the target.
2. **SELECT**, staff (`isStaffRole`): unrestricted — join to author + reviewer names for moderation.
3. **SELECT**, student: only their own submitted reviews (`reviewer_id = auth.uid()`). For seeing feedback *received* on their own submission, expose through a view `peer_reviews_for_author` that returns `rating, comment` but **omits `reviewer_id`** — row-level security can restrict which *rows* a role sees, but not which *columns* within a visible row; column-level anonymity requires a view (or an application-layer strip) granted in place of direct table SELECT for that access pattern.

⚠️ **Small-cohort deanonymization is structural, not a bug.** With only 2–3 active submitters, round-robin assignment makes the reviewer's identity trivially inferable by the author even without ever seeing `reviewer_id` — only one other person could plausibly have written it. Surface this in the UI for small cohorts ("Peer review works best with 4+ participants") rather than presenting anonymity as absolute when it isn't. **F4 (session ratings) has the identical risk at the identical root cause (small N) — solve the pattern once (the `order by random()` technique in F4's aggregate view is one mitigation), reuse it.**

## Frontend

- Extend the homework view (verify actual filename — `HomeworkView.tsx` assumed by convention, not confirmed) with a "Review a Peer" state, shown only when the current user has a pending assigned review and `peer_review_open = true`: modal with submission text (author withheld) + 1–5 star input + comment textarea → submit → local state flips to reviewed (same optimistic-update pattern as §7 RSVP).
- Staff: expandable moderation row per assignment showing the reviewer→reviewee mapping with both real names, gated behind `isStaffRole` — reuse the same staff-only conditional pattern already used for Post Announcement / Publish Assignment.
- Points: see `01-shared-conventions.md` — default 0 until specified.

## Acceptance criteria

See `qa/acceptance-criteria.md#f1`.
