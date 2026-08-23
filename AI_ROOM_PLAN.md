# AI_ROOM_PLAN.md — AI Chat Room Rebuild Master Plan
# Version 3.0 · Author: ox-alpha · Status: ACTIVE ROADMAP
#
# HOW TO USE THIS FILE
# This document is the single source of truth for rebuilding the F7 AI Chat Room.
# Execution MUST follow Part A §9 (Roadmap) in order. Every shipped item gets
# checked off in §10 (Acceptance). Nothing ships that isn't listed here.
#
# TABLE OF CONTENTS
#   PART A — CORE ENGINEERING PLAN ............ §1  – §10   (~1000 lines)
#     §1  Mission, Scope & Non-Negotiables
#     §2  Legacy Feature Inventory (PRESERVE LIST — do not delete)
#     §3  Target Architecture (before → after)
#     §4  Data Model & Security (migration 0003)
#     §5  Edge Function Contracts (v5)
#     §6  Frontend Component Architecture
#     §7  Client State Machine
#     §8  Failure & Edge-Case Matrix
#     §9  Execution Roadmap (ordered phases with gates)
#     §10 Acceptance Criteria (global checkbox list)
#   PART B — FEATURE CATALOG .................. §11       (~200 lines)
#     Eleven feature specs: A…L, each with UX / data / function / i18n / tests
#   PART C — UI & VISUAL DESIGN SPEC .......... §12 – §16  (~500 lines)
#     §12 Design Tokens (Coastal palette, type, space, radius, shadow, motion)
#     §13 Screen Layout Wireframes (mobile + desktop)
#     §14 Component Visual Specs (utility-level prescriptions)
#     §15 Interaction, Motion & Accessibility
#     §16 RTL, Typography (Arabic) & Print Stylesheet
#
# ═══════════════════════════════════════════════════════════════════════
# PART A — CORE ENGINEERING PLAN
# ═══════════════════════════════════════════════════════════════════════

## §1 Mission, Scope & Non-Negotiables

### 1.1 Mission
Rebuild the AI Chat Room (PRD §17.7, feature F7) from scratch into a durable,
multi-device workshop-design studio for staff (host / organizer / admin):

    chat-driven generation  →  persistent draft library  →  inline refinement
    →  video verification  →  one-click publish to the schedule

while preserving every behaviour that already works today (§2).

### 1.2 In scope
- Full frontend rebuild of `AiChatRoomView` (+ extracted sub-components).
- One new DB migration (`0003_ai_chat_sessions.sql`): persistence + RLS.
- Edge function `gemini-movie-session` upgraded to **v5**: adds an
  activity-edit mode alongside whole-session generation; removes the paid-tier
  `google_search` tool dependency (free-tier compatible).
- Edge function `update-ai-key` patched to **v3**: upsert fix for missing row.
- New shared lib helpers, types, constants, i18n strings (EN + AR).
- Demo-mode parity for every new query pattern (`src/lib/demo/backend.ts`).

### 1.3 Out of scope (explicitly NOT in this rebuild)
- Student-facing AI chat (remains staff-only per PRD §17.7 gate).
- Voice input/output, TTS, STT.
- Multi-user collaborative editing of one draft (single-owner drafts).
- Payment/quota dashboards for Gemini usage.
- Any change to community chat (`chat_messages`) or breakout rooms (F3).

### 1.4 Non-negotiables (violating any = failed build)
1. **RLS-first:** `ai_chat_sessions` ships with `enable row level security`
   AND its policies inside migration 0003, same transaction. Staff-only.
2. **Key hygiene:** raw Gemini key never appears in any response body, log
   line, or client console. Leak-grep stays in the function (defense-in-depth).
3. **Verbatim failure copy:** the four PRD failure-state messages are never
   paraphrased. Map codes → i18n keys exactly as today (ERR_KEY record).
4. **Bilingual:** every new user-facing string goes through `src/lib/i18n.ts`
   in BOTH English and Arabic. No inline literals in JSX.
5. **RTL-safe:** logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `text-start`
   /`text-end`); Arabic strings render under `font-arabic`, `dir="rtl"` where
   standalone.
6. **Honest demo mode:** with no Supabase env vars, every new query pattern is
   emulated in `demo/backend.ts`; AI generation keeps failing with NO_API_KEY
   (never fakes success).
7. **Free-tier compatible:** default path makes ZERO calls that require Gemini
   billing (no `google_search` tool attached). Billing becomes optional.
