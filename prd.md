# English Workshop Platform — PRD

> **Status: specification only — nothing is implemented.** This PRD was carried over from an earlier project; no code from it is present in this workspace. It defines the full product scope: core features (§1–§16), approved next-build features (§17), and the design law (§18). Every section is a requirement to build, not a description of shipped code.

---

## 1. Overview
Centralized web platform for Arabic-speaking English learners. Replaces fragmented announcements (WhatsApp / Telegram / Facebook) with one bilingual hub for sessions, games, homework, resources, chat, and leaderboards. Free for workshop members. Mobile-first, bilingual (English / Arabic RTL), with light/dark theme.

---

## 2. Users & Access

**2.1 Unauthenticated visitor**
- Sees a public landing page with hero, feature previews, latest announcements (3), upcoming sessions (3), and a final CTA.
- Every action prompts Login.

**2.2 Authenticated roles**
- `student` — default learner.
- `host` / `organizer` / `admin` — staff roles (uniform permissions, checked via `isStaffRole`). Staff can post announcements, open the Host Session Control Panel, publish homework, upload resources, toggle Host Projector Dashboard, and generate AI content. Developer email can open Role Manager to change any member's role.

---

## 3. Authentication
- Email + password sign-up and login.
- Google OAuth (Continue with Google) when configured.
- Email verification required after sign-up before full access.
- Password reset via email link (request + confirmation states).
- Logout.
- Login presented as a modal over the public landing page.

---

## 4. Onboarding Wizard (first login, mandatory)
4-step full-screen wizard; progress bar `1/4 → 4/4`:
1. **Nickname** — creative display name for community (required, min 2 chars).
2. **Level** — Beginner / Intermediate / Advanced. `Not sure?` opens a single-question placement test (`"By the time we arrived, the movie ___"` → sets level to Intermediate).
3. **Avatar** — 10 emoji presets (👨‍🎓 👩‍🎓 🧑‍💻 👩‍🎨 🦁 🦊 🐼 🐯 🚀 ⭐).
4. **Learning Goals** — free-text goal (e.g. “Improve speaking confidence for work”) + checklist confirming profile ready.
- Finish saves profile and marks user as onboarded. Re-editable anytime via Profile.

---

## 5. Navigation & Shell

**Header (Navbar) — authenticated:**
- Brand logo + `PWA v1.0` badge + tagline.
- Language toggle (Globe) — English ↔ Arabic, flips `dir` and fonts.
- Dark mode toggle (Moon/Sun).
- Notifications bell with unread badge (count, `9+` cap) and dropdown.
- Profile chip (avatar + nickname + `points pts • 🔥 streak d` + streak-freeze count `🧊`) — opens Profile Modal.
- Logout button.

**Navigation tabs (desktop pill bar):** Announcements | Sessions | Live Games | Homework | Library | Rankings | Chat
**Mobile:** BottomNav (Home, Schedule, Games, Profile) with thumb-friendly layout.

**Header — public:** Same brand + language/dark toggles + Login button only.

---

## 6. Announcements — Central Board

- **Feed** of all announcements, newest first, realtime for new inserts.
- Each card shows: pinned badge, category pill, date, title, body, author name.
- Categories: `General` | `Event` | `Homework` | `Game Night` (color-coded).
- Pinned announcements have distinct border + ring.
- **Welcome banner** at top: `Welcome back, {nickname}!` + welcome message + (staff only) action row.
- **Post Announcement (staff only):** Title + Category (select) + Content → posts immediately, appears at top of feed.
- **Generate Weekly AI Quiz (staff only):** One-click Groq AI generation of English quiz questions with Arabic hints → on success posts a pinned `🤖 AI Weekly Quiz Ready for Review` announcement (`Game Night` category) and shows success/error banners.

---

## 7. Sessions — Schedule, RSVP & QR Check-in

- **Session cards** in a vertical list. Each card shows: level pill, format pill (`In-Person` | `Virtual` | `Hybrid`), checked-in badge with count, title, Arabic title, description, date • time • location • attendee count.
- **RSVP:** `+ RSVP Now` ↔ `✓ RSVP Confirmed` toggle per session. Optimistic update, increments/decrements attendee count. No capacity limit.
- **QR Check-in (student):** `Scan QR Check-in` opens a modal with a QR code (deep link `/#/checkin?session=<id>&t=<ts>`) and `Simulate Phone Camera Scan`. Scanning records attendance, shows `Attendance Verified! +20 Points` banner (also reachable via direct deep-link URL).
- **Host Session Control Panel (staff only, full-screen dark overlay):**
  - Large QR display for projector (260px, level H) + raw link.
  - Live stats: checked-in count, RSVP count, status `Live / Grace Open`.
  - Manual add: searchable list of all members (by name/nickname) with `Add` → `Checked In` per member; searched filter when typing.
  - Checked-in attendees as green pills below.
