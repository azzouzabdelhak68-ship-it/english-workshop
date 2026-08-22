# F7 — Database & Secrets

## Why the Gemini key specifically needs Supabase Vault, not a static env var

The PRD's requirement is explicit: the key must be "replaced (rotate) or removed/disabled at any time **without a code deploy**," driven from a staff-only settings UI. A static Edge Function secret (`supabase secrets set`) is deploy-time-only — there's no way for a running Edge Function to rewrite another Edge Function's env var from inside a request handler. **Supabase Vault** (the `supabase_vault` Postgres extension) is the correct primitive: it stores secrets encrypted in Postgres, settable and readable at runtime via SQL from a service-role context — which is exactly what "encrypted `app_settings` row / Edge Function secret" in the PRD's own wording describes under the hood.

## Schema

```sql
-- Singleton settings row pattern (id is always `true`, only one row can ever exist)
create table ai_settings (
  id boolean primary key default true check (id),
  gemini_key_secret_id uuid references vault.secrets(id),
  configured boolean not null default false,
  last4 text,                          -- masked display only, e.g. "•••• 8f2a"
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
alter table ai_settings enable row level security;

-- Staff-readable view exposing ONLY non-secret columns
create view ai_settings_status as
  select configured, last4, updated_by, updated_at from ai_settings;
-- Grant SELECT on this view to authenticated staff only; do NOT grant SELECT
-- on ai_settings itself or on vault.secrets/vault.decrypted_secrets to any
-- client-callable role.
```

## Rotation flow

1. Staff submits a new key via a dedicated Edge Function endpoint (e.g. `update-ai-key`), which runs with the service role internally.
2. **Validate before committing:** make one cheap test call to Gemini with the new key *before* writing it to Vault. A broken paste that gets committed silently disables the whole feature until the next failed generation surfaces it — validating at entry time turns that into an immediate, clear "This key didn't validate" message instead.
3. On success: `select vault.create_secret(<key>, 'gemini_api_key')`, update `ai_settings.gemini_key_secret_id`, `configured = true`, `last4`, `updated_by`, `updated_at`.
4. The submit endpoint's own response returns only `{ configured: true }` — **never echo the key value back**, not even for "confirmation" display. From the moment of submission onward, the raw key must not appear in any response body.

## ⚠️ The single worst-case failure mode in this entire plan

`select ... from vault.decrypted_secrets` must happen **only** inside the `gemini-movie-session` Edge Function, using the service role, and must **never** be reachable through PostgREST by any client-callable role. Supabase does not expose the `vault` schema via PostgREST by default — but don't assume this holds after future schema/grant changes elsewhere in the project. **Add this as a named, explicit QA step** (attempt to query `vault.decrypted_secrets` as an authenticated non-service-role user and confirm it fails) rather than trusting the default silently — a regression here is a full API-key leak, categorically worse than any other bug in this plan.
