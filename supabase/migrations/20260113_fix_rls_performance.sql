-- Fix RLS policy performance issues
-- 1) Fix auth_rls_initplan: wrap auth.uid() in (select ...) to avoid re-evaluation per row
-- 2) Fix multiple_permissive_policies: consolidate duplicate policies

-- =============================================================================
-- PART 1: Fix auth_rls_initplan warnings
-- Replace auth.uid() with (select auth.uid()) in all affected policies
-- =============================================================================

-- ---- user_events ----
drop policy if exists user_events_insert_own on public.user_events;
create policy user_events_insert_own
  on public.user_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- ---- user_feedback ----
drop policy if exists user_feedback_upsert_own on public.user_feedback;
create policy user_feedback_upsert_own
  on public.user_feedback
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---- dev_prompt_overrides ----
drop policy if exists dev_prompt_overrides_select_own on public.dev_prompt_overrides;
create policy dev_prompt_overrides_select_own
  on public.dev_prompt_overrides
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- post_likes ----
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own
  on public.post_likes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own
  on public.post_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- post_saves ----
drop policy if exists post_saves_insert_own on public.post_saves;
create policy post_saves_insert_own
  on public.post_saves
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists post_saves_delete_own on public.post_saves;
create policy post_saves_delete_own
  on public.post_saves
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- post_comments ----
drop policy if exists post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own
  on public.post_comments
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists post_comments_delete_own on public.post_comments;
create policy post_comments_delete_own
  on public.post_comments
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- notifications ----
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---- push_tokens ----
drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own
  on public.push_tokens
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own
  on public.push_tokens
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own
  on public.push_tokens
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own
  on public.push_tokens
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- PART 2: Fix multiple_permissive_policies warnings
-- Consolidate duplicate policies into single policies per action
-- =============================================================================

-- ---- chains table ----
-- Drop all existing duplicate policies
drop policy if exists "Allow users to delete own chains" on public.chains;
drop policy if exists "Users can manage their own chains" on public.chains;
drop policy if exists "Allow authenticated users to create chains" on public.chains;
drop policy if exists "Chains are viewable by authenticated users" on public.chains;
drop policy if exists "Allow users to update own chains" on public.chains;
drop policy if exists "Allow authenticated users to read chains" on public.chains;

-- Create single consolidated policies for chains
create policy chains_select_authenticated
  on public.chains
  for select
  to authenticated
  using (true);

create policy chains_insert_authenticated
  on public.chains
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy chains_update_own
  on public.chains
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy chains_delete_own
  on public.chains
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- daily_prompts table ----
-- Drop duplicate SELECT policies
drop policy if exists "Users can view prompts" on public.daily_prompts;
drop policy if exists daily_prompts_select_authenticated on public.daily_prompts;

-- Create single consolidated SELECT policy
create policy daily_prompts_select_authenticated
  on public.daily_prompts
  for select
  to authenticated
  using (true);

-- ---- friend_invitations table ----
-- Drop duplicate SELECT policies
drop policy if exists "Users can view invitations by token for acceptance" on public.friend_invitations;
drop policy if exists "Users can view invitations they created" on public.friend_invitations;

-- Create single consolidated SELECT policy (allows viewing own invitations OR by token)
create policy friend_invitations_select
  on public.friend_invitations
  for select
  to authenticated
  using (
    inviter_id = (select auth.uid())
    or token is not null
  );

-- ---- friendships table ----
-- Drop duplicate SELECT policies
drop policy if exists "Users can manage their own friendships" on public.friendships;
drop policy if exists "Users can see their own friendships" on public.friendships;

-- Create single consolidated SELECT policy
create policy friendships_select_own
  on public.friendships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or friend_id = (select auth.uid())
  );

-- ---- yim_posts table ----
-- Drop duplicate SELECT policies
drop policy if exists "Users can manage their own YIM posts" on public.yim_posts;
drop policy if exists "YIM posts are readable by authenticated users" on public.yim_posts;

-- Create single consolidated SELECT policy
create policy yim_posts_select_authenticated
  on public.yim_posts
  for select
  to authenticated
  using (true);
