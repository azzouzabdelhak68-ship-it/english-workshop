-- 0006: AI chat provider switch (google vs groq)
alter table public.ai_settings
  add column if not exists ai_chat_provider text not null default 'google' check (ai_chat_provider in ('google','groq'));

drop view if exists public.ai_settings_status;
create view public.ai_settings_status as
  select
    configured, last4, gemini_model,
    groq_configured, groq_last4, groq_model,
    ai_chat_provider,
    updated_by, updated_at
  from ai_settings
  where exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('host','organizer','admin')
  );
grant select on public.ai_settings_status to authenticated;
