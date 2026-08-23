# Implementation Plan — English Workshop Platform, §17 Build

**Source:** `prd.md` (English Workshop Platform PRD, §1–19)
**Scope of this plan:** the full product — §1–16 core platform, §17 (7 new features), and the §18 design system applied from day one. The PRD was carried over from an earlier project: **nothing is built yet** in this workspace (planning docs only). Every table, column, and component referenced below must be created fresh or verified against whatever codebase this plan is executed against — those touchpoints are called out per-feature with a **Preconditions** section.

**Precedence rule:** PRD §1–19 defines *what* to build and *why* (behavior is authoritative there). This plan defines *how* — architecture, schema, libraries, execution order, failure modes. If this plan and the PRD conflict on behavior, the PRD wins; if the PRD is silent on an implementation detail, this plan's recommendation is the default unless a step says "flag to user."

Every recommendation in this plan that is not directly stated in the PRD is a judgment call, marked **[ASSUMPTION]** or **[OPEN DECISION]**. Execution agents must not silently treat those as confirmed facts — surface them in PR descriptions / commit messages so a human reviews them.

---

## Folder map

```
implementation-plan/
├── 00-INDEX.md                    ← you are here
├── 01-shared-conventions.md       ← stack, tools, RLS/testing/i18n/secrets rules — READ FIRST
├── 02-design-system-checklist.md  ← §18 distilled into a per-component gate + rollout tracker
├── features/
│   ├── F1-peer-review.md          (PRD §17.1)
│   ├── F2-calendar-export.md      (PRD §17.2)
│   ├── F3-breakout-rooms.md       (PRD §17.3)
│   ├── F4-session-ratings.md      (PRD §17.4)
│   ├── F5-more-game-types.md      (PRD §17.5)
│   ├── F6-admin-analytics.md      (PRD §17.6)
│   └── F7-ai-chat-room/           (PRD §17.7 — flagship feature, own subfolder)
│       ├── 00-overview-and-pipeline.md
│       ├── 01-database-and-secrets.md
│       ├── 02-edge-function-gemini-movie-session.md
│       ├── 03-frontend-ai-chat-room.md
│       └── system-prompt.txt      ← verbatim prompt, copy-paste into the Edge Function
└── qa/
    └── acceptance-criteria.md     ← Definition-of-Done per feature, self-verify before marking done
```

---

## Dependency graph & recommended execution order

Not a hard requirement, but building out of order creates rework — reasons given so an agent can deviate deliberately, not accidentally.

| Order | Feature | Depends on | Why this position |
|---|---|---|---|
| 1 | **F2** Calendar export | Nothing new | Zero schema, zero RLS, isolated, cheap. Good warm-up / validates the read-only assumption about `sessions` timestamps. |
| 2 | **F4** Session ratings | A session "ended" concept (doesn't exist yet — build it here) | Needs a lifecycle flag other features (F3 cleanup) can also reuse. Do this early so later features can depend on it instead of each inventing their own. |
| 3 | **F1** Peer review | Homework/submission tables (build per §9 if absent) + `peer_review_open` flag on assignments | Self-contained once the flag exists. |
| 4 | **F3** Breakout rooms | Sessions (§7) + the "ended" flag from step 2 for cleanup | Independent otherwise. |
| 5 | **F5** More game types | `GameEngine`/`HotSeatStrategy` modular engine (per §8/§17.5) | Largest refactor risk — do after the team/agent has re-familiarized itself with the codebase via steps 1–4. |
| 6 | **F7** AI Chat Room | Nothing from §17, but needs new external API keys provisioned (YouTube, OMDb, Gemini) | Fully isolated, staff-only. Biggest single feature — sequence last among the "independent" items so earlier smaller wins de-risk the process first. |
| 7 | **F6** Admin analytics | Data produced by F1/F3/F4/F5 (attendance, reports, ratings) | Build **last**. Building a dashboard before its data sources exist means testing against fabricated shapes that won't match reality. |
| continuous | Design-system rollout (§18) | — | Not a discrete step; apply the checklist in `02-design-system-checklist.md` to every new component as it's built, plus a dedicated pass over pre-existing untouched tabs. |

---

## Agent operating protocol

1. Read `01-shared-conventions.md` in full before writing any code — it defines rules that apply across every feature (RLS-first, secrets handling, i18n, theming) that are **not** repeated in each feature file.
2. Read the target feature file in full before starting. Do not skim for the schema and skip the warnings — the warnings encode failure modes found by working through the PRD, not decoration.
3. Check that feature file's **Preconditions**. If a precondition can't be verified in the actual codebase (a column, table, or component the plan assumes exists), **stop and flag it** rather than silently inventing a substitute — several feature files call out specific PRD ambiguities that need a human product decision.
4. Build order within a feature: migration → RLS policies (same migration, never a follow-up) → backend/Edge Function → frontend.
5. Self-verify against the matching section of `qa/acceptance-criteria.md` before marking the feature done.
6. Update the status table below.

## Global STOP conditions

Halt and ask the human rather than guess when:
- A step would require disabling or weakening RLS "temporarily."
- A secret would need to be committed to a migration, seed file, or client bundle to make progress.
- A step assumes code/tables from the earlier project exist here and they can't be located — stop and ask rather than inventing a substitute.
- Two features in this plan appear to need the same underlying concept built two different ways (e.g., F3's Report button vs. §12 main chat's — flagged in `F3-breakout-rooms.md`).

## Status tracker

| Feature | Status | Notes |
|---|---|---|
| F2 Calendar export | ✅ Built v1 | `src/lib/calendar.ts`; `.ics` UTC-Z + Google template; duration defaults 60 min if missing (flagged in F2 preconditions) |
| F4 Session ratings | ✅ Built v1 | Human decision: `ended_at` via staff **End Session** button (Host Panel); aggregate view shuffles notes |
| F1 Peer review | ✅ Built v1 | `peer_review_open` column + frozen participant set; pairing computed server-side (`submit_peer_review` RPC); staff mapping row |
| F3 Breakout rooms | ✅ Built v1 | Capacity trigger (TOCTOU-safe); shared `<TextChatStream>` + one `moderation_reports` queue for main chat AND breakouts (scope decision) |
| F5 More game types | ✅ Built v1 | Strategy interface per plan; renderMode shell (select-one / free-text / vote); self-vote blocked by DB trigger; config persisted on round |
| F7 AI Chat Room | ✅ Built v1 | Two-phase pipeline; Vault-rotatable key w/ validate-before-commit; typed errors verbatim; leak-grep on response. **Architecture change (user-directed, 2026-08-23):** YouTube/OMDb tool phase replaced by Gemini `google_search` grounding with strict honesty rules — requires billing enabled on the Google AI project (grounding is paid-tier); PRD §17.7's machine-verification guarantee is deliberately relaxed |
| F6 Admin analytics | ✅ Built v1 | Materialized overview + refresh RPC; per-student/per-session views; print/PDF deferred per PRD |
| Design rollout | ✅ Built to standard | All screens built fresh against the Coastal palette gate (`02-design-system-checklist.md`); §1–16 core platform implemented in same pass |
