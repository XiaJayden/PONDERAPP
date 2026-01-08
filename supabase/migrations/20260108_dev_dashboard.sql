-- Dev dashboard schema additions
-- Apply this in Supabase SQL editor (or via migrations if you use supabase CLI).

-- 1) Implicit event tracking
create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  event_type text not null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_events_user_id_created_at_idx
  on public.user_events (user_id, created_at desc);

create index if not exists user_events_event_type_created_at_idx
  on public.user_events (event_type, created_at desc);

alter table public.user_events enable row level security;

-- Allow clients to insert only their own events (reads are dashboard/admin-side).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_events'
      and policyname = 'user_events_insert_own'
  ) then
    create policy user_events_insert_own
      on public.user_events
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

-- 2) Explicit daily feedback
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  feedback_date date not null,
  rating integer,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_feedback_user_day_unique unique (user_id, feedback_date)
);

create index if not exists user_feedback_user_id_feedback_date_idx
  on public.user_feedback (user_id, feedback_date desc);

alter table public.user_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_feedback'
      and policyname = 'user_feedback_upsert_own'
  ) then
    -- Allow insert/update for own feedback rows (one per day).
    create policy user_feedback_upsert_own
      on public.user_feedback
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- 3) Dev overrides for prompt window testing
create table if not exists public.dev_prompt_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  force_open boolean not null default false,
  force_closed boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dev_prompt_overrides_user_id_created_at_idx
  on public.dev_prompt_overrides (user_id, created_at desc);

alter table public.dev_prompt_overrides enable row level security;

-- Allow users to read their own overrides (needed so the mobile app can respect dashboard overrides).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dev_prompt_overrides'
      and policyname = 'dev_prompt_overrides_select_own'
  ) then
    create policy dev_prompt_overrides_select_own
      on public.dev_prompt_overrides
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Writes remain admin-only (dashboard uses service role).