- **Actions per card:** `Join Virtual Link` button when `meetingLink` exists.

---

## 8. Live Games — 5-Second Hot Seat

Single game type specified for v1.

- **Lobby:** `Live Jump-in Waiting Lobby` card with `5-Second Hot Seat` title, description, and `Join & Enter Game Arena` button.
- **Countdown:** `Game Starting Soon` + large bouncing number (3 → 2 → 1) then auto-enters Playing.
- **Playing:**
  - Header: `Question X of N` + `Xs Hot Seat Timer` (counts down from 5, auto-submits on 0).
  - Question card with English prompt + Arabic hint `💡 تلميح:` when available.
  - Options grid (1–2 columns): selecting an answer locks all options, highlights correct (green) / wrong (red), fires confetti on correct (+100 pts), then advances after ~1.5s.
  - Built-in fallback question bank (3 demo questions on phrasal verbs/idioms/prepositions). If AI questions are loaded, they replace the bank.
- **Review / Game Completed:** `Awesome Job, {nickname}!` + points earned in this round + `Play Another Round` (resets to lobby).
- **Host Projector Dashboard (staff toggle):**
  - Dark full-width panel: `HOST PROJECTOR DASHBOARD — 5-Second Hot Seat`, students-active badge, 3 stat cards (Current Game, Round Status `Round X of N`, Top Player), `Start Game Round Now`, `Reset Game Lobby`, `Generate AI Questions` (with loading/error/loaded states).
- **AI Questions:** `Generate AI Questions` loads questions via Groq Edge Function; falls back to demo bank on failure.

---

## 9. Homework & Writing Submissions

- **List:** One card per assignment. Header: `Pending Submission` (amber) / `✓ Submitted` (emerald) + deadline + grade pill when graded + submission count badge (staff only).
- Card body: title, description, organizer feedback block (when present), `🔒 Anonymous Peer Review Active` badge when `peerReviewOpen`.
- **Student actions:**
  - `Submit Homework` → opens modal: assignment title/desc + textarea `Your Writing / Answer (English)` → `Submit to Organizer`. On success, marks submitted and shows success banner.
  - `Edit / Re-submit` when already submitted (upserts by `assignment_id,student_id`).
  - Submitted state loads on mount; feedback/grade displayed inline when available.
- **Staff actions:**
  - `Publish Assignment` → modal: Title (required) + Description + Deadline (free text, e.g. “June 20, 2026”) → publishes immediately to top of list.
  - `✨ AI Feedback` per assignment — generates AI feedback for the student's own submission, saves grade `A` + feedback, triggers celebration popup.
- Celebration popup on grading: title + message, auto-dismiss ~4s.

---

## 10. Resource Library

- **Grid** of resource cards (1–2 cols). Each card: file-type icon (🎧 Audio / 📖 Glossary / 📄 PDF-Note), category pill, size • downloads, title, `Added on {date}`, download button.
- **Search:** free-text title filter.
- **Category filter:** `All` + `Grammar` | `Vocabulary` | `Idioms` | `Listening` | `Worksheets`.
- **Download:** Opens `fileUrl` in new tab when present; otherwise shows “Downloading …” alert. Increments download count.
- **Upload (staff only):** `Upload Resource` → modal: Title (required) + Category (select) + File Type (`PDF` | `Audio` | `Note` | `Glossary`) → creates entry immediately.

---

## 11. Leaderboards & Rankings

- Header + tab switcher: `Weekly Leaderboard` | `All-Time Cumulative`.
- **Podium (top 3):** Gold/silver/bronze gradient cards with rank, avatar, nickname, points.
- **Full list:** Rank badge + avatar + name + nickname + level pill (desktop) + `🔥 {streak}d` pill + `points pts` on the right. Leaderboard is sourced from `profiles` ordered by points (top 50).

---

## 12. Community Chat

- **Single public, text-only stream.** No DMs, no image/video.
- Message bubble per message: avatar circle, nickname, `Organizer` shield badge when author is staff, timestamp, bubble body (indigo for organizer, white/gray for students). Own messages are right-aligned.
- Auto-scroll to bottom on new messages. Realtime inserts for other users.
- Input bar: text field `Type a message or practice English... (Arabic & English supported)` + `Send` button. Optimistic insert while persisting.

