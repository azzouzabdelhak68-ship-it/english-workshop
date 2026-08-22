# F7 — AI Chat Room: Gemini Movie Session Designer (PRD §17.7)

The PRD marks this "Implementation-Ready" and specifies behavior in unusual depth (verification gates, runtime rule, output contract, failure states, observability). This plan does **not** repeat that spec — it resolves the handful of things the PRD explicitly leaves as "an implementation concern": the wire architecture, which external services do the verification, and how the rotatable key actually gets stored and rotated.

**Read the PRD §17.7 section in full before this file** — this is the translation layer, not the spec.

## Staff-only gate — enforce server-side, not just client-side

`isStaffRole` route-gating the client UI is not security. The Edge Function **must independently verify the caller's role from their JWT** before doing anything, since a student could call the Edge Function URL directly, bypassing a client-only check entirely. This is a two-line check that's easy to skip because the client already "handles" it — it doesn't, from the server's perspective.

## Two-phase architecture (resolves the PRD's "implementation concern" on tool wiring)

```
Phase A — Discovery & Verification (deterministic, the app's own code, zero AI)
  candidate search (YouTube Data API) 
    → per-candidate verification (duration, availability, dub/sub status)
    → enrichment (OMDb for IMDb data)
    → assemble hybrid_verification_json exactly per PRD's schema

Phase B — Selection & Design (single one-shot Gemini call, no live tool use during the call)
  system prompt (verbatim) + Phase A JSON + conversation state 
    → Gemini gemini-3.5-flash-lite 
    → strict JSON-schema validated response
```

This reading is consistent with the PRD's own pipeline diagram ("Edge Function → orchestrates search tools, runs verification/enrichment, builds the hybrid verification payload, calls Gemini with system prompt + tool results") and with the requirement that Gemini "must not claim it performed a search the application did not perform" — Gemini never searches; it reasons over what Phase A already found and packaged.

## New external services needed (beyond the Gemini key the PRD already covers)

| Service | Purpose | Key type | Notes |
|---|---|---|---|
| YouTube Data API v3 | Candidate search + exact duration | Static secret | Free tier has daily quota — monitor usage as the feature gets used more |
| OMDb API | IMDb rating/votes proxy | Static secret | Real IMDb has no public API; OMDb is the standard third-party substitute. Free tier ≈1000 req/day — a real scaling constraint if usage grows, flag if it becomes a bottleneck |
| Vimeo API | Secondary source (PRD priority #2) | Static secret | **Recommended cut for v1** — defer to a fallback-only path, or skip entirely if YouTube coverage proves sufficient. Cuts real implementation effort for a source the PRD itself ranks below YouTube |
| Google AI (Gemini) | Selection + session design | **Rotatable via Vault** — see `01-database-and-secrets.md` | Only this one needs runtime staff-driven rotation per PRD |

The YouTube/OMDb/Vimeo keys are static — set via `supabase secrets set`, same as any other static secret (see `01-shared-conventions.md`). Don't over-engineer them into the rotatable-secret system built for the Gemini key; that solves a problem the PRD didn't ask for.

## Conversation state — resolved

The PRD lists what persists (selected film, session, learner level, previous film, activities, verification results) but Edge Functions are stateless/ephemeral by design — don't fight that by trying to hold state in memory between invocations. **The client resends the full last-generated JSON object as part of each follow-up request body.** This keeps the Edge Function pure-stateless (simpler to reason about, scales trivially) at the cost of a slightly larger request payload, which is negligible for this data size.
