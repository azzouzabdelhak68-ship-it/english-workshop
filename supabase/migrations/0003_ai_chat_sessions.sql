-- ═══════════════════════════════════════════════════════════════
-- 0003: AI Chat Room rebuild (AI_ROOM_PLAN.md §4)
-- Draft persistence for F7 + ai_settings seed guard.
-- RLS ships in THIS migration (hard boundary).
-- ═══════════════════════════════════════════════════════════════

create table public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled draft',
  level text not null default 'Intermediate'
    check (level in ('Beginner','Intermediate','Advanced')),
  focus_preset text,
  transcript jsonb not null default '[]',
  result jsonb,
  updated_at timestamptz not null default now()
);

create index ai_chat_sessions_owner_updated_idx
  on public.ai_chat_sessions (owner, updated_at desc);

alter table public.ai_chat_sessions enable row level security;

create policy "sessions: own crud (staff)" on public.ai_chat_sessions
  for all to authenticated
  using (owner = auth.uid())
  with check (
    owner = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('host','organizer','admin')
    )
  );

-- Singleton row guard so update-ai-key upsert always has a target.
insert into public.ai_settings (id) values (true)
on conflict (id) do nothing;