---

## 13. Profile & Account

Modal opened from navbar profile chip:
- Large avatar + name + `points Total Points • 🔥 streak-Day Streak` + `🧊 Streak Freezes` count.
- **Manage Roles (developer only):** `Crown` button opens Role Manager — search members, assign `student` | `host` | `organizer` | `admin`.
- Editable fields: nickname, level (3 pills), avatar grid (10 emojis), learning goals.
- **Placement test** (same single question as onboarding) — `Not sure? Take quick placement test` → answer sets level to Intermediate, shows `Score: 85% (Level set to Intermediate)`.
- **Streak Freeze shop item:** `🧊 Streak Freeze — Protects your streak if you miss one day.` Costs 25 pts → calls `grant_streak_freeze` + deducts points, increments freeze count, shows success/failure message.
- Save / Cancel. Shows `Profile saved!` or failure message.

---

## 14. Notifications

- Bell icon in navbar; badge shows unread count.
- Dropdown lists all notifications, unread highlighted with indigo background + dot. Title + optional content. `New` count pill when unread > 0.
- Opening the dropdown marks all unread as read (persists).
- New notifications arrive realtime (INSERT on `notifications` for current user).

---

## 15. Gamification

- **Points:** +100 per correct game answer, +20 per QR check-in. Total shown in navbar chips, profile, and leaderboard.
- **Streaks:** `streak` days shown alongside points (🔥) in navbar, leaderboard, and profile. Purchasable streak freezes (🧊) protect a missed day, cost 25 pts each.
- **Celebration feedback:** Confetti on correct answers; `CelebrationPopup` on homework grading.
- Badges array is part of the profile schema; no dedicated badge showcase UI ships in v1.

---

## 16. Language, Theme & Experience

- Persistent `English ↔ Arabic` toggle in every header; flips `dir="rtl"` and font (`font-arabic` vs `font-sans`), all strings via `src/lib/i18n.ts`.
- Light / Dark mode toggle (adds/removes `dark` class on `<html>`).
- Loading state: centered `🎓` pulsing card + “Loading your workshop…”.
- Check-in success banner (emerald) at top of authenticated app, dismissible.
- Realtime channels for: chat messages, notifications, announcements.
- Offline: `IndexedDB` helper (`EnglishWorkshopDB → checkins`) with `queueCheckIn()` is specified but has no UI trigger in v1 (stub).

---

## 17. Planned Features — Next Build (approved to add)

These are approved next-build features. Like everything else in this document, none of them are implemented yet; this document is the single source of truth for what to build.

### 17.1 Peer Review Flow (Homework) — `Staff sees all`
- After submission, anonymous peer assignment. Students stay anonymous to each other; **staff (host/organizer/admin) can see both author and reviewer names** for moderation/grading.
- Task: rate + short comment on a peer's submission.
- Opens only after organizer publishes the assignment; results visible to author after review submitted.
- Duplicate peer review per assignment blocked.

### 17.2 Calendar Export
- Per-session `Add to Calendar` → exports `.ics` and `Google Calendar` link with title, time, location/link, description.
- Student-local timezone already auto-detected; export respects it.

### 17.3 Breakout Rooms (Small-Group Conversation) — `Report button`
- Inside a live session, opt-in rooms of 4–6 students for focused conversation practice.
- Self-select / join / leave; room list + occupancy count; no host assignment required.
- Text-only. Each room message has a **Report button** (same as main chat); reports go to moderation queue, staff can review. No mandatory staff presence in rooms.

### 17.4 Session Ratings & Feedback — `Anonymous aggregate`
- After a session ends: 1–5 star rating + optional short anonymous note per student (one per session).
- Organizer sees **anonymous aggregate**: average rating + anonymized notes list. Students see only their own submission; no public average.

### 17.5 More Game Types (modular)
- Engine is modular by design (`GameEngine` + `HotSeatStrategy`). Add templates: Word Order Race, Rapid-Fire Vocabulary Chain, Idioms/Slang Trivia, Meme & Caption Contest (vote), Grammar Detective (fix paragraph), Roleplay Scenario Rooms (Airport / Restaurant / Interview).
- Host picks game type + difficulty + round count + per-question timer per launch.

### 17.6 Admin Analytics Dashboard
- Overview cards: total students, active today, upcoming sessions, reported items.
- Per-student progress: attendance %, points, streak, homework status.
- Per-session report: attendance list, scores, ratings (print/PDF later).

### 17.7 AI Chat Room — Gemini Movie Session Designer ⭐ — Implementation-Ready

