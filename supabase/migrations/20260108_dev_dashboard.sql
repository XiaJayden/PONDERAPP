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

-- 4) Allow service role (dashboard) to manage daily_prompts
-- Note: Service role should bypass RLS automatically, but this ensures access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_prompts'
      and policyname = 'daily_prompts_service_role_all'
  ) then
    create policy daily_prompts_service_role_all
      on public.daily_prompts
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- 4b) Allow authenticated users to read daily_prompts (mobile app needs this)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_prompts'
      and policyname = 'daily_prompts_select_authenticated'
  ) then
    create policy daily_prompts_select_authenticated
      on public.daily_prompts
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- 5) Remove publish_at_1pm_pst column from daily_prompts (no longer needed)
alter table public.daily_prompts drop column if exists publish_at_1pm_pst;

-- 6) Make display_order nullable (dashboard allows optional display_order)
alter table public.daily_prompts alter column display_order drop not null;

-- 7) Alpha auto-friend feature flag
create table if not exists public.alpha_auto_friend_config (
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Initialize with enabled = true if table is empty
insert into public.alpha_auto_friend_config (enabled)
select true
where not exists (select 1 from public.alpha_auto_friend_config);

-- 8) Auto-friend function
-- Automatically creates friendships between a new user and all existing users
-- when they complete onboarding (onboarding_complete becomes true)
create or replace function public.auto_friend_all_users()
returns trigger
language plpgsql
security definer
as $$
declare
  config_enabled boolean;
  existing_user_id uuid;
  friendship_exists boolean;
begin
  -- Check if feature flag is enabled
  select enabled into config_enabled
  from public.alpha_auto_friend_config
  limit 1;
  
  -- If feature is disabled, do nothing
  if not config_enabled then
    return new;
  end if;
  
  -- Only proceed if onboarding_complete just became true
  -- (was false/null before, is true now)
  if new.onboarding_complete = true and (old.onboarding_complete is null or old.onboarding_complete = false) then
    -- Get all existing users who have completed onboarding (excluding the new user)
    for existing_user_id in
      select id
      from public.profiles
      where id != new.id
        and onboarding_complete = true
    loop
      -- Check if friendship already exists (either direction)
      select exists(
        select 1
        from public.friendships
        where (
          (user_id = new.id and friend_id = existing_user_id)
          or (user_id = existing_user_id and friend_id = new.id)
        )
        and status = 'accepted'
      ) into friendship_exists;
      
      -- Only create friendship if it doesn't already exist
      if not friendship_exists then
        -- Create friendship: new user -> existing user
        insert into public.friendships (user_id, friend_id, status)
        values (new.id, existing_user_id, 'accepted')
        on conflict do nothing;
        
        -- Note: Based on the codebase, one row is enough for bidirectional querying
        -- But we could also create the reverse if needed. For now, one row suffices.
      end if;
    end loop;
  end if;
  
  return new;
end;
$$;

-- 9) Trigger to call auto-friend function when onboarding_complete changes
drop trigger if exists profiles_auto_friend_trigger on public.profiles;

create trigger profiles_auto_friend_trigger
  after update on public.profiles
  for each row
  when (new.onboarding_complete = true and (old.onboarding_complete is null or old.onboarding_complete = false))
  execute function public.auto_friend_all_users();

-- 10) Extend user_feedback table for prompt-specific feedback
alter table public.user_feedback
  add column if not exists prompt_id text,
  add column if not exists would_share boolean;

-- Add index for prompt_id queries
create index if not exists user_feedback_prompt_id_idx
  on public.user_feedback (prompt_id)
  where prompt_id is not null;

-- 11) Create post_likes table for social acknowledgements
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.yim_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_unique unique (post_id, user_id)
);

create index if not exists post_likes_post_id_idx
  on public.post_likes (post_id);

create index if not exists post_likes_user_id_idx
  on public.post_likes (user_id);

alter table public.post_likes enable row level security;

-- Allow users to insert/delete their own likes
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'post_likes_insert_own'
  ) then
    create policy post_likes_insert_own
      on public.post_likes
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
  
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'post_likes_delete_own'
  ) then
    create policy post_likes_delete_own
      on public.post_likes
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
  
  -- Allow users to read all likes (for displaying like counts)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_likes'
      and policyname = 'post_likes_select_all'
  ) then
    create policy post_likes_select_all
      on public.post_likes
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- 12) Add word_count column to yim_posts for response depth tracking
alter table public.yim_posts
  add column if not exists word_count integer;

create index if not exists yim_posts_word_count_idx
  on public.yim_posts (word_count)
  where word_count is not null;


