-- English Workshop Platform — initial schema
-- Rule honored: RLS enabled in the SAME migration as table creation, never deferred.

create extension if not exists pgcrypto;

-- ============ profiles ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  nickname text,
  avatar text not null default '👨‍🎓',
  level text not null default 'Beginner' check (level in ('Beginner','Intermediate','Advanced')),
  role text not null default 'student' check (role in ('student','host','organizer','admin')),
  points integer not null default 0,
  streak integer not null default 0,
  streak_freezes integer not null default 0,
  badges text[] not null default '{}',
  learning_goals text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ============ helpers (after profiles: SQL functions validate bodies at creation) ============

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('host','organizer','admin') from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

create policy "profiles: public leaderboard read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: own update" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy "profiles: staff update roles" on public.profiles
  for update to authenticated using (public.is_staff()) with check (true);
create policy "profiles: admin delete" on public.profiles
  for delete to authenticated using (public.is_admin());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nickname, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(coalesce(new.email,'member'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ sessions / rsvp / checkins ============

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  arabic_title text,
  description text,
  level text not null default 'Intermediate' check (level in ('Beginner','Intermediate','Advanced')),
  format text not null default 'In-Person' check (format in ('In-Person','Virtual','Hybrid')),
  location text,
  meeting_link text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60,
  ended_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "sessions: read" on public.sessions for select using (true);
create policy "sessions: staff write" on public.sessions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "sessions: host ends own session" on public.sessions
  for update to authenticated using (created_by = auth.uid() or public.is_staff())
  with check (created_by = auth.uid() or public.is_staff());

create table public.rsvps (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.rsvps enable row level security;

create policy "rsvps: members manage own" on public.rsvps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rsvps: counts visible" on public.rsvps for select to authenticated using (true);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (session_id, user_id)
);

alter table public.checkins enable row level security;

create policy "checkins: own + counts" on public.checkins
  for select to authenticated using (true);
create policy "checkins: insert own" on public.checkins
  for insert to authenticated with check (user_id = auth.uid());

create or replace function public.record_checkin(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_already boolean; v_ended timestamptz;
begin
  select ended_at into v_ended from sessions where id = p_session_id;
  if v_ended is not null then raise exception 'SESSION_ENDED'; end if;
  perform 1 from checkins where session_id = p_session_id and user_id = auth.uid();
  v_already := found;
  if not v_already then
    insert into checkins (session_id, user_id) values (p_session_id, auth.uid());
    update profiles set points = points + 20 where id = auth.uid();
    insert into notifications (user_id, title, body)
      values (auth.uid(), 'Attendance verified', 'You earned +20 points for checking in.');
  end if;
end;
$$;

revoke execute on function public.record_checkin from anon;
grant execute on function public.record_checkin to authenticated;

-- Staff-only manual check-in for a member (Host Control Panel "Add").
create or replace function public.staff_check_in(p_session_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'STAFF_ONLY'; end if;
  insert into checkins (session_id, user_id) values (p_session_id, p_user_id)
  on conflict (session_id, user_id) do nothing;
end;
$$;

revoke execute on function public.staff_check_in from anon;
grant execute on function public.staff_check_in to authenticated;

-- ============ announcements ============

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'General' check (category in ('General','Event','Homework','Game Night')),
  pinned boolean not null default false,
  author_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements: everyone reads" on public.announcements for select using (true);
create policy "announcements: staff write" on public.announcements for insert to authenticated
  with check (public.is_staff());
create policy "announcements: staff update/delete" on public.announcements
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============ homework & peer review (F1) ============

create table public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  deadline text,
  organizer_id uuid references public.profiles(id),
  peer_review_open boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.homework_assignments enable row level security;

create policy "assignments: read" on public.homework_assignments for select to authenticated using (true);
create policy "assignments: staff write" on public.homework_assignments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create table public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  grade text,
  feedback text,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.homework_submissions enable row level security;

create policy "submissions: own + staff" on public.homework_submissions
  for select to authenticated using (student_id = auth.uid() or public.is_staff());
create policy "submissions: upsert own" on public.homework_submissions
  for insert to authenticated with check (student_id = auth.uid());
create policy "submissions: update own" on public.homework_submissions
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "submissions: staff grade" on public.homework_submissions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create table public.peer_review_participants (
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  frozen_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

alter table public.peer_review_participants enable row level security;

create policy "participants: staff manage" on public.peer_review_participants
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "participants: member sees self" on public.peer_review_participants
  for select to authenticated using (student_id = auth.uid());

create table public.peer_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_submission_id uuid not null references public.homework_submissions(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assignment_id, reviewer_id)
);

alter table public.peer_reviews enable row level security;

create policy "peer_reviews: reviewer sees own" on public.peer_reviews
  for select to authenticated using (reviewer_id = auth.uid());
create policy "peer_reviews: staff see all" on public.peer_reviews
  for select to authenticated using (public.is_staff());

create view public.peer_reviews_for_author as
  select pr.assignment_id, hs.student_id as author_id, pr.rating, pr.comment
  from peer_reviews pr join homework_submissions hs on hs.id = pr.reviewee_submission_id;

grant select on public.peer_reviews_for_author to authenticated;

-- Shift-by-one round-robin assignment computed SERVER-SIDE.
-- The client never sends a reviewee id: it sends only rating+comment.
create or replace function public.submit_peer_review(
  p_assignment_id uuid, p_rating smallint, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_ordered uuid[];
  v_idx int;
  v_target uuid;
begin
  if not exists (
    select 1 from homework_assignments
    where id = p_assignment_id and peer_review_open = true
  ) then raise exception 'REVIEW_NOT_OPEN'; end if;

  select coalesce(array_agg(student_id order by frozen_at, student_id), '{}')
    into v_ordered
  from peer_review_participants where assignment_id = p_assignment_id;

  if cardinality(v_ordered) < 2 then raise exception 'NOT_ENOUGH_SUBMISSIONS'; end if;

  v_idx := array_position(v_ordered, v_me);
  if v_idx is null then raise exception 'NOT_PARTICIPANT'; end if;

  v_target := v_ordered[mod(v_idx, cardinality(v_ordered)) + 1];

  insert into peer_reviews (assignment_id, reviewer_id, reviewee_submission_id, rating, comment)
  select p_assignment_id, v_me, s.id, p_rating, p_comment
  from homework_submissions s
  where s.assignment_id = p_assignment_id and s.student_id = v_target;

exception when unique_violation then
  raise exception 'ALREADY_REVIEWED';
end;
$$;

revoke execute on function public.submit_peer_review from anon;
grant execute on function public.submit_peer_review to authenticated;

create or replace function public.open_peer_review(p_assignment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'STAFF_ONLY'; end if;
  select count(*) into v_count from homework_submissions where assignment_id = p_assignment_id;
  if v_count < 2 then raise exception 'NOT_ENOUGH_SUBMISSIONS'; end if;
  insert into peer_review_participants (assignment_id, student_id)
    select p_assignment_id, student_id from homework_submissions where assignment_id = p_assignment_id
  on conflict do nothing;
  update homework_assignments set peer_review_open = true where id = p_assignment_id;
end;
$$;

revoke execute on function public.open_peer_review from anon;
grant execute on function public.open_peer_review to authenticated;

-- ============ session ratings (F4) ============

create table public.session_ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table public.session_ratings enable row level security;

create policy "ratings: insert own when ended" on public.session_ratings
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from sessions s where s.id = session_id and s.ended_at is not null)
  );
create policy "ratings: own read" on public.session_ratings
  for select to authenticated using (student_id = auth.uid());

-- Staff aggregate view; notes shuffled to break insertion-order→identity correlation.
create view public.session_rating_aggregates as
  select r.session_id,
         avg(r.rating)::numeric(3,2) as average_rating,
         count(*) as response_count,
         array_agg(r.note order by random()) filter (where r.note is not null) as notes
  from session_ratings r group by r.session_id;

grant select on public.session_rating_aggregates to authenticated;

-- ============ community chat + shared moderation reports ============

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat: members read" on public.chat_messages for select to authenticated using (true);
create policy "chat: members post" on public.chat_messages
  for insert to authenticated with check (author_id = auth.uid());

-- One shared report queue for main chat AND breakout rooms (F3 scope decision).
create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  message_source text not null check (message_source in ('chat','breakout')),
  message_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

alter table public.moderation_reports enable row level security;

create policy "reports: any member files" on public.moderation_reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports: staff queue only" on public.moderation_reports
  for select to authenticated using (public.is_staff());
create policy "reports: staff triage" on public.moderation_reports
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ============ notifications ============

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications: own only" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ resource library ============

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Grammar','Vocabulary','Idioms','Listening','Worksheets')),
  file_type text not null check (file_type in ('PDF','Audio','Note','Glossary')),
  file_url text,
  size_label text,
  downloads integer not null default 0,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create policy "resources: members read" on public.resources for select to authenticated using (true);
create policy "resources: staff write" on public.resources for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ============ games (§8 + F5) ============

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  difficulty text not null default 'Intermediate',
  round_count integer not null default 5,
  timer_seconds integer not null default 5,
  questions jsonb not null default '[]',
  session_id uuid references public.sessions(id) on delete set null,
  status text not null default 'lobby' check (status in ('lobby','playing','review','ended')),
  current_question integer not null default 0,
  phase text not null default 'submit',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.game_rounds enable row level security;

create policy "rounds: players read" on public.game_rounds for select to authenticated using (true);
create policy "rounds: staff control" on public.game_rounds for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create table public.game_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  question_index integer not null,
  answer jsonb,
  correct boolean,
  created_at timestamptz not null default now(),
  unique (round_id, player_id, question_index)
);

alter table public.game_answers enable row level security;

create policy "answers: own write" on public.game_answers
  for insert to authenticated with check (player_id = auth.uid());
create policy "answers: own + staff read" on public.game_answers
  for select to authenticated using (player_id = auth.uid() or public.is_staff());

create table public.game_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

alter table public.game_submissions enable row level security;

create policy "submissions: room reads, owner writes" on public.game_submissions
  for select to authenticated using (true);
create policy "submissions: insert own" on public.game_submissions
  for insert to authenticated with check (player_id = auth.uid());
create policy "submissions: owner delete" on public.game_submissions
  for delete to authenticated using (player_id = auth.uid());

create table public.game_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.game_submissions(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (submission_id, voter_id)
);

alter table public.game_votes enable row level security;

create policy "votes: players tally" on public.game_votes for select to authenticated using (true);
create policy "votes: cast" on public.game_votes for insert to authenticated with check (voter_id = auth.uid());
create policy "votes: retract" on public.game_votes for delete to authenticated using (voter_id = auth.uid());

-- Self-vote blocked at the DATABASE level (hard rule: never UI-only).
create or replace function public.block_self_vote() returns trigger as $$
declare v_owner uuid;
begin
  select player_id into v_owner from game_submissions where id = new.submission_id;
  if v_owner = new.voter_id then
    raise exception 'SELF_VOTE_BLOCKED';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_no_self_vote
  before insert on public.game_votes
  for each row execute function public.block_self_vote();

create or replace function public.award_game_points(p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_amount int;
begin
  v_amount := case p_reason when 'correct_answer' then 100 else 0 end;
  if v_amount > 0 then
    update profiles set points = points + v_amount where id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.award_game_points from anon;
grant execute on function public.award_game_points to authenticated;

-- ============ breakout rooms (F3) ============

create table public.breakout_rooms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  label text not null,
  capacity smallint not null default 6,
  scenario_prompt text,
  created_at timestamptz not null default now()
);

create table public.breakout_room_members (
  room_id uuid not null references public.breakout_rooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, student_id)
);

create table public.breakout_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.breakout_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.scenario_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  arabic_title text,
  prompt text not null,
  created_at timestamptz not null default now()
);

alter table public.breakout_rooms enable row level security;
alter table public.breakout_room_members enable row level security;
alter table public.breakout_messages enable row level security;
alter table public.scenario_templates enable row level security;

create policy "rooms: browse + staff create" on public.breakout_rooms for select to authenticated using (true);
create policy "rooms: staff manage" on public.breakout_rooms for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "rooms: members create opt-in room" on public.breakout_rooms
  for insert to authenticated with check (true);

create policy "members: occupancy browsable" on public.breakout_room_members
  for select to authenticated using (true);
create policy "members: join/leave own" on public.breakout_room_members
  for insert to authenticated with check (student_id = auth.uid());
create policy "members: leave own" on public.breakout_room_members
  for delete to authenticated using (student_id = auth.uid());

create policy "messages: members only" on public.breakout_messages
  for select to authenticated using (exists (
    select 1 from breakout_room_members m
    where m.room_id = breakout_messages.room_id and m.student_id = auth.uid()));
create policy "messages: post as self while member" on public.breakout_messages
  for insert to authenticated with check (
    author_id = auth.uid() and exists (
      select 1 from breakout_room_members m
      where m.room_id = breakout_messages.room_id and m.student_id = auth.uid()));

create policy "templates: read" on public.scenario_templates for select to authenticated using (true);
create policy "templates: staff write" on public.scenario_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- TOCTOU-safe capacity enforcement inside the INSERT transaction.
create or replace function public.check_room_capacity() returns trigger as $$
begin
  if (select count(*) from breakout_room_members where room_id = new.room_id)
     >= (select capacity from breakout_rooms where id = new.room_id) then
    raise exception 'ROOM_FULL';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_room_capacity
  before insert on public.breakout_room_members
  for each row execute function public.check_room_capacity();

-- ============ gamification ============

create or replace function public.grant_streak_freeze() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_points int;
begin
  select points into v_points from profiles where id = auth.uid() for update;
  if v_points is null or v_points < 25 then return false; end if;
  update profiles
    set points = points - 25, streak_freezes = streak_freezes + 1
    where id = auth.uid();
  return true;
end;
$$;

revoke execute on function public.grant_streak_freeze from anon;
grant execute on function public.grant_streak_freeze to authenticated;

-- ============ AI settings (F7) ============

create table public.ai_settings (
  id boolean primary key default true check (id),
  gemini_key_secret_id uuid,
  configured boolean not null default false,
  last4 text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.ai_settings enable row level security;

-- No policies: clients have zero direct access; service role bypasses RLS.
-- Staff read masked state ONLY through the filtered view below.

create view public.ai_settings_status as
  select configured, last4, updated_by, updated_at
  from ai_settings
  where exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('host','organizer','admin'));

grant select on public.ai_settings_status to authenticated;

-- ============ admin analytics (F6) ============

create materialized view public.admin_overview_stats as
  select
    (select count(*) from profiles where role = 'student') as total_students,
    (select count(distinct user_id) from checkins where checked_in_at::date = current_date) as active_today,
    (select count(*) from sessions where ended_at is null and starts_at >= now()) as upcoming_sessions,
    (select count(*) from moderation_reports where status = 'open') as reported_items,
    now() as refreshed_at;

grant select on public.admin_overview_stats to authenticated;

create or replace function public.refresh_admin_stats_rpc() returns void
language plpgsql security definer as $$
begin
  if not public.is_staff() then raise exception 'STAFF_ONLY'; end if;
  refresh materialized view admin_overview_stats;
end;
$$;
revoke execute on function public.refresh_admin_stats_rpc from anon;
grant execute on function public.refresh_admin_stats_rpc to authenticated;

create view public.admin_student_progress as
  select p.id as student_id, p.nickname, p.avatar, p.level, p.points, p.streak,
    (select count(*) from checkins c where c.user_id = p.id) as total_checkins,
    (select count(*) from homework_submissions h where h.student_id = p.id) as homework_submitted,
    (select count(*) from game_answers g where g.player_id = p.id and g.correct) as game_correct
  from profiles p where p.role = 'student';

grant select on public.admin_student_progress to authenticated;

create view public.admin_session_report as
  select s.id as session_id, s.title, s.starts_at, s.ended_at,
    (select count(*) from checkins c where c.session_id = s.id) as attendance,
    (select count(*) from rsvps r where r.session_id = s.id) as rsvps,
    (select avg(g.rating)::numeric(3,2) from session_ratings g where g.session_id = s.id) as avg_rating,
    (select count(*) from session_ratings g where g.session_id = s.id) as rating_responses
  from sessions s;

grant select on public.admin_session_report to authenticated;

-- ============ seed demo content ============

insert into public.announcements (title, body, category, pinned) values
  ('Welcome to the English Workshop!', 'Our new bilingual hub is live. Check Sessions for the weekly schedule.', 'General', true),
  ('Movie Night: Short Film Session', 'We will watch and discuss an award-winning short film. RSVP on the Sessions tab.', 'Event', false),
  ('Homework 1 due June 20, 2026', 'Write 150 words about your favorite place. Submit under Homework.', 'Homework', false);

insert into public.sessions (title, arabic_title, description, level, format, location, meeting_link, starts_at, duration_minutes) values
  ('Conversation Club — Week 1', 'نادي المحادثة — الأسبوع الأول', 'Speaking practice in small groups.', 'Intermediate', 'Hybrid', 'Main Hall', 'https://meet.example.com/conversation-club', now() + interval '2 days', 60),
  ('Grammar Lab: Present Perfect', 'مختبر القواعد: المضارع التام', 'Master present perfect vs past simple.', 'Beginner', 'Virtual', null, 'https://meet.example.com/grammar-lab', now() + interval '4 days', 45),
  ('Debate Evening', 'أمسية المناظرة', 'Structured debates for advanced speakers.', 'Advanced', 'In-Person', 'Room B', null, now() + interval '7 days', 90);

insert into public.resources (title, category, file_type, size_label, downloads) values
  ('Phrasal Verbs Glossary', 'Vocabulary', 'Glossary', '1.2 MB • 340 downloads', 340),
  ('Listening Pack: Airport Dialogues', 'Listening', 'Audio', '18 MB • 120 downloads', 120),
  ('Tense Summary Notes', 'Grammar', 'Note', '0.8 MB • 512 downloads', 512);

insert into public.homework_assignments (title, description, deadline) values
  ('My Favorite Place', 'Write 150 words describing your favorite place and why you love it.', 'June 20, 2026');

insert into public.scenario_templates (title, prompt) values
  ('Airport Check-in', 'Roleplay: one of you is the check-in agent, the other is a nervous traveler whose flight was delayed.'),
  ('Restaurant Order', 'Roleplay: order a meal, ask about ingredients, and handle a wrong dish politely.'),
  ('Job Interview', 'One of you interviews the other for a dream job. Practice formal register.');
