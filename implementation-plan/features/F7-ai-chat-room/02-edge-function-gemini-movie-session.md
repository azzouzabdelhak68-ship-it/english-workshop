# F7 — Edge Function: `gemini-movie-session`

Path per PRD: `supabase/functions/gemini-movie-session/index.ts`.

## Structure (pseudocode)

```
1. Auth check — verify caller's JWT role is staff (host/organizer/admin). Reject otherwise, before touching anything else.
2. Parse + validate request body (zod): { user_message, workshop_level: enum, chosen_movie: string | null, prior_result: LastGeneratedJSON | null }
3. Phase A — Discovery & Verification
     a. Derive search terms from user_message (+ prior_result context for follow-ups like "suggest me next session")
     b. YouTube Data API search.list → candidate video IDs (filter: safeSearch, reasonable duration bound)
     c. Per candidate: videos.list for exact duration; oEmbed/HEAD check for availability
     d. OMDb lookup by title (+ year cross-check, see warning below)
     e. Assemble hybrid_verification_json exactly per PRD §17.7 Tool Result Contract schema
4. Load the Gemini key: select from vault.decrypted_secrets via service role (see 01-database-and-secrets.md).
   If missing/invalid → typed error per PRD Failure States, do not proceed.
5. Phase B — build the Gemini request: verbatim system prompt (system-prompt.txt)
   + {{user_message}}, {{workshop_level}}, {{chosen_movie_or_null}}, {{hybrid_verification_json}}
   substituted exactly as the PRD's placeholders specify.
6. Call Gemini (gemini-3.5-flash-lite) with an explicit timeout (see below).
7. Strict JSON-schema validate the response (zod/ajv) against the PRD's exact
   candidates/session/activities schema. Malformed → typed error, do not
   attempt partial recovery/repair — PRD requires discard + "Regenerate" prompt.
8. Grep the response body for the literal secret key value before returning,
   as a defense-in-depth leak check (cheap, catches a real bug class).
9. Emit structured (JSON, not string-concatenated) log lines for each PRD-specified
   observability event: generation_started, search_started/completed,
   verification_completed, session_generated, generation_failed — masked key
   presence only (`configured: true/false`), never the key itself.
10. Return typed success or typed error per PRD's Failure States table.
```

## ⚠️ OMDb title matching is fuzzy — cross-check by year

Title-only lookup risks collisions across different films sharing a name. Always pass `year` alongside `title` to OMDb, and treat a mismatch (or OMDb returning "movie not found") as `imdb_rating: null` rather than accepting the nearest-name result — a wrong-film match silently poisons `review_summary`/`imdb_rating` for the actual candidate, which the PRD explicitly forbids ("never invent... use null").

## Timeout

Set an explicit timeout on the Gemini call — recommend 20–25s. **Verify the actual Supabase Edge Function execution-time ceiling for the project's plan tier before hardcoding this** — hitting the platform's own hard timeout produces a worse, unlabeled failure than a deliberate early timeout paired with the PRD's own "temporarily unavailable, retry" message.

## Streaming (optional, see frontend file for the trade-off)

If the frontend implements real phase-by-phase system messages (`🔍 Searching…` → `🎬 Found N candidates…` → `✨ Drafting activities…`), this function needs to emit those as a stream (`ReadableStream`) rather than one opaque response — see `03-frontend-ai-chat-room.md` for the effort/fidelity trade-off and the recommended v1 cut.
