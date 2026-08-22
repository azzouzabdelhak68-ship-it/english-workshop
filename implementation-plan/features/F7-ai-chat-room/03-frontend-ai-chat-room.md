# F7 — Frontend: AI Chat Room

Staff-only route (guard in the router, *in addition to* the Edge Function's own server-side check — see `00-overview-and-pipeline.md`; never rely on the client guard alone).

## Chat UI

Visually mirrors §12 Community Chat (reuse the `<TextChatStream>` component if it's been extracted per `F3-breakout-rooms.md`), but this is a **request/response pattern, not realtime multi-user** — no Supabase Realtime subscription here, just an async call to the Edge Function per turn. Quick-action chips per PRD: `Suggest short movie`, `Regenerate activities`, `Make it more formal`, `Make it easier`, `Find alternative movie`, `Create session draft`.

## ⚠️ System-message honesty — effort vs. fidelity trade-off

PRD is explicit that tool-call system messages (`🔍 Searching…`, `🎬 Found 3 candidates…`, `✨ Drafting 4 activities…`) must reflect **real** phases, not decorative fake-typing delays — stated specifically about Gemini not pretending to search, but the same honesty principle plausibly extends to the client not faking a progress timeline over what is actually one opaque request in flight.

Two options, real trade-off, not a free win either way:

| Option | Fidelity | Effort |
|---|---|---|
| Real streaming (Edge Function emits phase markers via `ReadableStream`, client renders them as they arrive) | Genuine — messages reflect actual pipeline state | Higher — both ends need streaming support |
| Single opaque request + one generic "Working…" state | Lower fidelity, but never lies about phases that didn't happen | Lower — plain request/response |

**Recommendation:** ship the single opaque-request version for v1 if streaming proves costly to wire up correctly under a deadline — a generic "Working…" state doesn't violate the honesty principle (it claims nothing false), whereas a client-side `setTimeout` sequence faking three sequential phases over one actual network call would. Revisit real streaming for v1.1 once the core pipeline is proven.

## Settings card

- Masked display: `•••• •••• Configured` / `Not configured` — sourced from the `ai_settings_status` view (`01-database-and-secrets.md`), never the raw key.
- Replace / Remove actions, staff-only.
- **Never log the raw key to the browser console or network tab, including during local development.** From the moment of submission, the key must not appear in any response body — the submit endpoint returns only `{ configured: true }`, never an echo "for confirmation."

## Failure-state UI

Wire directly to the PRD's Failure States table (§17.7) — each typed error from the Edge Function maps 1:1 to the exact user-facing copy the PRD specifies. Don't paraphrase or genericize these messages; the PRD wrote them deliberately distinct per failure type (missing key vs. rate-limit vs. no-candidate vs. malformed JSON) so staff can tell what actually went wrong.
