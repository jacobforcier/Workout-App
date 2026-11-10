-- Nutrition tracking: per-athlete daily targets, a household food library,
-- and a meal log holding both planned and eaten entries.
-- Meal entries store their own macros (a snapshot), so editing a library
-- food never rewrites past days.

create table public.nutrition_targets (
  athlete_id uuid primary key references public.athletes (id) on delete cascade,
  kcal integer not null check (kcal > 0),
  protein_g integer not null check (protein_g > 0),
  fat_g integer check (fat_g > 0),
  carbs_g integer check (carbs_g > 0),
  fiber_g integer check (fiber_g > 0),
  flex_kcal integer not null default 0 check (flex_kcal >= 0),
  window_start time,
  window_end time,
  notes text,
  updated_at timestamptz not null default now()
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text,
  serving_label text not null,
  serving_g numeric check (serving_g > 0),
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  fat_g numeric check (fat_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fiber_g numeric check (fiber_g >= 0),
  source text,
  created_at timestamptz not null default now()
);
create unique index foods_household_name_idx on public.foods (household_id, lower(name));

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  eaten_on date not null default current_date,
  meal text not null check (meal in ('meal_1', 'meal_2', 'meal_3', 'flex', 'other')),
  position integer not null default 0,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  amount_label text,
  grams numeric check (grams > 0),
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  fat_g numeric check (fat_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fiber_g numeric check (fiber_g >= 0),
  status text not null default 'planned' check (status in ('planned', 'eaten', 'skipped')),
  notes text,
  created_at timestamptz not null default now()
);
create index meal_entries_athlete_day_idx on public.meal_entries (athlete_id, eaten_on);

alter table public.nutrition_targets enable row level security;
alter table public.foods enable row level security;
alter table public.meal_entries enable row level security;

create policy nutrition_targets_all on public.nutrition_targets
  for all to authenticated
  using (public.is_household_member(public.athlete_household(athlete_id)))
  with check (public.is_household_member(public.athlete_household(athlete_id)));

create policy foods_all on public.foods
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy meal_entries_all on public.meal_entries
  for all to authenticated
  using (public.is_household_member(public.athlete_household(athlete_id)))
  with check (public.is_household_member(public.athlete_household(athlete_id)));
