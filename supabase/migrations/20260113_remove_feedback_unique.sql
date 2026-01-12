-- Remove the unique constraint on user_feedback to allow multiple submissions per day
-- Previously: one feedback per user per day (upsert behavior)
-- Now: unlimited feedback per user per day (insert behavior)

alter table public.user_feedback
  drop constraint if exists user_feedback_user_day_unique;
