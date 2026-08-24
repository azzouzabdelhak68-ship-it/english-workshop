-- 0005: add Groq as second rotatable provider (alongside Gemini)
alter table public.ai_settings
  add column if not exists groq_key_secret_id uuid,
  add column if not exists groq_configured boolean not null default false,
  add column if not exists groq_last4 text,
  add column if not exists groq_model text not null default 'llama-3.1-8b-instant';

-- update view to expose both providers
drop view if exists public.ai_settings_status;

create view public.ai_settings_status as
  select
    configured, last4, gemini_model,
    groq_configured, groq_last4, groq_model,
    updated_by, updated_at
  from ai_settings
  where exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('host','organizer','admin')
  );

grant select on public.ai_settings_status to authenticated;

-- ensure singleton row still exists
insert into public.ai_settings (id) values (true)
on conflict (id) do nothing;
