-- Link a login to its own athlete profile, so the app opens as that person.
-- Kids and others without a login keep user_id null and are picked from the switcher.
alter table public.athletes add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists athletes_household_user_idx on public.athletes (household_id, user_id) where user_id is not null;
