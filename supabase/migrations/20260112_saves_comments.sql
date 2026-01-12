-- Post saves and comments tables
-- Enables users to save posts to their gallery and comment on posts

-- 1) Create post_saves table
create table if not exists public.post_saves (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.yim_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_saves_post_user_unique unique (post_id, user_id)
);

create index if not exists post_saves_post_id_idx
  on public.post_saves (post_id);

create index if not exists post_saves_user_id_idx
  on public.post_saves (user_id);

create index if not exists post_saves_user_id_created_at_idx
  on public.post_saves (user_id, created_at desc);

alter table public.post_saves enable row level security;

-- Allow users to insert/delete their own saves
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_saves'
      and policyname = 'post_saves_insert_own'
  ) then
    create policy post_saves_insert_own
      on public.post_saves
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
  
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_saves'
      and policyname = 'post_saves_delete_own'
  ) then
    create policy post_saves_delete_own
      on public.post_saves
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
  
  -- Allow users to read all saves (for displaying save status)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_saves'
      and policyname = 'post_saves_select_all'
  ) then
    create policy post_saves_select_all
      on public.post_saves
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- 2) Create post_comments table
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.yim_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx
  on public.post_comments (post_id);

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments (post_id, created_at asc);

create index if not exists post_comments_user_id_idx
  on public.post_comments (user_id);

alter table public.post_comments enable row level security;

-- Allow users to insert/delete their own comments
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_comments'
      and policyname = 'post_comments_insert_own'
  ) then
    create policy post_comments_insert_own
      on public.post_comments
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
  
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_comments'
      and policyname = 'post_comments_delete_own'
  ) then
    create policy post_comments_delete_own
      on public.post_comments
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
  
  -- Allow all authenticated users to read comments
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'post_comments'
      and policyname = 'post_comments_select_all'
  ) then
    create policy post_comments_select_all
      on public.post_comments
      for select
      to authenticated
      using (true);
  end if;
end $$;