**Purpose & Users (staff-only v1):** Transform a short film into a structured, engaging English communication workshop — film as catalyst for students to speak, think, create, defend ideas, interact, and become comfortable in English. For v1 this is **staff-only** (`host`/`organizer`/`admin` via `isStaffRole`). Students consume the resulting workshop through the normal **Sessions** experience (§7). Do not expose the generation interface to students.

**Configuration & Security — Google AI API key:** `gemini-3.5-flash-lite` locked (per your pick, no build until PRD done).
- Configured through the staff-only **AI Chat Room settings** card. Can be **replaced** (rotate) or **removed/disabled** at any time without code deploy.
- **Must never be exposed to the browser after submission:** stored as Supabase Edge Function secret / encrypted `app_settings` row (server-side only). UI shows only masked/configured state (e.g. `•••• •••• Configured`), never the raw key.
- **Must never appear** in chat messages, generated JSON, Edge Function responses, or ordinary application logs. Gemini receives the key only through the server-side execution path (`supabase/functions/gemini-movie-session` → `Deno.env`).
- Validation: if key missing/invalid at call time, fail with user-facing error (see Failure States) — do not fall back to an unrelated model.

**Interaction — tools, options, actions (chat-like):** Free-form input (`Suggest me next session`) + quick chips (`Suggest short movie`, `Regenerate activities`, `Make it more formal`, `Make it easier`, `Find alternative movie`, `Create session draft`) + visible tool calls (`🔍 Searching <15 min…`, `🎬 Found 3 candidates…`, `✨ Drafting 4 activities…`). Tool calls are rendered as system messages, not as Gemini-pretended searches.

**AI Pipeline & Ownership — who does what:**
```
User → AI Chat Room (client, staff) → Supabase Edge Function (gemini-movie-session)
     → Gemini (gemini-3.5-flash-lite) → movie discovery/search tools → verification/enrichment
     → Gemini selection + session design (reasoning over tool results) → structured JSON
     → AI Chat Room (render candidates + session + 4 activities)
```
- **Client:** collects `user_message`, `workshop_level`, `chosen_movie`, renders chips/system messages, never holds the API key.
- **Edge Function:** owns API-key handling, orchestrates search tools, runs verification/enrichment, builds the hybrid verification payload, calls Gemini with system prompt + tool results, validates JSON, strips any leaked secrets, returns JSON or typed error.
- **Search/verification tools (server-side):** perform YouTube/Vimeo availability check, IMDb lookup, reviews aggregate, language/dub/sub check. They return factual results; they do not invent.
- **Gemini:** reasons over the supplied tool results and designs the session/activities. **Must not invent** URLs, ratings, votes, reviews, availability, or language verification, and **must not claim** it performed a search the application did not perform. If a tool result is missing, Gemini marks the field `null`/`unknown`/`unavailable` and does not fabricate.

**Verification Gates — hard gates vs enrichment:**

*Hard gates (candidate rejected if not satisfied):*
- **Runtime:** film itself genuinely under 15 minutes per Runtime rule (§17.7 Runtime) as verified by tool result.
- **Availability verified:** the film itself can reasonably be watched from the supplied `availability_url` (see Availability).
- **Language sufficiently verified:** `audio_type` and `subtitles` status known enough to apply Language Priority; `unknown` where verification could not be performed is tolerated only if hard-gate language requirement is still met for that candidate’s rank.
- **Appropriateness acceptable:** `safe` or `caution` with context; `unsuitable` (explicit sexual content, pornography, graphic gore, or otherwise unsuitable per author prompt) is rejected. Uncertain suitability → mark `caution` and prefer another candidate; do not silently assume appropriate.

*Enrichment / ranking signals (not mandatory rejection criteria when unavailable):*
- `imdb_rating`, `imdb_votes`, `review_summary`, `review_score`. When unavailable, set `null` and **do not fabricate**; do not automatically reject an otherwise excellent film. Enrichment influences ranking but not hard-gate pass/fail.

*Incomplete/contradictory verification:* mark the field `null`/`unknown`/`unavailable`, prefer the more direct/reliable source, and surface uncertainty in `why_it_works` or review summary. Never silently present an unverified film as verified.

**Runtime — single authoritative rule:** The **film itself must be under 15 minutes**. Where reliable runtime information permits the distinction, **do not count end credits** when determining the educational runtime. Do not allow a film over the limit merely because a source rounds its runtime down. All fields use **minutes** as the unit (`duration_minutes` integer minutes, rounded). Consistent across ranking, verification, and session.

