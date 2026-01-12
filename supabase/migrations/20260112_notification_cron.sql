-- pg_cron jobs for scheduled push notifications
-- These jobs call the send-notifications Edge Function at 6AM and 6PM PST
--
-- IMPORTANT: Supabase requires pg_net extension for HTTP requests from pg_cron.
-- This migration assumes pg_net is available. If not, you may need to:
-- 1. Enable pg_net extension in Supabase Dashboard → Database → Extensions
-- 2. Or use Supabase's built-in cron functionality via Dashboard → Database → Cron Jobs

-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Enable pg_net extension for HTTP requests (Supabase's recommended extension)
create extension if not exists pg_net;

-- Configuration table to store Supabase URL and service role key
-- This avoids needing ALTER DATABASE permissions
create table if not exists public.notification_config (
  id text primary key default 'default',
  supabase_url text not null,
  service_role_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.notification_config enable row level security;

-- Allow service_role and postgres (pg_cron context) to read/write
-- Regular users cannot access this table for security
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_config'
      and policyname = 'notification_config_service_role_all'
  ) then
    create policy notification_config_service_role_all
      on public.notification_config
      for all
      to service_role, postgres
      using (true)
      with check (true);
  end if;
end $$;

-- Function to call the Edge Function via pg_net
-- This uses the service_role key stored in the config table
create or replace function public.call_notification_edge_function(trigger_time text)
returns void
language plpgsql
security definer
as $$
declare
  supabase_url text;
  service_role_key text;
  function_url text;
  job_id bigint;
begin
  -- Get configuration from the notification_config table
  select n.supabase_url, n.service_role_key
  into supabase_url, service_role_key
  from public.notification_config n
  where n.id = 'default'
  limit 1;
  
  -- If not set, raise error with instructions
  if supabase_url is null or service_role_key is null then
    raise exception 'Notification config not set. Run: INSERT INTO public.notification_config (supabase_url, service_role_key) VALUES (''https://your-project.supabase.co'', ''your-service-role-key'') ON CONFLICT (id) DO UPDATE SET supabase_url = EXCLUDED.supabase_url, service_role_key = EXCLUDED.service_role_key;';
  end if;
  
  -- Construct Edge Function URL
  function_url := supabase_url || '/functions/v1/send-notifications?trigger_time=' || trigger_time;
  
  -- Call the Edge Function via pg_net
  -- pg_net.http_post returns a job_id, but we don't need to wait for it
  select net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  ) into job_id;
  
  -- Log the job ID (optional)
  raise notice 'Scheduled HTTP request job_id: % for trigger_time: %', job_id, trigger_time;
end;
$$;

-- Schedule cron jobs
-- 6AM PST = 14:00 UTC (standard time) or 13:00 UTC (daylight time)
-- Using 14:00 UTC as a compromise (will be 6AM PST or 7AM PDT)
-- Note: The Edge Function handles phase detection, so slight timing variations are OK

-- Remove existing jobs if they exist (ignore errors if they don't exist)
do $$
begin
  perform cron.unschedule('notification-6am-pst');
exception when others then
  -- Job doesn't exist, that's fine
end $$;

do $$
begin
  perform cron.unschedule('notification-6pm-pst');
exception when others then
  -- Job doesn't exist, that's fine
end $$;

-- Schedule 6AM PST job (runs daily at 14:00 UTC)
select cron.schedule(
  'notification-6am-pst',
  '0 14 * * *', -- 14:00 UTC daily
  $$select public.call_notification_edge_function('6am')$$
);

-- Schedule 6PM PST job (runs daily at 02:00 UTC, which is 6PM PST previous day)
-- Note: 6PM PST = 02:00 UTC next day
select cron.schedule(
  'notification-6pm-pst',
  '0 2 * * *', -- 02:00 UTC daily (6PM PST previous day)
  $$select public.call_notification_edge_function('6pm')$$
);

-- Grant execute permission to postgres role (pg_cron runs as postgres)
grant execute on function public.call_notification_edge_function(text) to postgres;

-- Grant access to config table (function needs to read it)
grant select on public.notification_config to postgres;

-- IMPORTANT SETUP INSTRUCTIONS:
-- 
-- 1. Enable pg_net extension in Supabase Dashboard:
--    Dashboard → Database → Extensions → Search "pg_net" → Enable
--
-- 2. Set notification configuration (run in SQL Editor):
--    INSERT INTO public.notification_config (supabase_url, service_role_key)
--    VALUES ('https://your-project.supabase.co', 'your-service-role-key')
--    ON CONFLICT (id) DO UPDATE 
--    SET supabase_url = EXCLUDED.supabase_url, 
--        service_role_key = EXCLUDED.service_role_key,
--        updated_at = now();
--
--    Find these values in:
--    - Supabase Dashboard → Settings → API → Project URL
--    - Supabase Dashboard → Settings → API → service_role key (secret, click "Reveal")
--
-- 3. Verify cron jobs are scheduled:
--    SELECT * FROM cron.job WHERE jobname LIKE 'notification-%';
--
-- 4. Test manually:
--    SELECT public.call_notification_edge_function('6am');
--
-- Alternative: If pg_net is not available, use Supabase Dashboard → Database → Cron Jobs
-- to create cron jobs that call the Edge Function URL directly.
