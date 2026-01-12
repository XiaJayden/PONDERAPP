-- Push notification tokens table
-- Stores Expo push tokens for each user to enable push notifications

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_user_token_unique unique (user_id, expo_push_token)
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Allow users to insert/update their own push tokens
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_insert_own'
  ) then
    create policy push_tokens_insert_own
      on public.push_tokens
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
  
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_update_own'
  ) then
    create policy push_tokens_update_own
      on public.push_tokens
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_delete_own'
  ) then
    create policy push_tokens_delete_own
      on public.push_tokens
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Function to update updated_at timestamp
create or replace function public.update_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger to automatically update updated_at
drop trigger if exists push_tokens_updated_at_trigger on public.push_tokens;
create trigger push_tokens_updated_at_trigger
  before update on public.push_tokens
  for each row
  execute function public.update_push_tokens_updated_at();