**Availability — verified means watchable:** Availability verification means the actual film can reasonably be **watched from the supplied `availability_url`**. A page merely describing the film does **not** count. Prefer openly accessible, legal sources in priority:
1. YouTube  2. Vimeo  3. public/festival archives  4. filmmaker-hosted pages  5. other openly accessible legal sources.
Subscription/exclusive sources are **fallback only** when substantially better open-web alternatives are unavailable. Do not require exclusivity or popularity. `availability_verified` is boolean; `false` → candidate fails hard gate.

**Language Priority — for spoken-English engagement:** `english_original` > `verified english_dub` > `verified english subtitles` > `other` only when educational value strongly justifies it. Subtitles are **not equivalent** to English audio for the primary goal of spoken-English engagement; English audio outranks subtitles when other qualities are comparable. `subtitles` values: `english` | `none` | `unknown`.

**Tool Result Contract — semantic payload passed to Gemini (`hybrid_verification_json`):** The Edge Function builds an array of candidate objects; Gemini must not invent beyond it. Conceptual shape per candidate:
```json
{ "title","year","duration_minutes","availability_url","availability_verified":bool,
  "audio_type":"english_original|english_dub|non_english",
  "subtitles":"english|none|unknown",
  "appropriateness":"safe|caution|unsuitable",
  "imdb_rating": number|null, "imdb_votes": number|null,
  "review_summary": string|null, "review_score": number|null,
  "educational_score": number|null, "suitability_notes": string|null }
```
Exact wire format is an implementation concern, but the semantic contract above is authoritative. Missing enrichment → `null`.

**Ranking & Selection:** Rank by **overall workshop value**, not popularity: accessibility of English, availability, suitability, discussion/roleplay/creativity/critical-thinking/emotional engagement potential, and suitability for `workshop_level`. Apply language priority as above. Select the single strongest candidate that passes hard gates. Obscure but pedagogically rich films may outrank famous but empty ones.

**Session & Activity Generation — session vs film time, sequencing:**
- **Film runtime** (`duration_minutes`, <15, without credits where distinguishable) ≠ **activity time** (`timing_min` per activity, numeric) ≠ **total workshop time** (`session.duration_minutes` = sum of activities + film viewing, practical for a real classroom, e.g. 45–60 min).
- Generate **exactly 4 activities** that together follow a progression: `comprehension/observation → personal/creative response → spoken interaction → deeper thinking/argument/performance`. Activities must have **distinct pedagogical purposes** and progressively require **more active English use**. Do not make four variations of “discuss the movie.”
- Across the four, cover **communication plus** a useful combination of creativity, critical thinking, confidence, argumentation, formal communication, perspective-taking, interaction.
- Each activity must: require active participation, produce an **observable output** (`expected_output`), have clear `timing_min` (numeric), specify `grouping` (`individual`/`pair`/`small group`/`whole class`), contain a concrete `prompt`, connect meaningfully to the film, and be classroom-practical. Level-adapt per prompt (Beginner: sentence frames; Intermediate: scaffolded; Advanced: open, counterarguments) — do not merely lengthen the same activity.
- Activity toolbox remains as listed in the author prompt; variation is allowed when it produces a substantially better learning outcome.

**Conversation State — what persists:** `current selected film`, `current session`, `learner level`, `previous film`, `generated activities`, `relevant verification results`. Behavior:
- `make activity 2 easier / replace activity 2 / add Arabic support` → modify **only that activity** (or scoped part), preserve film/session context, re-validate JSON.
- `suggest me next session` → **intentionally select a new film** unless the previous film is explicitly requested again.

**Output Contract — strengthened (no invented data):** Keep the existing JSON structure as the single source of truth (see author prompt schema). Requirements:
- **Exactly 4 activities**, `timing_min` numeric, `skill_focus` includes `communication`, `expected_output` present.
- **Never invent** `availability_url`, `imdb_rating`, `imdb_votes`, `review_summary`, `review_score`, `availability_verified`, language verification, or appropriateness. Use `null`/`unknown`/`unavailable` and `false` appropriately.
- **Valid JSON only**, no markdown, no code fences, no commentary outside JSON. Duration fields in **minutes**.
- On scoring: `educational_score` numeric when available else `null`; `appropriateness` enum `safe|caution|unsuitable`.

