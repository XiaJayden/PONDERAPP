-- Activity notifications table
-- Tracks when users interact with your posts (likes, comments, saves)

-- 1) Create notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.yim_posts(id) on delete cascade,
  notification_type text not null check (notification_type in ('like', 'comment', 'save')),
  comment_id uuid references public.post_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_read_at_idx
  on public.notifications (user_id, read_at)
  where read_at is null;

create index if not exists notifications_post_id_idx
  on public.notifications (post_id);

alter table public.notifications enable row level security;

-- Allow users to read their own notifications
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select_own'
  ) then
    create policy notifications_select_own
      on public.notifications
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
  
  -- Allow users to update their own notifications (for marking as read)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_update_own'
  ) then
    create policy notifications_update_own
      on public.notifications
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  
  -- Allow service_role and postgres to insert (for triggers)
  -- Note: security definer functions run as the function owner, but RLS still applies
  -- We need to allow inserts from the function context
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_insert_service_role'
  ) then
    create policy notifications_insert_service_role
      on public.notifications
      for insert
      to service_role, postgres
      with check (true);
  end if;
end $$;

-- 2) Function to create notification (prevents duplicate notifications for same action)
create or replace function public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_post_id uuid,
  p_notification_type text,
  p_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_notification_id uuid;
  v_post_author_id uuid;
begin
  -- Don't notify yourself
  if p_user_id = p_actor_id then
    return null;
  end if;
  
  -- Get post author to ensure we're notifying the right person
  select author_id into v_post_author_id
  from public.yim_posts
  where id = p_post_id;
  
  -- Verify the post exists and the user_id matches the post author
  if v_post_author_id is null then
    return null;
  end if;
  
  if v_post_author_id != p_user_id then
    -- This shouldn't happen if triggers call correctly, but safety check
    return null;
  end if;
  
  -- Check if notification already exists (prevent duplicates)
  -- For likes/saves: check if notification exists in last 5 minutes
  -- For comments: allow multiple (one per comment)
  if p_notification_type in ('like', 'save') then
    select id into v_notification_id
    from public.notifications
    where user_id = p_user_id
      and actor_id = p_actor_id
      and post_id = p_post_id
      and notification_type = p_notification_type
      and created_at > now() - interval '5 minutes';
    
    if v_notification_id is not null then
      return v_notification_id;
    end if;
  end if;
  
  -- Create notification
  -- Note: Since this is a security definer function, it should bypass RLS
  -- But we'll wrap in a try-catch to handle any issues gracefully
  begin
    insert into public.notifications (
      user_id,
      actor_id,
      post_id,
      notification_type,
      comment_id
    )
    values (
      p_user_id,
      p_actor_id,
      p_post_id,
      p_notification_type,
      p_comment_id
    )
    returning id into v_notification_id;
    
    return v_notification_id;
  exception
    when others then
      -- Log error for debugging but don't fail the trigger
      -- This allows the like/comment/save to succeed even if notification fails
      raise warning 'Failed to create notification for user %, actor %, post %, type %: %', 
        p_user_id, p_actor_id, p_post_id, p_notification_type, sqlerrm;
      return null;
  end;
end;
$$;

-- 3) Trigger function for post_likes
create or replace function public.notify_post_liked()
returns trigger
language plpgsql
security definer
as $$
declare
  v_post_author_id uuid;
begin
  -- Get post author
  select author_id into v_post_author_id
  from public.yim_posts
  where id = new.post_id;
  
  -- Create notification for post author
  if v_post_author_id is not null then
    perform public.create_notification(
      v_post_author_id,
      new.user_id,
      new.post_id,
      'like'
    );
  end if;
  
  return new;
end;
$$;

-- 4) Trigger function for post_comments
create or replace function public.notify_post_commented()
returns trigger
language plpgsql
security definer
as $$
declare
  v_post_author_id uuid;
begin
  -- Get post author
  select author_id into v_post_author_id
  from public.yim_posts
  where id = new.post_id;
  
  -- Create notification for post author
  if v_post_author_id is not null then
    perform public.create_notification(
      v_post_author_id,
      new.user_id,
      new.post_id,
      'comment',
      new.id
    );
  end if;
  
  return new;
end;
$$;

-- 5) Trigger function for post_saves
create or replace function public.notify_post_saved()
returns trigger
language plpgsql
security definer
as $$
declare
  v_post_author_id uuid;
begin
  -- Get post author
  select author_id into v_post_author_id
  from public.yim_posts
  where id = new.post_id;
  
  -- Create notification for post author
  if v_post_author_id is not null then
    perform public.create_notification(
      v_post_author_id,
      new.user_id,
      new.post_id,
      'save'
    );
  end if;
  
  return new;
end;
$$;

-- 6) Create triggers
drop trigger if exists post_likes_notify_trigger on public.post_likes;
create trigger post_likes_notify_trigger
  after insert on public.post_likes
  for each row
  execute function public.notify_post_liked();

drop trigger if exists post_comments_notify_trigger on public.post_comments;
create trigger post_comments_notify_trigger
  after insert on public.post_comments
  for each row
  execute function public.notify_post_commented();

drop trigger if exists post_saves_notify_trigger on public.post_saves;
create trigger post_saves_notify_trigger
  after insert on public.post_saves
  for each row
  execute function public.notify_post_saved();