8. **No deletion of legacy behaviours** listed in §2 unless a §11 feature
   explicitly supersedes them (superseding noted in that feature's spec).
9. **Design-gate compliance:** final pass against
   `implementation-plan/02-design-system-checklist.md` (12-row gate).
10. **Verification over vibes:** `npm run typecheck && npm run build` must
    pass before any commit; manual smoke of §10 items before push.

### 1.5 Success definition
A staff member can: start a chat → get a verified-feeling session draft →
tweak individual activities conversationally → watch the film inline → save,
close the tab, return tomorrow on their phone, resume → publish to schedule.
All state survives refresh. All strings exist in AR. Zero console errors.

---

## §2 Legacy Feature Inventory (PRESERVE LIST — do not delete)

Every line below is behaviour that EXISTS TODAY and MUST STILL WORK after the
rebuild. Source of truth audited from current `AiChatRoomView.tsx`,
edge functions, and i18n keys. Rebuild may re-house these behind new
components but not change their observable contract.

| ID  | Legacy behaviour | Where it lives today | Preserve notes |
|-----|------------------|----------------------|----------------|
| L01 | Staff-only gating banner: “🔒 Staff only…” | Banner top of view | Copy unchanged (`aiChatStaffOnly`) |
| L02 | Non-staff cannot generate: function 403s | fn role check | Server-enforced; UI mirrors |
| L03 | Settings card: configured/not + last4 | header card | Adds model line (kept) |
| L04 | Open-settings gear button label swaps Replace/Enter key | header card | Same labels |
| L05 | Key save flow: validate-before-commit | update-ai-key `set` | Validation fetch stays |
| L06 | Invalid key alert copy | `keyInvalid` | Verbatim |
| L07 | Key removal (Vault secret deleted + flags cleared) | update-ai-key `remove` | Stays |
| L08 | Model dropdown (12 models) + Save, disabled when unchanged | settings modal | Stays; upsert fix applied |
| L09 | Current-model line ⚙️ under last4 | header card | Stays |
| L10 | Level pills Beginner/Intermediate/Advanced | pill row | Same LEVELS const |
| L11 | Six quick chips (suggest short, regenerate, formal, easier, alternative, draft) | chip row | All six remain functional |
| L12 | Free-text input + ➤ submit, busy state | composer | Stays (re-skinned allowed) |
| L13 | Phase messages 🔍 Searching… / 🎬 Found N… / ✨ Drafting… | sysMsgs stream | Kept verbatim keys |
| L14 | Typed failures → exact PRD copy: errNoApiKey / errAiUnavailable / errNoCandidate / errInvalidJson | ERR_KEY map | Never paraphrase |
| L15 | Result article: petrol header, title, arabicTitle, film, watch link, duration | result card | Content contract kept; visuals may upgrade |
| L16 | Activities list rendering (title/goal/timing/grouping/prompt/skills/expected) | result card | Field set unchanged |
| L17 | “Create session from this draft” → inserts into `sessions` (Virtual, +2 days) | publish action | Same insert shape |
| L18 | chosen_movie continuity on follow-ups | request body | Preserved in v5 fn |
| L19 | prior_result echo for context | request body | Preserved (now also persisted) |
| L20 | Demo mode: generation returns `{ok:false,error_code:'NO_API_KEY'}` honestly | demo/backend.ts | Parity maintained |
| L21 | update-ai-key demo returns validation_failed honestly | demo/backend.ts | Parity maintained |
| L22 | Masked-only settings status via `ai_settings_status` view | view | View gains gemini_model (already live) |
| L23 | Vault round-trip (store/decrypt server-side only) | update-ai-key / fn | Untouched mechanism |

---

## §3 Target Architecture (before → after)

### 3.1 Before (current, v4 reality)
```
Browser ── invoke('gemini-movie-session') ──► Deno fn ──► Gemini (no tools)
   │                ▲                              │
   │                └── ai_settings ◄─────────────┘ (vault decrypt)
   ├── transient React state ONLY (sysMsgs, result)  → lost on refresh
   └── update-ai-key (.update bug if row missing)
```

### 3.2 After (this rebuild)
```
                        ┌────────────────────────────┐
                        │  AiChatRoomView (rebuilt)  │
                        │  ┌──────────────────────┐  │
   settings modal ──────┼─►│ SettingsCard/Modal   │  │
   level + preset chips ┼─►│ ComposerBar          │  │
   phase/error stream ──┼─►│ ChatStream           │  │
   result + actions ────┼─►│ SessionResultCard    │  │
                        │  │  ├ VideoPreview      │  │
                        │  │  ├ ActivityList      │  │
                        │  │  │   └ ActivityEditor│  │
                        │  │  └ PublishBar        │  │
                        │  └──────────────────────┘  │
                        └───────┬───────────┬────────┘
        invoke('gemini-movie-session')      supabase.from('ai_chat_sessions')
                │                                   │  (autosave, list,
                ▼                                   ▼   resume, rename, dup,
        Deno fn v5  ──► Gemini                  RLS-guarded Postgres
        (no tools; free-tier safe)              vault-backed key unchanged
```

### 3.3 Module boundaries (new/changed files)
```
src/views/AiChatRoomView.tsx          ← rebuilt container (orchestration only)
src/components/ai/
    SettingsModal.tsx                 ← key + model + remove (L04–L09)
    ChatStream.tsx                    ← phase msgs + errors + empty/skeleton
    SessionResultCard.tsx             ← L15/L16 + video + actions
    VideoPreview.tsx                  ← F-C lazy YouTube embed
    ActivityItem.tsx                  ← one activity + inline editor trigger
    ActivityInlineEditor.tsx          ← F-D micro-prompt editing UI
    DraftsMenu.tsx                    ← F-B saved-draft picker/actions
src/lib/ai-chat.ts                    ← client data layer (CRUD + autosave)
src/lib/constants.ts                  ← += GEMINI_FOCUS_PRESETS
src/lib/types.ts                      ← += AiChatSessionRow, FocusPreset
src/lib/demo/backend.ts               ← emulate ai_chat_sessions CRUD
supabase/migrations/0003_*.sql        ← table + RLS (+ seed row guard)
supabase/functions/gemini-movie-session/{index.ts,system-prompt.txt}
supabase/functions/update-ai-key/index.ts
src/lib/i18n.ts                       ← += ~40 keys ×2 languages
```

### 3.4 Dependency rules
- Views import from `lib/ai-chat.ts`, never raw supabase calls scattered.
- Components receive data + callbacks; no direct network calls inside
  presentational components (except VideoPreview iframe, which is passive).
- i18n keys added in same commit as the component using them (both langs).

---

## §4 Data Model & Security (migration 0003)

### 4.1 Table: `public.ai_chat_sessions`
```sql
create table public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled draft',
  level text not null default 'Intermediate'
    check (level in ('Beginner','Intermediate','Advanced')),
  focus_preset text,                       -- nullable preset id
  transcript jsonb not null default '[]',  -- [{id,role,text,kind,at}]
  result jsonb,                            -- MovieSessionResult | null
  updated_at timestamptz not null default now()
);
```
Rationale per column:
- `owner`: single-author drafts (out-of-scope: collaboration).
- `transcript`: ordered system/user messages incl. phase + error kinds →
  restores the chat feel on resume. Kinds mirror SysMsg: 'phase' | 'err' |
  'user'. Cap length client-side (last 200 entries) to bound row size.
- `result`: exact `MovieSessionResult` JSON as returned by fn → enables
  resume-with-context (prior_result) and re-publish.
- `updated_at`: ordering for the drafts menu; bumped on every save.

### 4.2 Indexes
```sql
create index ai_chat_sessions_owner_updated_idx
  on public.ai_chat_sessions (owner, updated_at desc);
```

### 4.3 RLS (same migration — hard boundary)
```sql
alter table public.ai_chat_sessions enable row level security;

create policy "sessions: own crud" on public.ai_chat_sessions
  for all to authenticated
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('host','organizer','admin')
    )
  );
```
Notes:
- SELECT/INSERT/UPDATE/DELETE all covered by FOR ALL policy.
- Double gate: owner match **AND** staff role at write time — a demoted
  staffer can read nothing new and write nothing (reads of own rows also die
  because USING fails → acceptable & intended).
- No anon policy: signed-out users get zero rows.
- Service role bypasses RLS (fn reads/writes if ever needed server-side).

### 4.4 `ai_settings` hardening (same migration, idempotent)
```sql
insert into public.ai_settings (id) values (true)
on conflict (id) do nothing;
```
Guarantees the singleton row exists even if operators never ran the manual
insert — pairs with the update→upsert code fix (§11.F-A.4, §9 Phase 2).

### 4.5 What does NOT change
- `ai_settings`, `ai_settings_status`, Vault secrets: untouched shapes.
- `sessions` publish target: same columns written by L17 flow.

---

## §5 Edge Function Contracts (v5)

### 5.1 `update-ai-key` → v3
Change: `.update().eq('id', true)` → `.upsert({ id: true, … },
{ onConflict: 'id' })` in BOTH `set_model` and `set` branches.
Everything else byte-identical to deployed v2 (validation-first, vault
round-trip, leak-free responses).

Response contracts (unchanged):
- `set`      → `{ ok:true, configured:true, model }` | `{ ok:false, reason }`
- `set_model`→ `{ ok:true, configured, model }`      | `{ ok:false,…}`
- `remove`   → `{ ok:true, configured:false }`

### 5.2 `gemini-movie-session` → v5
One endpoint, two modes, discriminated by optional body field.

**Mode 1 — GENERATE (default, body identical to today)**
```
POST { Authorization: Bearer <staff JWT> }
{ user_message, workshop_level, chosen_movie?, prior_result? }
→ 200 { ok:true, result: MovieSessionResult }
→ 200 { ok:false, error_code: NO_API_KEY|AI_UNAVAILABLE|INVALID_JSON }
```

**Mode 2 — EDIT ACTIVITY (new)**
```
POST { … , edit_activity_index: 0|1|2|3, edit_instruction: string(≤300) }
requires prior_result present (the draft being edited)
→ 200 { ok:true, result: MovieSessionResult }   // FULL object returned;
                                                // untouched activities are
                                                // echoed back verbatim by
                                                // prompt instruction; client
                                                // additionally splices to
                                                // guarantee immutability.
→ 200 { ok:false, error_code: … }               // same typed set
```

**v5 behavioural spec (both modes)**
1. Auth/role checks identical (401/403 paths unchanged).
2. Key+model load from ai_settings/Vault identical (incl. NO_API_KEY paths).
3. **No `tools` field** in Gemini request — pure text completion. Removes
   paid-tier grounding dependency (root cause of the 429 outage).
4. System prompt (see system-prompt.txt v5):
   - Curated award-winning shorts knowledge base embedded (titles + stable
     YouTube IDs vetted manually at build time — see §11.F-C.3 list).
   - Honesty rules: only emit URLs from the curated list or clearly-known
     stable IDs; unknown ⇒ null; never fabricate ratings.
   - EDIT mode instruction block templated from
     `{{edit_mode}}/{{edit_index}}/{{edit_instruction}}`.
5. Timeout raised 22s → 45s (long structured outputs); AbortController kept.
6. Response assembly joins multi-part text parts (robustness).
7. Leak-grep defense-in-depth retained verbatim.
8. Logging events: generation_started(mode)/session_generated/
   generation_failed(code) — no secrets, no prompt bodies.

### 5.3 System-prompt v5 skeleton (full text lives in system-prompt.txt)
```
ROLE … (unchanged mission)
FILM LIBRARY (curated, verified IDs)  ← replaces live search
SELECTION RULES …
HONESTY RULES (absolute) …
SESSION DESIGN (exactly 4 activities, progression, toolbox) …
LEVEL ADAPTATION … LANGUAGE (EN-first, AR hints) …
EDIT MODE (when {{edit_mode}}="true": modify ONLY activity {{edit_index}}
  per "{{edit_instruction}}"; return the COMPLETE schema with all other
  activities byte-identical) …
OUTPUT RULES (ONLY valid JSON; schema; 4 activities) …
CONTEXT: Request={{user_message}} Level={{workshop_level}}
         Previous={{chosen_movie_or_null}} Prior={{prior_result_json}}
```

### 5.4 Back-compatibility guarantee
Old clients (current build) sending Mode-1 bodies receive identical shape —
deploying v5 is non-breaking; frontend and fn can deploy independently.

---

## §6 Frontend Component Architecture

### 6.1 Container: `AiChatRoomView` (rebuilt)
Owns ONLY orchestration state; renders section components.

```ts
// orchestration state
sessionId:    string | null        // active draft id (null = unsaved yet)
transcript:   TranscriptMsg[]      // [{id, role:'sys'|'user', kind:'phase'|'err'|'user', text, at}]
result:       MovieSessionResult | null
status:       AiSettingsStatus | null
drafts:       DraftMeta[]          // [{id,title,updated_at,has_result}]
busy:         boolean              // any in-flight op
editingIdx:   number | null        // activity being inline-edited
level, preset, settingsOpen, input…
```

Responsibilities:
- Load status (`ai_settings_status`) on mount — as today.
- Restore most-recent draft on mount (F-B): newest by updated_at with
  transcript or result → hydrate silently; else fresh empty state.
- `generate(text)`: push user msg → phase msgs → invoke fn Mode-1 → on ok:
  set result, push found/drafting phases (same copy), **autosave**.
- `editActivity(idx, instruction)`: set editingIdx busy → fn Mode-2 → splice
  result.activities[idx] = returned[idx] → autosave.
- `publish()`: L17 insert unchanged → toast-ish system msg.
- Draft ops via `lib/ai-chat.ts`: save/list/open/rename/delete/duplicate.
- All strings via t(); all mutations funnel through ai-chat layer.

### 6.2 `SettingsModal` (extracted)
Props: open,onClose,status,busy + onSaveKey,onSaveModel,onRemove.
Contains: key password field (L05/L06), model select (L08), remove button,
privacy footnote line. Visual spec §14.3.

### 6.3 `ChatStream`
Renders transcript bubbles + live phase indicator + skeletons.
- sys/phase rows: soft mist chip style (L13 copy preserved).
- sys/err rows: red-tinted row (typed failures L14).
- user rows: right-aligned (LTR) / left-aligned (RTL) petrol bubble.
- while busy & no phases yet: 3 shimmer skeleton lines (F-L).
Empty state (no messages, no result): illustrated hero block (§14.7).

### 6.4 `SessionResultCard`
Sections top→bottom:
1. Petrol header (title/arabicTitle/film+watch link/duration) — L15 kept,
   adds focus-preset badge if one was used.
2. `VideoPreview` — F-C collapsed-by-default player.
3. Timing strip — total vs Σ timing_min with mismatch warning (F-I).
4. `ActivityItem ×4` — numbered cards; each has ✏️ Edit-with-AI (F-D),
   📋 copy button (F-H).
5. `PublishBar` — primary publish (L17) + print worksheet (F-G) +
   duplicate/rename/delete (F-N) overflow menu.

### 6.5 `VideoPreview` (F-C)
- Renders only when result.session.link parses to a YouTube URL.
- Facade pattern: poster thumbnail (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`)
  + ▶ overlay; iframe (`youtube-nocookie.com/embed/<id>`) mounts on click
  only → zero third-party JS until consent-to-load. 16:9 responsive box.
- Non-YouTube link ⇒ plain external-link row (graceful).

### 6.6 `ActivityInlineEditor` (F-D)
Expands under the targeted ActivityItem: textarea (≤300 chars) + hint chips
(“easier”, “for pairs”, “add AR hints”, “more formal”, “longer”) + Run button
+ Cancel. On success the item cross-fades to new content; others untouched.

### 6.7 `DraftsMenu` (F-B/F-N)
Popover from header “📚 Drafts” button: list (title, relative time, ● has
result), actions per row: Open / Rename / Duplicate / Delete (confirm).
“＋ New draft” resets to blank session (autosaves previous first).

### 6.8 Data layer: `src/lib/ai-chat.ts`
```ts
export interface DraftMeta {…}
listDrafts(): Promise<DraftMeta[]>            // order updated_at desc, limit 50
openDraft(id): Promise<{transcript,result,title,level,focus_preset}|null>
createDraft(seed): Promise<string /*id*/>     // returns uuid immediately
saveDraft(id, patch): Promise<void>           // debounced wrapper lives here
renameDraft / duplicateDraft / deleteDraft
extractYouTubeId(url): string | null          // watch/shorts/youtu.be/embed
```
All calls go through shared `supabase` client (demo-aware automatically).
Autosave policy (F-J): debounce 1200ms after transcript/result/title/level/
preset change; flush immediately on generate-success, publish, unmount,
visibilitychange→hidden. Save failure ⇒ non-blocking toast-style err msg;
retry next tick; never blocks typing.

### 6.9 Demo-mode parity additions (hard rule §1.4-6)
In `demo/backend.ts`: recognize table `ai_chat_sessions` with an in-memory
Map keyed by fake uuid; owner forced to current demo profile; CRUD semantics
matching §4 policies (staff demo accounts pass). Generation still honestly
fails NO_API_KEY (L20) — but drafts/transcripts persist locally so the whole
new UI is exercisable offline.

---

## §7 Client State Machine

```
            ┌──────────┐   restore?    ┌────────────┐
  mount ───►│ LOADING  │──────────────►│ IDLE       │
            │ status+  │               │ (empty or  │
            │ drafts   │               │ hydrated)  │
            └──────────┘               └──┬─────┬───┘
                     ▲ submit/generate     │     │ open drafts menu
                     │                     ▼     ▼
                ┌────────────────────────────┐ ┌──────────┐
                │ GENERATING                 │ │ BROWSING │
                │ composer locked,           │ │ drafts   │
                │ phases stream, skeletons   │ └──────────┘
                └──────┬───────────┬─────────┘
              ok ▼          err ▼
        ┌──────────┐   ┌──────────────┐
        │ RESULT   │   │ ERROR_SHOWN  │── retry (chip/input) ──► GENERATING
        │ (idle+)  │   └──────────────┘
        └─┬──────┬─┘
 edit ▼      publish ▼
 ┌───────────────┐ ┌──────────┐
 │ EDITING(idx)  │ │ PUBLISHING│──► ok: sys msg “published”; stay RESULT
 │ editor open,  │ └──────────┘
 │ card busy     │── ok: splice+autosave ──► RESULT
 └───────────────┘── err: typed msg in-stream ──► RESULT
```
Rules:
- Only one in-flight network op at a time (`busy` guard everywhere).
- ERROR_SHOWN never clears prior good result (append error, keep draft).
- Refresh mid-GENERATING: safe — last autosaved snapshot resumes on reload.
- Demo mode: identical machine; generation always lands ERROR(NO_API_KEY).

---

## §8 Failure & Edge-Case Matrix

| # | Scenario | Detection | UX | Data |
|---|----------|-----------|----|------|
| E01 | No Gemini key configured | fn NO_API_KEY | verbatim errNoApiKey (L14) | nothing written beyond transcript |
| E02 | Key invalid/quota (4xx incl 429) | fn AI_UNAVAILABLE | verbatim errAiUnavailable | transcript saved |
| E03 | Malformed model JSON | fn INVALID_JSON×2 paths | verbatim errInvalidJson | transcript saved |
| E04 | Not staff | fn 403 → AI_UNAVAILABLE shape | banner L02 + err | none |
| E05 | Offline at submit | fetch throws → AI_UNAVAILABLE path | errAiUnavailable + retry hint | local only; autosave queued |
| E06 | Autosave fails (RLS/network) | saveDraft catch | tiny amber “Saving…” badge persists; auto-retry | local state intact |
| E07 | Draft deleted on other device while open | update affects 0 rows | recreate via createDraft on next save | self-heal |
| E08 | >200 transcript entries | slice before save | oldest dropped silently | bounded row size |
| E09 | VideoPreview non-YouTube URL | extractYouTubeId null | external-link fallback row | — |
| E10 | Edit instruction empty | client guard | disable Run btn | no call |
| E11 | Edit mode model returns wrong count ≠4 | validateResult fails | verbatim errInvalidJson | result untouched |
| E12 | Publish duplicate click | disabled while busy + optimistic flag | — | unique title suffix not needed (PRD silent) |
| E13 | Session link missing | optional chaining everywhere | header hides link; preview hidden | — |
| E14 | Arabic-only instruction in editor | sent verbatim | model handles; UI unchanged | — |
| E15 | Level pill changed AFTER generation | allowed | next generate uses new level; existing result stays | autosave level |
| E16 | Preset changed mid-draft | allowed | badge updates; applies next generate | autosave preset |

---

## §9 Execution Roadmap (ordered phases with gates)

> Execute strictly in order. Each Phase ends with its Gate; do not start the
> next phase until the gate passes.

### Phase 0 — Baseline safety net
- [ ] Record current build green: `npm run typecheck && npm run build`.
- [ ] Snapshot current view behaviour notes into PR body.
**Gate G0:** both commands exit 0 on untouched tree.

### Phase 1 — Database (migration 0003)
- [ ] Write `supabase/migrations/0003_ai_chat_sessions.sql` exactly per §4
      (table, index, RLS+policy, ai_settings seed guard).
- [ ] Apply to cloud project (dashboard SQL editor or `npx supabase db push`
      once access token available) and verify with smoke SQL:
      insert/select/delete as staff JWT; confirm anon denied.
**Gate G1:** policy test matrix passes (staff-owner ✓, staff-other-row ✗,
anon ✗); `\d ai_chat_sessions` shows RLS enabled.

### Phase 2 — update-ai-key v3 upsert fix
- [ ] Apply §5.1 edits locally (already staged in working tree).
- [ ] Deploy function; smoke: `set_model` on a DB where row was deleted ⇒
      row recreated; response `{ok:true}`.
**Gate G2:** delete row → set_model → row exists with chosen model.

### Phase 3 — gemini-movie-session v5
- [ ] Rewrite index.ts per §5.2 (no tools; 45s; multi-part join; EDIT mode).
- [ ] Rewrite system-prompt.txt per §5.3 incl. curated film library block.
- [ ] Local dry-run of extractJson/validateResult against fixture outputs
      (happy, fenced-markdown, missing-activity, edit-mode echo).
- [ ] Deploy v5; curl Mode-1 happy + Mode-2 happy with real staff JWT.
**Gate G3:** both modes return `{ok:true}` with 4 activities; old-body
client (Mode-1 only) unaffected; zero key material in logs.

### Phase 4 — Client data layer + types + constants
- [ ] types.ts: AiChatSessionRow, TranscriptMsg, DraftMeta, FocusPreset.
- [ ] constants.ts: GEMINI_FOCUS_PRESETS (id,labelKey,promptPrefix).
- [ ] lib/ai-chat.ts full CRUD + autosave + extractYouTubeId.
- [ ] demo/backend.ts parity for ai_chat_sessions (+ unit-ish console check).
**Gate G4:** `npm run typecheck` green; demo CRUD exercised via console.

### Phase 5 — Components + rebuilt view
- [ ] Extract/build per §6: SettingsModal, ChatStream, SessionResultCard,
      VideoPreview, ActivityItem, ActivityInlineEditor, DraftsMenu.
- [ ] Rebuild AiChatRoomView orchestrating §7 machine.
- [ ] Wire every i18n key (EN+AR) as components land — same commit.
- [ ] Preserve-list audit against §2 checklist (all 23 rows verified live).
**Gate G5:** typecheck+build green; manual walk of §10 script in dev.

### Phase 6 — Polish & design gate
- [ ] §12–16 tokens/motion/a11y/print applied.
- [ ] 02-design-system-checklist.md 12 rows re-audited for this screen.
- [ ] Reduced-motion + keyboard-only pass.
**Gate G6:** checklist rows signed; axe-style spot check clean.

### Phase 7 — Ship
- [ ] Commit(s) referencing this file; push origin+shipit.
- [ ] Post-deploy smoke on production URL (real + demo envs).
- [ ] Update 00-INDEX tracker row + this file’s status header.
**Gate G7:** production smoke passes; trackers updated.

Rollback strategy: functions are versioned (redeploy previous version);
frontend revert = git revert commit; migration is additive (drop table
optional, non-destructive to legacy features).

---

## §10 Acceptance Criteria (global checkbox list)

Persistence
- [ ] A1 Generate → close tab → reopen: same draft restored (chat + result).
- [ ] A2 Draft visible on second device/browser after save.
- [ ] A3 Rename reflected everywhere ≤ next load.
- [ ] A4 Delete removes from menu and cannot be reopened.
- [ ] A5 Duplicate produces independent editable copy.

Generation (legacy parity)
- [ ] A6 All six chips work; free text works; level pills respected.
- [ ] A7 Phase messages appear in original copy/order.
- [ ] A8 Four typed failures each show their exact PRD sentence.
- [ ] A9 Result card shows all legacy fields incl. arabicTitle + watch link.
- [ ] A10 Publish creates scheduled Virtual session +2 days (L17).

New features
- [ ] A11 Focus preset chip visibly alters generated emphasis (spot check).
- [ ] A12 Inline video plays inside page; nocookie domain; lazy iframe.
- [ ] A13 Per-activity edit changes ONLY that activity (others byte-same).
- [ ] A14 Timing strip warns when Σ≠total; matches when equal.
- [ ] A15 Print view prints worksheet cleanly (no chrome/buttons).

Security & hygiene
- [ ] A16 anon/staff-other-row blocked by RLS (SQL probe).
- [ ] A17 Raw key absent from all responses/logs/console (grep pass).
- [ ] A18 No inline literals in JSX; every string resolves EN+AR.
- [ ] A19 RTL layout mirrors correctly (dir=rtl spot screenshots).
- [ ] A20 typecheck+build+design-gate all green at ship.

# ═══════════════════════════════════════════════════════════════════════
# PART B — FEATURE CATALOG  (§11)
# Each spec: Goal / UX / Data / Function impact / i18n keys / Tests.
# IDs referenced from Parts A & C.
# ═══════════════════════════════════════════════════════════════════════

## F-A · Draft persistence engine (foundation)
- **Goal:** every chat + result survives reload/device change.
- **UX:** invisible when working; “Saved ✓ / Saving…” micro-badge near title.
- **Data:** ai_chat_sessions per §4; transcript capped 200; result verbatim.
- **Fn impact:** none (client-only persistence).
- **i18n:** `draftSaved`, `draftSaving`.
- **Tests:** A1, A2, A16.

## F-B · Draft library & resume
- **Goal:** multiple concurrent drafts; pick up any of them anywhere.
- **UX:** header button `📚 Drafts (n)` → popover list; newest first;
  active row highlighted; “＋ New” starts blank (auto-saves previous).
  On mount: auto-open most recent non-empty draft.
- **Data:** listDrafts limit 50 ordered updated_at desc.
- **Fn impact:** none.
- **i18n:** `draftsTitle`, `newDraft`, `openDraftAria`, `emptyDrafts`,
  `untitledDraft`.
- **Tests:** A1–A5.

## F-C · Inline video verification
- **Goal:** watch candidate film without leaving the page.
- **UX:** under result header: 16:9 facade (poster + ▶); click ⇒ nocookie
  iframe; collapse chevron; external-link fallback for non-YouTube URLs.
- **Curated-ID safety net (prompt-side):** system prompt embeds a vetted
  starter library of award-winning shorts with STABLE YouTube ids, e.g.
  *Alike*, *The Present*, *Piper*, *Cuerdas*, *Soar*, *Hair Love*,
  *One-Minute Puberty*, *Changeover*, *Mr Indifferent*, *Take Me Home*
  (final ids verified at Phase 3 and pinned in prompt file).
- **Fn impact:** v5 prompt only.
- **i18n:** `watchPreview`, `hidePreview`, `openExternal`.
- **Tests:** A12; E09 fallback.

## F-D · Per-activity inline AI edit (“✏️ Edit with AI”)
- **Goal:** surgical tweak of one activity without regenerating the draft.
- **UX:** hover/focus reveals ✏️ on each activity card → editor expands
  beneath that card: textarea + quick chips (`easier`/`for pairs`/
  `add Arabic hints`/`more formal`/`longer`) + Run/Cancel; busy shimmer on
  that card only; success cross-fade; failure keeps old text + typed error.
- **Data:** fn Mode-2 (§5.2); client splices returned activity into place;
  transcript logs `✏️ Activity {n} updated` phase msg.
- **i18n:** `editActivity`, `editInstructionPh`, `runEdit`, `cancelEdit`,
  `chipEasier`,`chipForPairs`,`chipAddArabicHints`,`chipMoreFormalShort`,
  `chipLonger`, `activityUpdated`.
- **Tests:** A13; E10/E11.

## F-E · Focus presets (vibe chips)
- **Goal:** one-tap stylistic steering before generation.
- **Presets (id → promptPrefix appended to user_message):**
  - `speaking`   → “Prioritize maximum student talking time…”
  - `grammar`    → “Weave one target grammar point detection/reuse…”
  - `vocab`      → “Extract and recycle key vocabulary across all activities…”
  - `debate`     → “Bias activities toward argumentation and rebuttal…”
  - `culture`    → “Connect the film to Arab-world cultural comparison…”
  - `exam`       → “Align outputs with exam-style speaking/writing tasks…”
- **UX:** second chip row under level pills; single-select toggle;
  badge echoed in result header; persists per draft.
- **Fn impact:** none (prefix composed client-side).
- **i18n:** `focusLabel`, `focusSpeaking`, `focusGrammar`, `focusVocab`,
  `focusDebate`, `focusCulture`, `focusExam`.
- **Tests:** A11.

## F-F · Timing integrity strip (F-I merged)
- **Goal:** catch model arithmetic slips visually.
- **UX:** slim strip above activities: `Σ 32 min · total 30 min ⚠️` amber
  when mismatch >0 min, green check when equal; pure client calc.
- **i18n:** `timingSumLabel`, `timingMismatchWarn`.

## F-G · Printable worksheet export
- **Goal:** teachers print a clean handout.
- **UX:** 🖨 button → `window.print()`; `@media print` hides chrome,
  expands activities to full width, forces light theme, adds footer with
  draft title + date; film link printed as plain URL text.
- **i18n:** `printWorksheet`.

## F-H · Copy-to-clipboard per activity
- **UX:** 📋 copies formatted plaintext block; brief ✓ tick feedback.
- **i18n:** `copyActivity`, `copiedTick` ('✓').

## F-J · Autosave + dirty indicator
- Covered by F-A mechanics; UI badge states: hidden(clean) → spinner
  `draftSaving` → check `draftSaved`; error state reuses E06 path.

## F-K · Keyboard shortcuts
- `Ctrl/⌘+Enter` submit composer; `Esc` closes modal/editor/popovers;
  `/` focuses composer when nothing else focused. Documented in empty-state
  footnote line.

## F-L · Loading & empty states
- Skeleton shimmer lines while first generation runs; illustrated empty
  hero (🎬 + headline + hint + shortcut footnote) when nothing yet.

## F-N · Draft actions: rename / duplicate / delete
- Rename: inline input in menu row (Enter commits, Esc cancels).
- Duplicate: deep-copies transcript+result, title +“ (copy)”.
- Delete: two-step confirm inside popover (no native confirm()).

## F-O · Completion feedback
- On generate/publish success: transient toast-style system message
  (`sessionReady`, `sessionCreatedOk` reuse) — no audio (PWA quiet).

## F-P · Demo-mode parity
- All new tables emulated in-memory; badges/menu/editor fully usable;
  generation still honest-fails (L20). Verified via console script G4.

# ═══════════════════════════════════════════════════════════════════════
# PART C — UI & VISUAL DESIGN SPEC
# Grounded in the existing Coastal system: petrol (primary), mist
# (neutral), brass (accent). Reuses existing utilities: app-card,
# btn-primary, btn-secondary, pill, input-base, font-arabic.
# ═══════════════════════════════════════════════════════════════════════

## §12 Design Tokens

### 12.1 Color roles (semantic mapping)
| Role | Light | Dark | Utility anchor |
|------|-------|------|----------------|
| Surface page | mist-50 | mist-950 | body bg (global) |
| Surface card | white | mist-900 | `app-card` |
| Surface sunken (chip rows, editor bg) | mist-100 | mist-800 | `bg-mist-100 dark:bg-mist-800` |
| Primary / brand | petrol-700 | petrol-500 | `bg-petrol-700 dark:bg-petrol-500 text-white` |
| Selected pill (levels) | petrol-700 + white | petrol-700 + white | unchanged from L10 |
| Accent active (focus presets) | brass-400 border + brass-50 bg | brass-700 border + brass-900/40 bg | mirrors demo-banner style |
| Success strip | emerald-100/emerald-800 | emerald-900/40/emerald-100 | timing OK |
| Warning strip / saving-error badge | amber-100/amber-800 | amber-900/40/amber-100 | timing warn, save fail |
| Danger actions | red-700 text on secondary btn | red-400 text | remove key / delete draft |
| Text primary | mist-900 | mist-100 | inherited from theme |
| Text muted | opacity utilities over primary (60–80%) | same | per-spec below |

Rules:
1. No new hues. Only petrol / mist / brass / semantic green-amber-red.
2. Contrast floor AA: 4.5:1 normal text, 3:1 large/bold. White-on-petrol-700
   ✓ · petrol-700-on-white ✓ · amber small-text uses amber-800 not amber-500.
3. Dark mode parity is mandatory for EVERY new component; each utility
   prescription below lists its dark: pair explicitly.
4. Opacity-based muting preferred over new gray tokens (matches codebase).

### 12.2 Typography scale (existing stack; font-arabic for AR display)
| Use | Classes |
|-----|---------|
| Result title | `text-xl font-extrabold md:text-2xl` |
| Card section titles | `font-bold` (base size) |
| Activity titles | `text-sm font-bold` |
| Body / prompt / goal | `text-sm leading-relaxed` |
| Meta lines (timing, last4, model) | `text-xs` + opacity 50–80% |
| System phase/error rows | `text-xs font-semibold` |
| Chip labels | `text-sm` inside min-h pills |
| Eyebrow (WORKSHOP SESSION) | `text-[11px] uppercase tracking-widest opacity-80` |
| Empty hero headline | `text-lg font-extrabold` |
Arabic-only display strings additionally: `font-arabic`, standalone blocks
`dir="rtl"`; inline mixed content relies on document flow (no dir spam).

### 12.3 Spacing rhythm (4pt grid)
| Token | Usage |
|---|---|
| Page gutter | `px-4`, content `max-w-3xl mx-auto` (unchanged) |
| Card padding standard | `p-4`; hero/header blocks `p-5` |
| Section gap | `mt-4` between major cards |
| Intra-card groups | `space-y-2` / `gap-2` / `gap-3` |
| Chip rows | `gap-2`, scrollable strips bleed `-mx-4 px-4 pb-1` |
| Touch targets | ≥40px (`min-h-[40px]`); icon buttons `h-8 w-8`/`h-9 w-9` |
| Composer sticky pad | `pb-[max(1rem,env(safe-area-inset-bottom))]` |

### 12.4 Radius / borders / elevation
- Cards: `rounded-xl` (app-card). Inner editors/popovers: `rounded-lg`.
- Chat bubbles: `rounded-2xl`; user bubble tight corner toward speaker via
  `rounded-ee-sm` and RTL mirror class (see 16.1).
- Hairlines: `border-mist-200 dark:border-mist-700`.
- Focus: global `focus-visible:ring-2 focus-visible:ring-petrol-500`
  offset-none; never remove outlines.
- Elevation: flat system; ONLY popovers get `shadow-lg`. Hover lift on
  activity cards via subtle shadow-md (desktop pointers only).

### 12.5 Motion tokens
| Token | Value | Used for |
|---|---|---|
| micro | 120ms ease-out | hover/copy-tick swaps |
| enter | 180ms ease-out | bubbles, badges |
| expand | 240ms ease-out | editor open, video facade swap |
| ambient | pulse (built-in) | skeletons, busy card |

---

## §13 Screen Layout Wireframes

### 13.1 Mobile (<md) single column
```
┌────────────────────────────────┐
│ 🔒 staff banner                │
├────────────────────────────────┤
│ ┌ app-card p-4 ──────────────┐ │
│ │ 🔑 AI settings      [📚(3)][⚙️]│
│ │ Configured · ••1234        │ │
│ │ ⚙️ gemini-3.5-flash-lite    │ │
│ │ [Saving… badge row]         │ │
│ └────────────────────────────┘ │
│ LEVEL  [Beginner][Intermediate][Advanced]→scroll
│ FOCUS  [🗣][🧩][📚][⚔][🌍][📝]→scroll
├────────────────────────────────┤
│ ▸ user bubble                  │
│ ◂ phase: 🔍 Searching…         │
│ ◂ phase: 🎬 Found 3 candidates…│
│ ◂ phase: ✨ Drafting 4 activs… │
│ ◂ err rows (when any) red      │
├────────────────────────────────┤
│ ┌ SESSION RESULT CARD ───────┐ │
│ │ petrol header (+badge)     │ │
│ │ ▶ video facade 16:9        │ │
│ │ Σ timing strip ok/warn     │ │
│ │ ① activity   [✏️][📋]      │ │
│ │   └ inline editor (modal-in-card)
│ │ ② activity …               │ │
│ │ ③ activity …               │ │
│ │ ④ activity …               │ │
│ │ [📅 Publish………] [🖨] [⋯]    │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│ composer sticky: input + ➤     │
└────────────────────────────────┘
```

### 13.2 Desktop (≥md)
- Same vertical order; max-w-3xl centered; header card one row
  (drafts left · status middle · gear right).
- Video facade max-height 360px centered (letterboxed).
- Activities remain single column (reading rhythm) — do NOT go 2-col.
- Composer sticks to viewport bottom only while result card shorter than
  viewport; otherwise static after stream (simple CSS: sticky bottom-0).

### 13.3 Overlay stacking rules
- One overlay at a time: SettingsModal XOR DraftsPopover XOR kebab menu
  XOR inline editor. Opening one closes others (single `openOverlay`
  discriminator in view state).
- Esc priority: innermost first (editor → menu → modal).
- Outside click closes popovers; modal keeps existing Modal behavior.

### 13.4 Empty state hero (F-L)
```
              🎬
   Design a workshop from a short film
   Ask below — I’ll pick a real short film,
   draft 4 classroom activities, and let you
   tweak each one with AI before publishing.
   Ctrl+Enter to send · drafts autosave
```
Centered, muted (opacity-70), py-10; hidden when transcript or result exists.

<!-- APPEND_C2 -->

## §14 Component Visual Specs (utility-level prescriptions)

### 14.1 Header card (status + drafts + settings entry)
```
<div class="app-card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
  <div class="min-w-0">
    <p class="font-bold">🔑 {t('aiChatSettings')}</p>
    <p class="text-sm opacity-70">{configured ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}</p>
    {configured && last4 && <p class="text-xs opacity-50">{t('last4Label',{last4})}</p>}
    {configured && model  && <p class="text-xs font-semibold opacity-70">⚙️ {model}</p>}
  </div>
  <div class="flex items-center gap-2">
    {saveBadge}   // F-J: hidden | 'draftSaving' spinner text | 'draftSaved' ✓
    <button aria-haspopup="menu" aria-expanded={open}
      class="btn-secondary !min-h-[40px] px-4 py-2 text-sm">
      📚 {t('draftsTitle')} ({n})
    </button>
    <button class="btn-secondary !min-h-[40px] px-4 py-2 text-sm"
      onClick={openSettings}>
      ⚙️ {configured ? t('replaceKey') : t('enterApiKey')}
    </button>
  </div>
</div>
saveBadge classes: `rounded-full px-2 py-0.5 text-[11px] font-semibold
  bg-mist-200 text-mist-700 dark:bg-mist-800 dark:text-mist-200`
  saving adds `animate-pulse`; error variant amber pair from 12.1.
```

### 14.2 Level pills — BYTE-IDENTICAL to today (L10)
```
pill min-h-[36px] px-3
 active:   bg-petrol-700 !text-white
 inactive: bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100
row label: text-xs font-bold uppercase tracking-wide opacity-60
```

### 14.3 Focus preset chips (F-E)
Geometry = level pill but min-h-[40px]; ACTIVE uses brass accent:
```
active:   bg-brass-100 !text-brass-900 border border-brass-400
          dark:bg-brass-900/40 dark:!text-brass-100 dark:border-brass-700
inactive: same as inactive level pill
content:  emoji + short label (i18n)
```
Rationale for brass: levels are “who”, focus is “how” — distinct hue family
prevents misreading state at a glance; stays inside palette.

### 14.4 SettingsModal
- Shell: existing `<Modal>`; content stack `flex flex-col gap-3`.
- Key form label bold sm; input `input-base type=password autocomplete=off`.
- Model section separated `mt-3 border-t border-mist-200 pt-3 dark:border-mist-700`
  with `<label>` bold sm wrapping native `<select class="input-base">`.
- Save key → btn-primary w-full (busy: loading copy).
- Save model → btn-secondary w-full, disabled when unchanged or busy.
- Remove → btn-secondary w-full danger text pair (as legacy).
- Footnote `mt-3 text-[11px] leading-relaxed opacity-60` (privacy line kept).
- Invalid key → alert(t('keyInvalid')) retained verbatim path (L06).

### 14.5 ChatStream rows
Container `space-y-1.5 mt-4` + `aria-live="polite"`.
| Row type | Classes |
|---|---|
| phase | `rounded-lg px-3 py-2 text-xs font-semibold bg-mist-200 text-mist-900 dark:bg-mist-800 dark:text-mist-100` |
| error | same metrics, `bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100` |
| user bubble | self-end `max-w-[85%] rounded-2xl rounded-ee-sm rtl:rounded-es-sm rtl:rounded-ee-2xl bg-petrol-700 px-4 py-2 text-sm text-white dark:bg-petrol-600` |
| skeleton ×3 | `h-3 rounded-full bg-mist-200/70 dark:bg-mist-700/60 animate-pulse` widths w-[90%]/w-[75%]/w-[60%] staggered `[animation-delay:80ms/160ms]` |

### 14.6 SessionResultCard
Root: `app-card mt-4 overflow-hidden print-worksheet`.
Header: `bg-petrol-700 p-5 !text-white` containing:
- eyebrow `text-[11px] font-bold uppercase tracking-widest opacity-80`
- title `mt-1 text-xl font-extrabold md:text-2xl`
- arabicTitle `mt-0.5 dir=rtl font-arabic text-sm opacity-85 text-start`
- meta line `mt-2 text-sm opacity-85`: 🎬 film · watch link underline · • duration
- focus badge top-right via header flex: `rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold` (only when preset used)
Body: `p-4 space-y-4`.

VideoPreview facade:
```
<button class="group relative block aspect-video w-full overflow-hidden rounded-lg
               border border-mist-200 dark:border-mist-700" aria-label={watchPreview}>
  <img src=poster class="absolute inset-0 h-full w-full object-cover" loading="lazy" alt=""/>
  <span class="absolute inset-0 grid place-items-center">
    <span class="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-xl text-white
                 transition-colors group-hover:bg-petrol-700">▶</span>
  </span>
</button>
<p class="mt-1 text-xs opacity-60">{watchPreview} · {openExternal link}</p>
mounted iframe swaps facade in-place (same box), allowFullScreen,
src=https://www.youtube-nocookie.com/embed/<id>
```

TimingStrip:
```
ok:   role=status class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold
      bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
warn: swap emerald→amber pairs; icon ⚠️; text timingMismatchWarn
hidden entirely when result absent.
```

ActivityItem (li):
```
<li class="group relative rounded-xl border border-mist-200 p-4 transition-shadow
           hover:shadow-md dark:border-mist-700 {busy && 'animate-pulse'}">
  <div class="flex items-start gap-2">
    <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-petrol-700
                 text-xs font-bold text-white">{n}</span>
    <h4 class="min-w-0 flex-1 text-sm font-bold">{title}</h4>
    <div class="flex gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100
                md:focus-within:opacity-100 no-print">
      <button class="h-8 w-8 grid place-items-center rounded-lg text-sm
                     hover:bg-mist-100 dark:hover:bg-mist-800" aria-label={editActivity}>✏️</button>
      <button …aria-label={copyActivity}>📋</button>  // success: shows ✓ 1200ms
    </div>
  </div>
  <p class="mt-1 text-sm italic opacity-80">{goal}</p>
  <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-80 no-print">
    <span>🕒 {timingMin}</span><span>👥 {grouping}</span>
  </div>
  <p class="mt-2 border-s-2 border-brass-300 ps-3 text-sm leading-relaxed dark:border-brass-700">{prompt}</p>
  {arabicHint && <p dir=rtl class="font-arabic mt-1 text-start text-sm leading-loose opacity-90 ps-3">{arabicHint}</p>}
  <p class="mt-2 text-xs opacity-70">🧩 {skillsLabel}: {skill_focus.join(', ')}</p>
  <p class="mt-1 text-xs opacity-70">{expectedOutputLabel}: {expected_output}</p>
  {editing===n && <ActivityInlineEditor/>}
</li>
```
Number badges continue petrol (not brass) so actions read as accents.

Inline editor (F-D):
```
<div class="mt-3 rounded-lg bg-mist-100 p-3 dark:bg-mist-800 no-print">
  <label class="text-xs font-bold uppercase tracking-wide opacity-60 sr-only">{editInstructionPh}</label>
  <textarea class="input-base min-h-[72px]" placeholder={editInstructionPh}
            value maxLength=300 onKeyDown Esc=>cancel />
  <div class="mt-2 flex flex-wrap gap-1.5">  // quick chips (xs pills)
    chipEasier · chipForPairs · chipAddArabicHints · chipMoreFormalShort · chipLonger
  </div>
  <div class="mt-2 flex justify-end gap-2">
    <button btn-secondary px-3 py-1.5 text-sm>{cancelEdit}</button>
    <button btn-primary  px-4 py-1.5 text-sm disabled={!instruction||busy}>{runEdit}</button>
  </div>
</div>
```
Quick-chip click appends template phrase into textarea (never auto-runs).

PublishBar:
```
<div class="mt-4 flex flex-wrap items-center gap-2 no-print">
  <button class="btn-primary min-h-[44px] flex-1" disabled={published||busy}>📅 {createSessionFromDraft}</button>
  <button class="btn-secondary h-[44px] px-4" aria-label={printWorksheet}>🖨️</button>
  <div class="relative"> ⋯ kebab → popover: rename / duplicate / delete(red) </div>
</div>
after publish success: button label swaps to sessionCreatedOk state (disabled, ✓).
```

### 14.7 DraftsMenu popover
Wrapper on trigger `relative`. Panel:
```
<div role="menu" class="absolute end-0 z-20 mt-2 w-72 rounded-xl border
     border-mist-200 bg-white p-2 shadow-lg dark:border-mist-700 dark:bg-mist-900">
  header row: <p class="px-2 pb-1 text-xs font-bold uppercase tracking-wide opacity-60">{draftsTitle}</p>
  {drafts.map(row)} or empty: <p class="px-2 py-4 text-sm opacity-60">{emptyDrafts}</p>
  footer: ＋ New draft full-width ghost button
</div>
row: <div role="none" class="flex items-center gap-1 rounded-lg px-1 hover:bg-mist-100 dark:hover:bg-mist-800">
  <button role=menuitem class="min-w-0 flex-1 text-start rounded-md px-2 py-2">
    <span class="block truncate text-sm font-medium">{title}{active && ' •'}</span>
    <span class="block text-[11px] opacity-50">{relTime}{hasResult? ' · 🎬':''}</span>
  </button>
  <button kebab h-8 w-8 …>⋯</button>
</div>
kebab opens inline action trio (rename/dup/delete) replacing row content;
delete → confirm mini-row [Delete?][Yes red][No].
rename → input input-base h-7 text-sm (Enter commit / Esc cancel / blur commit).
relTime: minutes/hours/days compact via i18n templates relMin/relHour/relDay/relNow.
```
Panel uses logical `end-0` (RTL-safe) — supersedes the §13 note; physical
right-0 exception retired.

### 14.8 Toast/completion (F-O) & misc
- Completion = phase row prefixed ✅ (`sessionReady`) using 14.5 phase style.
- Publish success reuses existing `sessionCreatedOk` sentence verbatim.


## §15 Interaction, Motion & Accessibility

### 15.1 Interaction matrix
| Trigger | Response | Token |
|---|---|---|
| Any button hover | existing btn hover bg only | micro |
| Chip select (level/focus) | instant color swap, no transform | — |
| Result card first appear | fadeInUp 180ms | enter |
| Editor expand | mount + fadeInUp 240ms | expand |
| Video facade → iframe | same-box swap + fadeIn 240ms | expand |
| Activity edited OK | cross-fade content 120ms out/in | micro+enter |
| Copy clicked | icon → ✓ 1200ms then revert | micro |
| Busy activity | animate-pulse on that li only | ambient |
| Draft row hover | bg mist-100/800 | micro |
| Popover open | scale .98→1 opacity 0→1 120ms origin-top | micro |

### 15.2 Reduced motion
All decorative classes paired with `motion-reduce:animate-none
motion-reduce:transition-none`. Skeleton pulse allowed to remain (opacity
pulse is non-vestibular), but busy-card pulse also disabled under
motion-reduce for consistency.

### 15.3 Keyboard map (F-K)
| Key | Scope | Action |
|---|---|---|
| Ctrl/⌘+Enter | composer textarea focused | submit generate |
| Esc | inline editor open | cancel edit |
| Esc | popover open | close popover, focus returns to trigger |
| Esc | settings modal | existing Modal behavior |
| / | global, no text field focused | focus composer |
| Tab | everywhere | natural DOM order; menu traps while open |
Focus return contract: every closer (Esc/outside/action) restores focus to
its trigger element.

### 15.4 ARIA requirements
| Element | Requirement |
|---|---|
| Composer textarea | aria-label = suggestNextSession (as today) |
| Send button | aria-label submit; visible ➤ glyph decorative |
| ChatStream container | aria-live="polite" (phase/error announcements) |
| TimingStrip | role="status" |
| Drafts trigger | aria-haspopup="menu" aria-expanded |
| Menu panel/items | role="menu"/"menuitem"; kebab submenu role="menu" |
| Inline editor textarea | sr-only label + placeholder; maxLength=300 announced via desc |
| Icon-only buttons (✏️📋🖨️⋯) | aria-label each (editActivity/copyActivity/printWorksheet/draftActions) |
| Video facade | <button> with aria-label watchPreview; iframe gets title= film |
| Level/preset chips | aria-pressed reflects selection |

### 15.5 Performance & layout stability
- Facade pattern ⇒ zero YouTube JS/CSS until user opts in.
- Poster img: explicit aspect-video box ⇒ no CLS; loading=lazy decoding=async.
- Autosave debounce 1200ms + flush points (§6.8) keeps write amplification low.
- Transcript cap 200 rows (slice before persist).
- No new top-level deps; everything from existing stack.

---

## §16 RTL, Arabic Typography & Print

### 16.1 Logical property rules (hard)
1. Spacing: ms-/me-/ps-/pe- exclusively; ml-/mr-/pl-/pr- banned in new code.
2. Text align: text-start / text-end only.
3. Inset positioning: start-0/end-0 (popover uses end-0 per §14.7).
4. Borders directional: border-s-2 for prompt quote rail.
5. Rounded corners on bubbles use rtl: variants for the tail corner.
6. Physical classes allowed ONLY inside @media print block (LTR handout).

### 16.2 Arabic rendering rules
- arabicTitle / arabicHint / AR editor chips: `dir="rtl" font-arabic
  text-start`; hint blocks get `leading-loose`.
- UI chrome strings come from t() and inherit document dir — no extra dir
  attributes needed on buttons/labels.
- Numerals stay Latin digits (consistent with existing i18n corpus).
- Mixed EN prompt + AR hint inside one activity renders as separate <p>s —
  never bidi-interleaved in one line.

### 16.3 Print stylesheet (F-G) — full spec
```css
@media print {
  .no-print, header.app-header, nav, .composer-sticky { display:none !important }
  body { background:#fff !important }
  .print-worksheet { box-shadow:none !important; border:none !important;
                     max-width:100% !important; margin:0 !important }
  .print-worksheet * {
    color:#000 !important; background:transparent !important;
    border-color:#cbd5d3 !important; opacity:1 !important }
  .print-worksheet header { background:#fff !important; padding-left:0 }
  .print-worksheet .activity-item { break-inside:avoid; margin-bottom:10mm }
  .print-worksheet a[href]::after { content:" (" attr(href)")";
                                    font-size:9pt; word-break:break-all }
  .print-footer::after { content:" — " attr(data-print-meta);
                         display:inline-block; margin-top:6mm;
                         font-size:9pt; opacity:.65 }
  @page { margin:14mm }
}
```
Class hooks added in markup: result root `print-worksheet`, every li gets
`activity-item`, footer strip `print-footer data-print-meta="{title} · {date}"`,
all controls already carry `no-print`. Print forces light ink even in dark
mode (transparent bg + black text above).

### 16.4 Design-gate mapping (02-design-system-checklist.md)
| Gate row | Where satisfied |
|---|---|
| Palette discipline | §12.1 (three families + semantics only) |
| Touch targets ≥40px | §12.3 + every button spec |
| Dark mode parity | dark: pairs listed in every §14 block |
| Focus visibility | §12.4 ring rule; never removed |
| No CLS | §15.5 fixed aspect boxes |
| Bilingual completeness | i18n key inventory Appendix E (EN+AR) |
| RTL logical utilities | §16.1 audit list |
| Reduced motion | §15.2 pairing rule |
| Semantic headings | h3 card title / h4 activities (single h-level walk) |
| Contrast AA | §12.1 rule 2 |
| Icon-only labeling | §15.4 table |
| Print quality | §16.3 |

---

# APPENDIX D — Engineering Detail Sheets (feature deep-dives)

## D.1 Transcript message schema (client + persisted)
```ts
interface TranscriptMsg {
  id: number            // monotonic per draft (msgId ref)
  role: 'sys' | 'user'
  kind: 'phase' | 'err' | 'user' | 'ok'
  text: string          // already-localized at render time? NO — store KEY+vars
  key?: string          // i18n key when templated
  vars?: Record<string, string|number>
  raw?: string          // literal text (e.g., user echo, chip label snapshot)
  at: string            // ISO ts
}
```
Why key+vars: language switch after resume must re-translate history.
Rendering rule: if `key` present → t(key, vars); else raw.
Phase sequence stored exactly like live flow so restored stream looks
identical (L13 parity across reloads).

## D.2 Autosave scheduler (F-A/F-J precise behavior)
```
dirty fields: transcript.length | last msg id | result ref | title |
              level | focus_preset
on mutation → mark dirty, schedule flush(1200ms debounce)
flush(): PUT ai_chat_sessions {transcript?,result?,title?,level?,focus_preset?,
         updated_at: now()}
success → badge 'saved' 1500ms then hide
failure → badge amber 'draftSaving' persists w/ ⚠; retry backoff 2s/5s/10s
flush triggers (immediate): generate ok · editActivity ok · publish ·
  visibilitychange hidden · beforeunload (sendBeacon-style best effort)
new-draft creation: createDraft(seed) FIRST → get id → set sessionId →
  subsequent mutations patch that row. If createDraft fails (offline):
  queue seed locally (memory) and retry on next successful flush.
```

## D.3 Resume algorithm (F-B mount path)
```
mount → parallel: loadStatus() + listDrafts()
if drafts nonempty:
   pick drafts[0] (newest) → openDraft(id) → hydrate transcript/result/
   level/preset/title → push sys phase 'draftResumed' ({title})
else → pristine empty state (hero visible)
Never auto-resume a draft whose result exists but transcript empty? —
resume anyway; stream shows only result (valid state).
```

## D.4 Edit-mode splice guarantee (F-D correctness)
Server instructed to echo untouched activities verbatim (§5.2); client does
NOT trust it blindly:
```
const next = structuredClone(result)
next.activities[idx] = resp.result.activities[idx]
// other indexes intentionally NOT copied from response
validateResult(next) must pass (full-object validator) else typed error,
result unchanged.
```
This makes immutability of siblings a client invariant, not a prompt hope.

## D.5 Curated film library (v5 prompt block — Phase 3 pins final IDs)
Starter set (verify each ID resolves to public embeddable watch page before
pinning; replace any dead entry; keep 10–14 entries):
Alike · The Present · Piper · Cuerdas · Soar · Hair Love · Mr Indifferent ·
Take Me Home · One-Minute Puberty · Changeover · The Beauty · Zero.
Prompt instructs: default pool = library; may propose outside film ONLY if
user names it explicitly (then URL null unless known-stable).

## D.6 Publish flow (L17 preserved + hardening)
Same insert columns as today; additions:
- disable button during insert (busy guard),
- success → swap button to ✓ sessionCreatedOk disabled + transcript 'ok' row,
- failure → typed error row (network) keeping button enabled.
Title used for sessions.title = draft title if user renamed, else model title
(existing behavior order preserved).

## D.7 Demo backend emulation notes
- Table registry += 'ai_chat_sessions' with Map<uuid,row>.
- Owner stamped from current demo profile; staff demo accounts satisfy RLS.
- updated_at ordering identical; limit 50 enforced.
- update-ai-key & generation honest failures unchanged (L20/L21).

---

# APPENDIX E — Verification Scripts & i18n Inventory

## E.1 Manual smoke script (Gate G5/G7 runbook)
1. Fresh incognito → login staff → AI room: hero visible, no console errors.
2. Type request → phases stream → result appears → autosave badge cycle.
3. Refresh mid-page: draft restored incl. transcript + result (A1).
4. Second browser profile: same account → draft present (A2).
5. Rename draft → reflected in menu + after reload (A3).
6. Duplicate → independent edits don’t leak (A5).
7. Delete → gone; reopen old link id → graceful “not found” new-draft fall.
8. Each level pill + each preset chip → regenerate once (A11 emphasis diff).
9. ✏️ edit activity 2 “for pairs” → only #2 changes (A13); others byte-same
   (verify via JSON.stringify diff pre/post excluding [2]).
10. 📋 copy → paste check format; ✓ tick shows (F-H).
11. Video facade → plays nocookie; collapse; non-YouTube fallback (E09).
12. Timing strip: force mismatch by editing? (model-side) — verify warn path
    by temp fixture draft (dev-only seed) (A14).
13. 🖨 print preview → clean worksheet, no chrome, URLs footnoted (A15).
14. Publish → sessions row created (+2d, Virtual) → button ✓ (A10).
15. Remove key → generation → errNoApiKey verbatim (A8/E01).
16. Restore key (paste) → works again; last4 updates (L05–L07).
17. Model switch → next generation uses it (header line updates).
18. RTL pass: toggle language ar → screenshots composer/bubbles/menu/editor.
19. Keyboard-only: / focus, Ctrl+Enter send, Esc cascade, tab through all.
20. Demo env (no env vars): full CRUD works; generation honest-fails (F-P).

## E.2 SQL probes (Gate G1)
```sql
-- as staff owner
select count(*) from ai_chat_sessions;            -- own rows visible
-- as different staff (set-role test or second user)
insert into ai_chat_sessions(owner) values ('<other-uuid>'); -- should violate WITH CHECK when targeting foreign owner
-- as anon
select count(*) from ai_chat_sessions;            -- permission denied / 0
```

## E.3 i18n key inventory (add BOTH en + ar; names frozen here)
Persistence/library: draftSaved, draftSaving, draftsTitle, newDraft,
  openDraftAria, emptyDrafts, untitledDraft, draftResumed, draftRenamed,
  draftDuplicated, confirmDeleteDraft, yesDelete, keepIt,
  relNow, relMin, relHour, relDay.
Video: watchPreview, hidePreview, openExternal.
Inline editor: editActivity, editInstructionPh, runEdit, cancelEdit,
  activityUpdated, chipForPairs, chipAddArabicHints, chipLonger,
  chipMoreFormalShort (chipEasier reuses legacy err? no—new short chip).
Timing: timingSumLabel, timingMismatchWarn, timingOkLabel.
Presets: focusLabel, focusSpeaking, focusGrammar, focusVocab, focusDebate,
  focusCulture, focusExam.
Misc: printWorksheet, copyActivity, copiedTick, sessionReady,
  shortcutsHint, draftActions, renameDraft, duplicateDraft, deleteDraft.
Count ≈ 38 keys × 2 languages.

## E.4 Rollback playbook
| Layer | Rollback action |
|---|---|
| gemini fn v5 | redeploy prior version id (kept in deploy history) |
| update-ai-key v3 | redeploy v2 (upsert fix backward-compatible anyway) |
| Frontend | git revert ship commit; Netlify auto-redeploys |
| Migration 0003 | additive; leave in place (harmless if unused) |

## E.5 Tracker touchpoints on completion
- 00-INDEX.md F7 row: append rebuild note + date.
- This file header Status → SHIPPED (date + commit hash).
- PR description links §10 checklist with all boxes ticked.

— END OF PLAN —

# APPENDIX F — Visual Design Deep-Dive (making it beautiful)

## F.1 Design intent statement
The AI Chat Room should feel like a **calm professional studio**, not a
chat-toy: quiet neutral surfaces, one confident brand moment (petrol result
header), brass used sparingly like a highlighter. Every screen answers three
questions in one glance: *What stage am I in? What can I do next? Is my work
safe?* Beauty here = clarity + restraint + rhythm, not decoration.

## F.2 The three visual layers
| Layer | Treatment | Examples |
|---|---|---|
| Canvas | near-invisible: page bg, app-cards | header card, result body |
| Instrument | bordered, tactile: things you operate | chips, buttons, editor |
| Spotlight | saturated brand: outcomes & identity | petrol header, num badges, user bubbles |

Rule: instrument elements never use spotlight colors for idle states; the eye
should land on petrol only where value was produced.

## F.3 Vertical rhythm map (desktop reference)
```
 16px  banner
 16px  header card (64–88px tall)
 16px  level row   (36px)
 12px  focus row   (40px)
 16px  stream begins…
 …     rows gap 6px; groups separated by natural content
 16px  result card
 16px  composer zone (sticky, 56px + safe area)
```
Consistent 4/8 multiples; nothing odd-numbered; breathing room doubles
around state changes (before/after busy periods) via `mt-4` anchors.

## F.4 Header card anatomy (the “cockpit”)
- Left block is identity: key emoji + bold label; status lines quiet below.
- Right cluster is action: drafts (library) then settings (config) — order
  communicates frequency-of-use.
- Save badge sits BETWEEN blocks vertically centered: it reports on the
  whole draft, belonging to neither control.
- Wrap behavior on narrow screens: controls drop to second row aligned
  start (justify-between keeps left block honest).

## F.5 Chip system hierarchy (three families, one geometry)
| Family | Idle | Active | Meaning |
|---|---|---|---|
| Level | mist fill | petrol solid | context of audience |
| Focus | mist fill + emoji | brass tint + brass ring | intent of session |
| Quick actions | mist fill | (momentary) hover darken | commands |
Shared: same radius/height/typography → family identified by COLOR alone,
reducing cognitive load; never mix families in one row.

## F.6 Chat stream visual grammar
- Reading gravity: system phases hug start (they’re the machine’s voice),
  user bubble hugs end (your voice) — mirrored automatically in RTL.
- Phase rows are full-width soft slats (not bubbles): they’re timeline, not
  dialogue.
- Error slats share phase geometry but red-washed: shape consistency lets
  color carry urgency without layout jump.
- Timestamps omitted in-stream (noise); relative time lives in drafts menu.

## F.7 Result card — the hero treatment
- Petrol header = the single loudest element on the page; earns it by being
  the product’s output.
- Inside header, hierarchy: eyebrow (whisper) → title (shout) → arabicTitle
  (respectful echo, slightly transparent) → meta line (utility).
- White-on-petrol badge for focus preset floats top-right like a stamp.
- Body sections ordered by verification flow: watch → trust (timing) →
  work (activities) → act (publish). Top-down narrative of a teacher’s night.

## F.8 Activity cards — scannability engineering
- Number badges create a spine down the list; eyes track ①→④ even when
  scanning casually.
- Prompt text gets the ONLY brass rail in the card: the pedagogical core
  deserves the accent.
- Meta chips row uses icon+text pairs at xs size — glanceable, ignorable.
- Hover reveals ✏️📋 on desktop but ALWAYS visible on touch (`md:` gating):
  discoverable everywhere, calm on big screens.
- Busy pulse affects one card only — locality of feedback.

## F.9 Editor-in-card (F-D) styling rationale
- Sunken mist background = “inside the item” feeling vs floating modal.
- Quick-chips are suggestion affordances: xs pills, tappable to INSERT text
  (never auto-run) — teaches prompt-writing without risk.
- Run button petrol (primary), Cancel ghost: destructive-safe pairing.
- Char budget enforced silently at 300 with native maxLength (no counter
  clutter; instructions are short by nature).

## F.10 Empty state art direction
- Single 🎬 glyph at display size (text-5xl), centered, opacity-80.
- Headline speaks outcome (“Design a workshop…”), sub-copy explains loop.
- Shortcut footnote in mono-ish opacity-50 — a small craft wink.
- No illustration assets shipped (bundle discipline); typography-led.

## F.11 Dark mode specifics beyond token parity
- Poster images get `brightness-[.92]` overlay in dark to avoid glare.
- Video facade border stays hairline (no glow).
- User bubble shifts petrol-700→600 (not 500) to preserve AA with white text.
- Skeletons darken two steps, keep pulse subtle.
- Print styles force light regardless (§16.3) — intentional override.

## F.12 Microcopy voice (bilingual tone guide)
- System phases: present continuous, no period (🔍 Searching…).
- Errors: complete sentences, responsibility-free, always next-step-able.
- Buttons: verb-first, ≤3 words EN (≤2 words AR typical).
- Confirmations: name the object (“Delete this draft?”) never “Are you sure?”.
- Empty states teach one thing only.
AR mirrors meaning, not word order; reviewed against existing corpus style
(e.g., إعدادات غرفة الذكاء الاصطناعي register).

## F.13 Responsive breakpoint behaviors
| Breakpoint | Changes |
|---|---|
| <sm | chips strips bleed-scroll; header wraps; composer sticky always |
| sm–md | identical, wider gutters |
| ≥md | hover-reveal actions active; video capped 360px; popover width fixed 288px; sticky composer only if content shorter than viewport |
| print | §16.3 transformation |

## F.14 States matrix (every component × every state)
Component states implemented and styled: default / hover / focus-visible /
active(pressed via translate? NO — bg deepen only) / disabled(opacity-50 +
not-allowed cursor) / loading(spinner glyph or pulse) / success(✓ swap) /
error(text pair swap). No skeleton exists for settings modal (opens fast,
local data).

## F.15 Iconography rules
Emoji-only (existing product language): 📚⚙️🔑✏️📋🖨️⋯🎬📅🕒👥🧩⚠️▶️➤✅.
One glyph per control; never two decorative emojis adjacent; aria-labels
carry meaning (emoji treated as visual, not semantic, content).

## F.16 Anti-pattern blacklist (review gate)
- No spinners replacing whole pages (locality only).
- No alert() outside legacy keyInvalid path.
- No new grays/blues; no gradients; no box-shadow stacking.
- No auto-carousels/auto-play media.
- No placeholder-only required fields.
- No dead buttons (every control wired or absent).

# APPENDIX G — Visual QA Checklist (Gate G6 worksheet)
- [ ] Light+dark screenshots: empty / generating / result / editor open /
      menu open / error visible — 12 shots archived in PR.
- [ ] RTL screenshots same 6 states (ar locale).
- [ ] Contrast spot-check: amber warn strip text, muted meta on sunken bg.
- [ ] 320px viewport: no horizontal scroll except intended chip strips.
- [ ] Focus ring visible on every interactive element tab-walk.
- [ ] Reduced-motion OS setting: no transform animations fire.
- [ ] Print preview: 2-page max for typical draft; URLs legible.
- [ ] Long-content stress: 200-char titles truncate ellipsis; 600-char
      prompts wrap cleanly; AR hint long-line wraps under rtl.
- [ ] Draft menu with 50 items scrolls internally (max-h + overflow-auto:
      `max-h-[60vh] overflow-y-auto` added to panel spec §14.7).
- [ ] Composer disabled during ALL network ops; ➤ becomes ⏳ glyph.
- [ ] No console warnings (keys, a11y, React) across full walk.

— TRUE END OF PLAN —

# APPENDIX H — Implementation Worksheets (execution aids)

## H.1 File-by-file change manifest
| # | File | Action | Key touchpoints |
|---|------|--------|-----------------|
| 1 | supabase/migrations/0003_ai_chat_sessions.sql | CREATE | §4.1–4.4 verbatim |
| 2 | supabase/functions/update-ai-key/index.ts | EDIT ×2 | set & set_model → upsert (§5.1) |
| 3 | supabase/functions/gemini-movie-session/index.ts | REWRITE | v5 spec §5.2: no tools, 45s, multi-part join, edit_mode fields, splice-safe validator unchanged |
| 4 | supabase/functions/gemini-movie-session/system-prompt.txt | REWRITE | §5.3 skeleton + D.5 curated library |
| 5 | src/lib/types.ts | APPEND types | TranscriptMsg, AiChatSessionRow, DraftMeta, FocusPreset |
| 6 | src/lib/constants.ts | APPEND | GEMINI_FOCUS_PRESETS (6 entries) |
| 7 | src/lib/ai-chat.ts | CREATE | §6.8 API surface |
| 8 | src/lib/demo/backend.ts | EDIT | ai_chat_sessions Map CRUD (D.7) |
| 9 | src/components/ai/SettingsModal.tsx | CREATE | from old modal JSX (L04–L09) |
| 10 | src/components/ai/ChatStream.tsx | CREATE | rows/skeletons/hero (14.5) |
| 11 | src/components/ai/DraftsMenu.tsx | CREATE | popover (14.7) |
| 12 | src/components/ai/SessionResultCard.tsx | CREATE | header/video/timing/list/publish |
| 13 | src/components/ai/VideoPreview.tsx | CREATE | facade (14.6 block) |
| 14 | src/components/ai/ActivityItem.tsx | CREATE | card + actions |
| 15 | src/components/ai/ActivityInlineEditor.tsx | CREATE | editor (14.6 editor block) |
| 16 | src/views/AiChatRoomView.tsx | REWRITE | orchestration only (§6.1, §7) |
| 17 | src/lib/i18n.ts | EDIT ×2 sections | E.3 inventory EN+AR |
| 18 | index.html or global css | EDIT | print styles §16.3 + fadeInUp keyframe |
| 19 | implementation-plan/00-INDEX.md | EDIT | F7 row note |

## H.2 i18n value table (freeze at implementation)
| key | EN | AR |
|---|---|---|
| draftSaved | Saved ✓ | تم الحفظ ✓ |
| draftSaving | Saving… | جارٍ الحفظ… |
| draftsTitle | Drafts | المسودات |
| newDraft | ＋ New draft | ＋ مسودة جديدة |
| openDraftAria | Open draft | فتح المسودة |
| emptyDrafts | No saved drafts yet. | لا توجد مسودات محفوظة بعد. |
| untitledDraft | Untitled draft | مسودة بدون عنوان |
| draftResumed | 📂 Resumed “{title}” | 📂 تمت استئناف «{title}» |
| draftRenamed | ✏️ Renamed to “{title}” | ✏️ تمت التسمية إلى «{title}» |
| draftDuplicated | ⧉ Draft duplicated | ⧉ تم نسخ المسودة |
| confirmDeleteDraft | Delete this draft? | حذف هذه المسودة؟ |
| yesDelete | Delete | حذف |
| keepIt | Keep | إبقاء |
| relNow | just now | الآن |
| relMin | {n}m ago | قبل {n} د |
| relHour | {n}h ago | قبل {n} س |
| relDay | {n}d ago | قبل {n} ي |
| watchPreview | Watch preview | معاينة الفيلم |
| hidePreview | Hide video | إخفاء الفيديو |
| openExternal | open in YouTube | فتح في يوتيوب |
| editActivity | Edit with AI | تعديل بالذكاء الاصطناعي |
| editInstructionPh | e.g. make this a pair debate… | مثال: اجعلها مناقشة ثنائية… |
| runEdit | Apply | تطبيق |
| cancelEdit | Cancel | إلغاء |
| activityUpdated | ✏️ Activity {n} updated | ✏️ تم تحديث النشاط {n} |
| chipForPairs | for pairs | للثنائيات |
| chipAddArabicHints | Arabic hints | تلميحات عربية |
| chipLonger | longer | أطول |
| chipMoreFormalShort | formal | رسمي |
| timingSumLabel | Σ {sum} min · total {total} min | المجموع {sum} د · الإجمالي {total} د |
| timingMismatchWarn | Activities don’t add up to the total. | مجموع الأنشطة لا يطابق الإجمالي. |
| timingOkLabel | Timing adds up ✓ | التوقيتات متسقة ✓ |
| focusLabel | Focus | التركيز |
| focusSpeaking | 🗣 Speaking | 🗣 محادثة |
| focusGrammar | 🧩 Grammar | 🧩 قواعد |
| focusVocab | 📚 Vocabulary | 📚 مفردات |
| focusDebate | ⚔️ Debate | ⚔️ جدال |
| focusCulture | 🌍 Culture | 🌍 ثقافة |
| focusExam | 📝 Exam prep | 📝 استعداد لاختبار |
| printWorksheet | Print worksheet | طباعة ورقة العمل |
| copyActivity | Copy activity | نسخ النشاط |
| sessionReady | ✅ Session ready. | ✅ الجلسة جاهزة. |
| shortcutsHint | Ctrl+Enter to send · / to type · drafts autosave | Ctrl+Enter للإرسال · / للكتابة · تُحفظ المسودات تلقائيًا |
| draftActions | Draft actions | إجراءات المسودة |
| renameDraft | Rename | إعادة تسمية |
| duplicateDraft | Duplicate | نسخ |
| deleteDraft | Delete | حذف |
(legacy keys reused: chipEasier exists as err-free label? legacy uses
chipMakeEasier sentence chip; short chipEasier added here too.)

## H.3 Contract examples (copy into test fixtures)
Mode-2 request:
```json
{ "user_message":"", "workshop_level":"Intermediate",
  "chosen_movie":"The Present", "prior_result":{ "...full prior object..." },
  "edit_activity_index":1,
  "edit_instruction":"make it suitable for pairs and add arabic hints" }
```
Mode-2 success (client splices [1] only):
```json
{ "ok":true, "result":{ "candidates":[], "session":{...}, "activities":[a,b',c,d] } }
```
Failure envelope (all typed errors):
```json
{ "ok":false, "error_code":"AI_UNAVAILABLE" }
```

## H.4 Phase log (fill during execution)
```
Phase 0 baseline:   [ ] date ____ commit ____
Phase 1 migration:  [ ] applied ____ policy-matrix pass ____
Phase 2 upsert fn:  [ ] deployed v__ smoke ____
Phase 3 movie fn:   [ ] deployed v__ fixtures ____
Phase 4 data layer: [ ] typecheck ____
Phase 5 UI rebuild: [ ] build ____ preserve-audit L01–L23 ____
Phase 6 polish:     [ ] gate G6 ____
Phase 7 ship:       [ ] pushed ____ prod smoke ____
```

## H.5 Prompt placeholder contract (v5)
Placeholders replaced by function before send:
{{user_message}} {{workshop_level}} {{chosen_movie_or_null}}
{{prior_result_json}} {{edit_mode}} {{edit_index}} {{edit_instruction}}
Rules: prior_result_json omitted (empty string) on Mode-1 fresh runs;
edit_* filled ONLY in Mode-2 ("true"/index/"instruction"), else "false".
No other braces may appear in prompt body (escape JSON examples with ❴❵
if ever needed — currently schema block uses plain quotes, safe).

## H.6 Component prop sheets (freeze before coding)
```
SettingsModal
  open:boolean onClose():void status:AiSettingsStatus|null busy:boolean
  onSaveKey(e:React.FormEvent):void onSaveModel(m:string):void
  onRemove():void

ChatStream
  msgs:TranscriptMsg[] busy:boolean showSkeleton:boolean
  hasContent:boolean            // controls hero visibility

SessionResultCard
  result:MovieSessionResult presetLabel:string|null publishedFlag:boolean
  busy:boolean editingIdx:number|null
  onEdit(idx:number):void onCancelEdit():void onSubmitEdit(instruction:string):void
  onPublish():void onPrint():void onCopy(idx:number):void
  onRename(t:string):void onDuplicate():void onDelete():void

VideoPreview
  url:string|null title:string

ActivityInlineEditor
  busy:boolean onSubmit(instr:string):void onCancel():void

DraftsMenu
  open:boolean drafts:DraftMeta[] activeId:string|null busy:boolean
  onOpen(id:string):void onNew():void onRename(id:string,t:string):void
  onDuplicate(id:string):void onDelete(id:string):void onClose():void

lib/ai-chat.ts (module fns, all demo-aware)
  listDrafts/openDraft/createDraft/saveDraft/renameDraft/duplicateDraft/
  deleteDraft/extractYouTubeId/formatPlaintextActivity/sumTimings
```

## H.7 State variable map for the rebuilt view
| var | type | set by | consumed by |
|---|---|---|---|
| status | AiSettingsStatus\|null | loadStatus | header/settings |
| sessionId | string\|null | create/open/restore | ai-chat layer |
| draftTitle | string | hydrate/rename | card/menu/save |
| transcript | TranscriptMsg[] | push/hydrate | stream/save |
| result | MovieSessionResult\|null | generate/edit/hydrate | card/save/publish |
| level | 'Beginner'\|… | pills/hydrate | composer/save |
| preset | FocusPreset['id']\|null | chips/hydrate | composer/save/badge |
| busy | 'idle'\|'generating'\|'editing'\|'publishing' | ops | disabled states everywhere |
| editingIdx | number\|null | ✏️ click | card/editor |
| drafts | DraftMeta[] | listDrafts | menu |
| settingsOpen | boolean | gear/modal | modal |
| draftsOpen | boolean | 📚/outside/Esc | popover |
| saveState | 'clean'\|'dirty'\|'saving'\|'saved'\|'error' | scheduler | badge |

Derived: totalMin = result.session.duration_minutes; sumMin = Σ timing_min.

## H.8 Ordering guarantees (invariants asserted at review)
1. i18n key commit ⊇ keys referenced by same diff (no dangling t()).
2. Migration file ⊆ what was applied remotely (no drift) — verify post-apply.
3. Deployed fn version number strictly increases per deploy.
4. Preserve-list L01–L23 audited AFTER last UI edit, not before.
5. Pushes go to BOTH remotes; shipit is the Netlify source of truth.
6. Every error path leaves `result` untouched (append-only failures).

## H.9 Known trade-offs accepted (documented, revisit-later list)
- Curated library replaces live search: film freshness bounded by prompt
  maintenance (quarterly review suggested).
- Single-owner drafts: no co-editing (explicit out-of-scope §1.3).
- Transcript stores resolved chip labels as raw snapshots — switching UI
  language shows those historical rows in their original tongue (history,
  not live UI — acceptable).
- Print block uses physical CSS (paper is LTR) — documented exception.
- Demo persistence is per-browser only (honest local emulation).

## H.10 Post-ship follow-ups backlog (parked, not this rebuild)
1. Quarterly curated-film-library refresh (D.5) — owner: staff, 10 min.
2. Gemini usage dashboard row in F6 admin analytics once billing enabled.
3. Draft sharing (read-only link) if co-planning demand appears.
4. Student-facing companion chat — separate PRD amendment required.
5. Voice recording activities — needs MediaRecorder + storage decision.

## H.11 Glossary
| Term | Meaning |
|---|---|
| Draft | One ai_chat_sessions row: transcript + optional result |
| Transcript | Ordered chat messages incl. phase/ok/err markers |
| Preset | Focus chip id + its promptPrefix (F-E) |
| Mode-2 | Edge-function activity-edit request shape |
| Facade | Poster+button placeholder that lazily mounts the YT iframe |
| Preserve list | §2 legacy behaviours that must survive the rebuild |
| Splice guarantee | D.4 client-side immutability of sibling activities |

— TRUE END OF PLAN —






## H.12 Environment & deploy matrix (reference card)
| Target | Frontend | Functions | DB migration |
|---|---|---|---|
| Local dev (no .env) | npm run dev → demo mode | n/a (honest failures) | n/a |
| Local dev (.env real) | npm run dev | point VITE url at cloud | cloud already migrated |
| Production (Netlify) | git push shipit → auto build | npx supabase functions deploy … --project-ref poeskvwoyjmqvvzmtvws | dashboard SQL editor / db push |
Required env (prod): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
Gemini key lives in Vault (staff card), NOT env. No YouTube/OMDb needed.

## H.13 Smoke fixture: minimal valid result JSON (for dev seeds)
{"candidates":[],"session":{"title":"T","arabicTitle":"تجربة","film":"F",
 "description":"d","level":"Beginner","format":"Virtual",
 "duration_minutes":30,"link":""},
 "activities":[
  {"title":"a","goal":"g","timing_min":8,"grouping":"pairs","prompt":"p",
   "arabicHint":"تلميح","skill_focus":["communication"],"expected_output":"e"},
  {"title":"b","goal":"g","timing_min":7,"grouping":"individual","prompt":"p",
   "arabicHint":"","skill_focus":["communication","creativity"],"expected_output":"e"},
  {"title":"c","goal":"g","timing_min":8,"grouping":"groups","prompt":"p",
   "arabicHint":"","skill_focus":["communication"],"expected_output":"e"},
  {"title":"d","goal":"g","timing_min":7,"grouping":"whole class","prompt":"p",
   "arabicHint":"","skill_focus":["communication","critical thinking"],
   "expected_output":"e"}]}

— TRUE END OF PLAN —

## H.14 Sign-off block (complete at ship)
| Role | Name | Date | Notes |
|---|---|---|---|
| Implementer | ox-alpha | ____ | commit hash ____ |
| Product owner | user | ____ | accepted §10 walk |
Design gate G6 worksheet: Appendix G boxes all [x] in PR body.
Tracker updates done: 00-INDEX F7 row ☐ · this header Status ☐.

— TRUE END OF PLAN —