**Failure States — fail gracefully, never silently misrepresent:**
- `invalid/missing API key` → UI: “AI is not configured. A staff member needs to add the Google AI API key in AI Chat Room settings.” No key in response/logs.
- `Gemini unavailable / timeout / rate-limit` → “AI is temporarily unavailable. Please retry.” with retry action; log event without key.
- `search failure` or `no candidate passes hard gates` → “No suitable film passed verification. Try broadening or suggest alternative keywords.” Do not present a hard-gate-failed film.
- `malformed Gemini JSON / incomplete response` → discard, surface “Generation produced an invalid response. Regenerate.” and allow regenerate; log parse error without key.
- `unavailable IMDb/review data` → proceed with `null` enrichment; do not block.
- `conflicting verification sources` → prefer direct source, keep uncertainty typed.
- All failures return a typed error to the client (no leaked key, no invented film).

**Observability without exposing secrets:** Emit operational events without logging the API key or raw key material: `generation_started`, `search_started/completed` (candidates found count), `verification_completed` (verified vs total), `session_generated` (film title + total workshop minutes), `generation_failed` (typed error code). Edge Function logs contain only masked key presence (`configured: true/false`), never the key. Client shows system messages for search/verification/generation states per Interaction.

**Built-in system prompt — VERBATIM (to be used in `supabase/functions/gemini-movie-session/index.ts`):**
```text
You are the English Workshop Session Designer for Arabic-speaking learners.
Your job is to transform a short film into a structured, engaging English communication workshop. The goal is NOT simply to recommend something to watch. The goal is to use the film as a catalyst for students to speak, think, create, defend ideas, interact, and become more comfortable communicating in English.

PRIMARY OBJECTIVE
Maximize meaningful student engagement in English while developing:
* spoken communication
* confidence
* creativity
* critical thinking
* argumentation
* formal/informal language control
* interpretation and perspective-taking
* collaborative interaction

FILM REQUIREMENTS
Recommend films shorter than 15 minutes.
Prefer, in this order:
1. English original audio
2. Verified English dub
3. Verified English subtitles
4. Other options only when there is strong educational value
Prefer films that are freely and legally accessible on the open web, especially YouTube, Vimeo, public/festival archives, filmmaker-hosted pages, or other openly accessible platforms.
Do NOT prioritize exclusive subscription content when an equally useful open-web alternative exists.
The film should provide enough material for discussion and activities. Prefer films with:
* an understandable but interesting premise
* memorable characters or situations
* a conflict, decision, mystery, dilemma, or unusual perspective
* room for interpretation
* opportunities for disagreement
* opportunities for roleplay
* opportunities for prediction
* opportunities for creative responses
* language that is reasonably accessible for the selected learner level
Avoid films that are technically appropriate but pedagogically empty.

SAFETY / APPROPRIATENESS
Reject films containing explicit sexual content, pornography, graphic gore, or similarly unsuitable material.
Consider profanity, violence, death, frightening themes, discrimination, and mature themes in context rather than treating every potentially serious theme as an automatic rejection.
If suitability is uncertain, do not silently assume that the film is appropriate. Mark it as uncertain and prefer another candidate.

VERIFICATION
Use the available verification/tool results to evaluate candidates.
For each candidate verify, where possible:
* actual duration
* actual availability
* language/audio status
* English subtitle/dub status
* IMDb information
* review/community reception
* suitability
* educational usefulness
Availability verification means that the film itself can reasonably be watched from the supplied URL. A page merely describing the film does NOT count as film availability.
Do not invent verification results.
If IMDb or review information is unavailable, do not fabricate it and do not automatically reject an otherwise excellent film. Mark the field as unavailable.
If verification sources conflict, prefer the more direct and reliable source and explain the uncertainty internally when selecting the film.

FILM RANKING
Rank candidates according to overall workshop value, not popularity alone.
Consider:
* accessibility of English
* duration below 15 minutes of movie without the casts
* availability
* suitability
* discussion potential
* roleplay potential
* creativity potential
* critical-thinking potential
* emotional/social engagement
* suitability for the learner level
English audio should generally outrank subtitles when other qualities are comparable.
An obscure short film with excellent workshop potential can be better than a famous film with little discussion value.

SESSION DESIGN
After evaluating candidates, select the single strongest film.
Create a workshop that uses the film rather than merely asking students to summarize it.
The session should normally follow a progression such as:
1. comprehension / observation
2. personal or creative response
3. spoken interaction
4. deeper thinking, argument, or performance
Do not make all four activities variations of "discuss the movie."
Create EXACTLY 4 activities.
Each activity must have a distinct pedagogical purpose.
Across the four activities, cover communication plus a useful combination of:
* creativity
* critical thinking
* confidence
* argumentation
* formal communication
* perspective-taking
* interaction
Activities should progressively require more active English use.

ACTIVITY TOOLBOX
You may use or adapt these formats:
* Write ideas about the movie
* Roleplay a character or scene
* Pick one idea and defend it
* Formal vs informal rewrite
* What happens next? prediction
* Grammar detective
* Caption/meme contest
* 5-second hot-seat questions
* Debate between characters
* Alternative ending
* Character interview
* Give advice to a character
* Rank the characters' decisions
* Persuade another student
* News report about the movie
* Rewrite a scene formally
* Imagine the story from another character's perspective
You may create a variation when it produces a substantially better learning outcome.

LEVEL ADAPTATION
Beginner:
Use sentence frames, vocabulary support, short prompts, pair work, and highly guided speaking.
Intermediate:
Use moderate scaffolding, follow-up questions, pair/group discussion, and short arguments.
Advanced:
Use open-ended discussion, spontaneous speaking, nuanced argumentation, formal speech, counterarguments, and perspective shifts.
Do not make the same activity merely longer for advanced learners. Increase cognitive and linguistic independence.

LANGUAGE
The workshop is English-first.
Activity prompts should be written in clear English.
Arabic hints may be included to clarify difficult instructions, but Arabic must support English learning rather than replace it.
Do not translate every English sentence automatically.

ACTIVITY QUALITY RULES
Every activity must:
* require active student participation
* produce an observable output
* encourage English use
* have a clear time allocation
* work in a real classroom
* specify grouping
* contain a concrete prompt
* connect meaningfully to the film
Avoid vague activities such as "Discuss the movie" or "Talk about your feelings."
Prefer prompts that force students to make choices, explain reasoning, negotiate, persuade, imagine, or defend something.

INTERACTIVE CHAT MODE
The application may allow the teacher/student to interact with the generated session.
When responding to follow-up requests, preserve the selected film and session context unless the user explicitly requests a new session.
Support commands such as:
* suggest me next session
* make this easier
* make this harder
* replace activity 2
* give me more questions
* make this activity suitable for pairs
* add Arabic support
* make it more formal
* give me a debate version
* choose another movie
* regenerate the session
Do not regenerate unrelated parts of the session when the user asks to modify only one component.

OUTPUT RULES
Return ONLY valid JSON.
Never return Markdown.
Never return code fences.
Never add commentary outside the JSON.
Schema:
{
"candidates": [
{
"title": "...",
"year": 0,
"duration_minutes": 0,
"language": "...",
"audio_type": "english_original | english_dub | non_english",
"subtitles": "english | none | unknown",
"availability_url": "...",
"availability_verified": true,
"imdb_rating": null,
"imdb_votes": null,
"review_summary": "...",
"review_score": null,
"appropriateness": "safe | caution | unsuitable",
"educational_score": 0,
"why_it_works": "..."
}
],
"session": {
"title": "...",
"arabicTitle": "...",
"film": "...",
"description": "...",
"level": "...",
"format": "...",
"duration_minutes": 0,
"link": "..."
},
"activities": [
{
"title": "...",
"goal": "...",
"timing_min": 0,
"grouping": "...",
"prompt": "...",
"arabicHint": "...",
"skill_focus": ["communication", "..."],
"expected_output": "..."
}
]
}
There must be EXACTLY 4 activities.
Never invent URLs, ratings, votes, reviews, availability, language information, or verification results.
When the user asks for a new session, prefer a genuinely different film from the previous choice unless the previous film is explicitly requested again.

USER REQUEST CONTEXT
The application will provide:
Request: {{user_message}}
Learner level: {{workshop_level}}
Previous choice: {{chosen_movie_or_null}}
Tool results: {{hybrid_verification_json}}
When the request is "Suggest me next session":
1. Evaluate the supplied film candidates/tool results.
2. Reject unsuitable or inadequately verified candidates where verification is necessary.
3. Rank the remaining candidates by workshop usefulness.
4. Select the strongest candidate.
5. Design exactly four complementary activities.
6. Return the required JSON only.
```

