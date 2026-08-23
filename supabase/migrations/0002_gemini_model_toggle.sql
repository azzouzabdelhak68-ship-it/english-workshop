-- F7 extension: staff-selectable Gemini model, stored in ai_settings.
alter table public.ai_settings add column gemini_model text not null default 'gemini-3.5-flash-lite';

alter table public.ai_settings add constraint ai_settings_gemini_model_check
  check (gemini_model in (
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-pro-latest',
    'gemini-2.5-pro',
    'gemini-2.5-flash'
  ));

drop view if exists public.ai_settings_status;

create view public.ai_settings_status as
  select configured, last4, gemini_model, updated_by, updated_at
  from ai_settings
  where exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('host','organizer','admin'));

grant select on public.ai_settings_status to authenticated;
