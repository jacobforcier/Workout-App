-- Optional per-athlete weekly plan. NULL = use the app's default rotation.
-- Seven entries, Monday first; each is a workout id from src/content/workouts.json
-- or NULL for a rest day.

alter table public.athletes
  add column if not exists custom_rotation text[]
  check (custom_rotation is null or cardinality(custom_rotation) = 7);
