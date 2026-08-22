# English Workshop Platform

Bilingual (English / Arabic RTL) web platform for Arabic-speaking English learners: sessions with QR check-in, live games, homework + anonymous peer review, breakout rooms, resource library, community chat, leaderboards, and an AI movie-session designer for staff. PWA, light/dark theme, points & streaks.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Supabase (Postgres + Auth + Edge Functions + Realtime) · PWA

## Quick start

```bash
npm install
npm run dev               # http://localhost:3000
```

No Supabase project yet? **It just works in Demo Mode**: a local emulator (browser localStorage) pre-seeded with content and test accounts. The login dialog offers one-click fill:

| Account | Email | Password |
|---|---|---|
| Staff (organizer) | `coach@demo.test` | `Passw0rd!` |
| Student | `omar@demo.test` | `Passw0rd!` |
| Student 2 / 3 (for peer review) | `layla@demo.test` / `youssef@demo.test` | `Passw0rd!` |

Demo mode notes: data lives only in your browser; reset any time from the devtools console with `EW_DEMO_RESET()`. The AI Chat Room shows its real "not configured" failure state in demo (there is no Gemini server locally); Groq-powered features fall back to the built-in question banks exactly as they would on a real outage.

### Connecting a real Supabase project

```bash
cp .env.example .env      # paste your project URL + anon key, restart dev server
```

Demo mode switches off automatically as soon as `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are present.

### 1. Create the database

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** → paste the whole of [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql) → Run
   (this creates every table **with RLS enabled in the same migration**, triggers, views, RPCs and seed content)

### 2. Configure auth (optional)

- Email+password works out of the box.
- For **Continue with Google**: enable the Google provider under Authentication → Providers and add your redirect URL.

### 3. Make yourself staff

Your first account is a `student`. Promote yourself via SQL (or later via Profile → 👑 Manage Roles as an admin):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Staff roles (`host` / `organizer` / `admin`) unlock announcements, session hosting, homework publishing, AI tools, analytics.

## Deploying Edge Functions

```bash
supabase functions deploy groq-generate gemini-movie-session update-ai-key
supabase secrets set GROQ_API_KEY=gsk_...       # weekly quiz + game questions + essay feedback (optional; fallback banks used without it)
supabase secrets set YOUTUBE_API_KEY=AIza...    # F7 film discovery (required for F7 search phase)
supabase secrets set OMDB_API_KEY=...           # F7 IMDb enrichment (optional; nulls tolerated)
```

The **Gemini key is different**: staff set/rotate/remove it at runtime from the AI Chat Room settings card. It lives in **Supabase Vault**, is validated before commit, and never reaches the browser or logs.

## Feature map (PRD §)

| Area | Where | PRD |
|---|---|---|
| Landing, Auth, Onboarding wizard | `LandingView`, `LoginModal`, `OnboardingWizard` | §2–4 |
| Announcements + AI weekly quiz | `AnnouncementsView`, `groq-generate` fn | §6 |
| Sessions, RSVP, QR check-in, Host panel, End Session | `SessionsView` | §7 |
| Games engine + 6 types incl. caption vote | `GamesView`, `games/engine.ts` | §8, §17.5 |
| Homework + anonymous peer review (staff see all) | `HomeworkView`, `submit_peer_review` RPC | §9, §17.1 |
| Calendar export (.ics + Google link) | `lib/calendar.ts` | §17.2 |
| Breakout rooms + shared Report control | `BreakoutRoomsView`, `TextChatStream`, `ReportButton` | §17.3 |
| Session ratings (anonymous aggregate) | `RatingCard`, `session_rating_aggregates` view | §17.4 |
| Resource library | `LibraryView` | §10 |
| Rankings | `RankingsView` | §11 |
| Community chat | `ChatView` | §12 |
| Profile, roles, streak-freeze shop | `ProfileModal` | §13 |
| Notifications (realtime) | `NotificationsDropdown` | §14 |
| Gamification (+100 answer, +20 check-in, freezes −25) | `record_checkin`, `award_game_points`, `grant_streak_freeze` RPCs | §15 |
| EN/AR RTL + dark mode | `lib/i18n.ts`, logical utilities throughout | §16 |
| AI Chat Room — Gemini Movie Session Designer (staff-only) | `AiChatRoomView`, `gemini-movie-session`, `update-ai-key` fns | §17.7 |
| Admin analytics dashboard | `AdminAnalyticsView`, `admin_*` views | §17.6 |

## Scripts

```bash
npm run dev         # dev server on :3000
npm run build       # typecheck + production build (PWA service worker generated)
npm run typecheck   # tsc --noEmit
npm run preview     # preview the production build
```

## Security notes

- RLS on every table from day one; capacity/self-vote/uniqueness enforced by DB triggers/constraints, not UI.
- Peer-review pairing computed server-side (security-definer RPC); students never receive author identities; staff aggregates shuffle notes to resist small-N deanonymization.
- All Edge Functions verify caller role from the JWT server-side — client guards are convenience only.
- Never put keys in this repo. Static secrets → `supabase secrets set`; rotatable Gemini key → Vault via the settings card.
