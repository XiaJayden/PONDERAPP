-- Fix RLS policies for push_tokens table
-- This migration ensures the policies are properly created

-- Drop existing policies if they exist (safe to do)
drop policy if exists push_tokens_insert_own on public.push_tokens;
drop policy if exists push_tokens_update_own on public.push_tokens;
drop policy if exists push_tokens_delete_own on public.push_tokens;
drop policy if exists push_tokens_select_own on public.push_tokens;

-- Recreate the policies
create policy push_tokens_insert_own
  on public.push_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy push_tokens_update_own
  on public.push_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_tokens_delete_own
  on public.push_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Also add a select policy so users can read their own tokens
create policy push_tokens_select_own
  on public.push_tokens
  for select
  to authenticated
  using (user_id = auth.uid());
