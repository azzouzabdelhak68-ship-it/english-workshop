# Shared Conventions

Applies to every feature in `features/`. Not repeated per-file — read this once.

## Confirmed vs. assumed stack

| Layer | Confirmed by PRD evidence | Status |
|---|---|---|
| Frontend | React + TypeScript (`.tsx` paths: `AnnouncementsView.tsx`, `SessionsView.tsx`) | Confirmed |
| Styling | Tailwind CSS (`tailwind.config.js`, `src/index.css`, CSS custom properties) | Confirmed |
| Backend | Supabase (Postgres + Auth + Edge Functions + Realtime + `profiles` table) | Confirmed |
| Existing AI | Groq (weekly quiz, §6) | Confirmed |
| Planned AI | Gemini `gemini-3.5-flash-lite` (§17.7 only) | Confirmed (PRD) |
| Offline | Custom `IndexedDB` wrapper `EnglishWorkshopDB` | Confirmed |
| PWA | Yes (`PWA v1.0` badge) | Confirmed |
| i18n | Custom, `src/lib/i18n.ts`, RTL via `dir` attribute | Confirmed |
| Build tool | Vite | **[ASSUMPTION]** — plausible from "npm run build" + dev server + PWA pattern, but verify `vite.config.ts` exists before treating as fact |
| Data fetching pattern | Hand-rolled `supabase-js` calls + `useState`/`useEffect`, optimistic local updates | **[ASSUMPTION]** — inferred from "optimistic update" language re: RSVP (§7). **Verify by reading an existing view file before adding a query library** — don't introduce React Query/SWR for new features if the rest of the app doesn't use one; that's an architectural inconsistency, not an improvement. |

## RLS-first rule

Every new table ships with `alter table ... enable row level security;` **in the same migration** that creates it. A table with RLS off between migrations is a live data-leak window in any environment where migrations apply asynchronously (multiple environments, replicas, CI). Never defer RLS to a follow-up migration, even "just for now."

## Secrets handling

- Never write API keys into migration files, seed data, committed `.env` files, or Edge Function source as literals.
- **Static** secrets (rotated rarely by a developer, not by staff at runtime) → `supabase secrets set KEY=value`, read via `Deno.env`.
- **User-rotatable** secrets (staff needs to replace/remove via UI without a code deploy — this is the Gemini key specifically, per §17.7) → Supabase Vault (`vault.create_secret` / `vault.decrypted_secrets`), never a plain table column, never a static env var. See `features/F7-ai-chat-room/01-database-and-secrets.md` for why the distinction matters here.
- Grep for the literal secret value in any Edge Function response before returning it, as defense-in-depth against accidental echo — cheap and catches a real bug class.

## Migrations

Use the Supabase CLI (`supabase migration new <name>`). Never hand-edit schema via the dashboard for anything durable — dashboard changes don't get captured in migration history, so they silently don't replay for other environments or for the next agent working from the repo. If the dashboard was used to prototype, port the result into a migration file before calling the task done.

## Realtime

Supabase Realtime (Postgres CDC channels) is already used for chat/notifications/announcements (§16). Reuse the same subscription pattern for new realtime needs (breakout room occupancy/messages, F3). Don't introduce a second realtime mechanism (Pusher, Ably, raw WebSockets) — that's a second thing to operate, monitor, and debug for no behavioral gain.

## i18n & RTL

- Every new user-facing string added in §17 goes into `src/lib/i18n.ts` (both languages) **before** merge, not as a follow-up — a feature that ships English-only breaks the platform's core bilingual promise (§1) silently until someone flips to Arabic and finds untranslated strings.
- RTL is not "flip float direction." Use Tailwind **logical** spacing utilities (`ms-`, `me-`, `ps-`, `pe-`) instead of physical ones (`ml-`, `mr-`, `pl-`, `pr-`) in any new layout — physical utilities don't flip with `dir="rtl"`, so a component built with them looks correct in English and silently breaks in Arabic. This only surfaces during the Arabic QA pass, which makes it easy to ship and forget.
- Icons that imply direction (arrows, chevrons) must mirror in RTL; icons that don't (bell, moon, star) must not. Check both in the same QA pass.

## Theme & palette

Use the existing petrol/mist/brass token scale (§18, `tailwind.config.js`) exclusively. Do not introduce new raw hex colors, and do not reintroduce bare `indigo-*`/`violet-*`/`purple-*` classes outside the documented backward-compat remap. Before pairing any new text/background combination, check it against the semantic CSS vars already defined — brass fails contrast on white (enforced navy text per §18); don't repeat that mistake with a new accent color pairing without checking WCAG AA at minimum.

## Points / streak economy

F1 (peer review) and F4 (session ratings) introduce actions that *could* earn points, symmetrical to +100/correct-answer and +20/check-in (§15). **The PRD does not specify point values for these — this is an [OPEN DECISION], not an oversight to fill in silently.** Default to 0 points awarded until a value is specified, and gate the amount behind a single named constant (e.g. `POINTS_PEER_REVIEW = 0`) so enabling it later is a one-line change, not a hunt through the codebase.

## Testing

- Components: Vitest + React Testing Library (or whatever the repo already uses — verify before adding a second test runner).
- RLS policies are the highest-risk regression surface in this plan (peer review anonymity, rating anonymity, breakout report visibility all depend on correct policies). Every new policy needs, at minimum, a **two-user test**: authenticate as user A, confirm user B's protected row/column is unreachable through every code path that touches it, not just the "obvious" one.
- Run against `supabase start` (local stack) for RLS tests, not against production.

## Git / PR conventions

One feature = one branch = one PR, mapped 1:1 to the `features/F*.md` files. PR description should list any **[ASSUMPTION]** or **[OPEN DECISION]** items the implementation depended on, so a human reviewer sees them without re-reading this whole plan.
