-- Household recipe book. Macros are per serving.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  summary text,
  source_name text,
  source_url text,
  category text not null default 'other' check (category in ('breakfast', 'lunch', 'meal_3', 'dinner', 'snack', 'dessert', 'other')),
  servings numeric not null default 1 check (servings > 0),
  serving_label text,
  prep_minutes integer check (prep_minutes >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  steps text[] not null default '{}',
  notes text,
  kcal numeric check (kcal >= 0),
  protein_g numeric check (protein_g >= 0),
  fat_g numeric check (fat_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fiber_g numeric check (fiber_g >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.recipes.ingredients is 'Array of {item, amount, note?}';
comment on column public.recipes.kcal is 'Per serving';
create unique index recipes_household_name_idx on public.recipes (household_id, lower(name));

alter table public.recipes enable row level security;
create policy recipes_all on public.recipes
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
