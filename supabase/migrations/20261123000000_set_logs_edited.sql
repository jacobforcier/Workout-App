-- Whether the athlete changed a set's pre-filled numbers (reps, weight, seconds).
-- Null on sets saved before this was tracked.
alter table public.set_logs add column if not exists edited boolean;