---

## 18. Design System — Universal Luxury Product Design Constitution

You provided the full 40-principle constitution; it is adopted as the project's design law. Summary for engineering/design handoff (full text retained in conversation history):

1. Purpose before aesthetics — remove anything that doesn't earn its place.
2. Form & geometry — one geometric language, intentional curvature/radii/proportions, optical correction.
3. G0/G1/G2/G3 surfacing — use continuity level intentionally; inspect curvature/highlights.
4. Proportion — master ratios for container/content, icon/label, whitespace, typography.
5. Tactile ratio — interaction area > visible glyph; 48×48dp min, proper separation.
6. Spacing — single scale, proximity = relationship, rhythm across breakpoints.
7. Optical alignment — correct mathematically-centered but visually-off elements; judge whitespace visually.
8. Typography — structural system (display/heading/body/label/caption/data), limited families, test at extremes.
9. Iconography — one grammar (stroke/fill/corners/grid/states), always recognizable at smallest size.
10. Color — semantic roles (primary/neutral/status), light/dark + disabled states, WCAG contrast, accent sparingly.
11. CMF (physical) / 12. Materials in software — define surface categories (background/content/control/elevated/transient/modal), blur/opacity/elevation rules.
13. Edge quality, 14. Shadow & elevation — one light source, deliberate borders/shadows, inspect corners.
15. Haptics, 16. Motion, 17. Interaction physics (`approach → hover → focus → press → release → confirmation`), 18. Affordance — controls look interactive, non-controls don't.
19. Information hierarchy, 20. Cognitive load — primary gets strongest priority, progressive disclosure.
21. Error design — prevent > explain, preserve input, human language + recovery.
22. Accessibility — WCAG 2.2 (text scaling, keyboard, screen reader, Focus Not Obscured/Appearance, Target Size 24×24 min), survive every theme/state.
23. Responsive — recompose, don't just shrink; preserve hierarchy/touch/typography.
24–27. Hardware ergonomics, manufacturing, seams/gaps, acoustics — intentional tolerances, consistent gaps, sound hierarchy.
28. Brand language, 29. Ecosystem, 30. Systems thinking — primitives → tokens → components → patterns → pages.
31. Visual quietness, 32. Detail density — reduce competing focal points; when detail is needed, make it perfect.
33–40. Consistency, platform-native + distinctive, performance, reliability, privacy/trust, durability, environmental quality, obsessive final QA pass (geometry/typography/color/material/interaction/motion/hardware/system at 100%/200%/extreme zoom).

**Applied to this project:**
- Polish 1 screen first (per your pick): audit `AnnouncementsView.tsx:99` hero/board + `SessionsView.tsx:23` cards as reference for spacing/optical/tactile/contrast, then roll to all tabs before building §17 features. No build until PRD discussion is done.
- **Palette — Option 2 Coastal, Composed, Upscale (chosen 2026-08-21; applied in the earlier project via `tailwind.config.js` + `src/index.css` — treat as the target palette and reapply when building here):**
  - Anchors: `#0E2A3A` deep petrol navy (primary), `#1B4D5C` slate teal, `#7FA6A8` mist, `#F1EFE8` linen canvas, `#B08A57` brass (accent). Mood: coastal, composed, upscale.
  - Scales generated via `color-palette` skill (HSL, 50–950, saturation-tapered lights): `petrol 50 #F4F8FB → 950 #0A1E29`, `mist 50 #F6F8F8 → 950 #151E1E`, `brass 50 #FAF8F5 → 950 #231B10` (brass base `#B08A57` at 500, navy at petrol-900). Full tokens in config.
  - Backward-compat: `indigo` remapped to petrol (`600 #0E2A3A`), `violet` to mist, `purple` to brass — existing `bg-indigo-600` etc. render coastal without component rewrites; new code uses `petrol`/`brass`/`mist` directly.
  - Semantic CSS vars (light): `--background #F1EFE8` / `--foreground #0E2A3A` 12.94:1 AAA, `--primary #0E2A3A` on white 14.88:1 AAA, `--accent #B08A57` with `--accent-foreground #0E2A3A` 4.69:1 AA (brass fails with white 3.17:1 — enforced navy text), `--muted-foreground #1B4D5C` 8.07:1, `--border #CDE2EF`. Dark inverts lightness per skill: `--background #0A1E29` / `--foreground #F1EFE8` 12.94:1, `--primary #308EC5`, `--muted-foreground #B4C9CA` 7.2:1.
  - Verification: `npm run build` passes (`44.87 kB CSS`), dev server `http://localhost:3000` serves 200.
- Keep English-only PRD per your choice; backup deleted.

---

## 19. Notes
- PRD is English-only going forward. Old backup `prd_backup_2026-08-21.md` deleted per your instruction.
- **This PRD was imported from an earlier project.** No code exists in this workspace yet — §1–§17 are all to be built fresh; references to existing files/tables describe the earlier project and must be re-created or re-verified here.
- Palette Option 2 is now the source of truth; any future palette change must regenerate 50–950 scales + semantic dark variants and re-verify WCAG per the constitution §10/22.
