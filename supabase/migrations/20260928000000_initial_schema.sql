-- Kettlebell Family Trainer: initial schema.
-- Every table has RLS enabled. Access is limited to members of the owning
-- household through public.is_household_member().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.household_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  role text not null check (role in ('owner', 'adult')),
  created_at timestamptz not null default now(),
  primary key (user_id, household_id)
);
create index household_members_household_idx on public.household_members (household_id);

-- Pending invitations for the second adult. Claimed by public.ensure_household().
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (household_id, email)
);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('adult', 'kid')),
  current_bell_lb integer not null default 18 check (current_bell_lb > 0),
  available_bells_lb integer[] not null default '{}',
  has_pullup_bar boolean not null default false,
  has_dip_bars boolean not null default false,
  created_at timestamptz not null default now()
);
create index athletes_household_idx on public.athletes (household_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  workout_id text not null,
  performed_on date not null default current_date,
  started_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  bell_lb integer check (bell_lb > 0),
  rpe smallint check (rpe between 1 and 10),
  feel smallint check (feel between 1 and 5),
  trained_fasted boolean,
  notes text,
  completed boolean not null default false
);
create index sessions_athlete_date_idx on public.sessions (athlete_id, performed_on desc);
create index sessions_household_idx on public.sessions (household_id);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id text not null,
  set_number integer not null check (set_number >= 1),
  reps integer check (reps >= 0),
  weight_lb numeric check (weight_lb >= 0),
  seconds integer check (seconds >= 0),
  side text not null default 'both' check (side in ('left', 'right', 'both')),
  -- Rest (seconds) the athlete used after this set; drives the "shorten rest" suggestion.
  rest_sec integer check (rest_sec >= 0)
);
create index set_logs_session_idx on public.set_logs (session_id);

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  test_id text not null,
  tested_on date not null default current_date,
  value numeric not null,
  notes text
);
create index benchmarks_athlete_idx on public.benchmarks (athlete_id, tested_on);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  measured_on date not null default current_date,
  bodyweight_lb numeric check (bodyweight_lb > 0),
  waist_in numeric check (waist_in > 0)
);
create index body_metrics_athlete_idx on public.body_metrics (athlete_id, measured_on);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = is_household_member.household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = is_household_owner.household_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

create or replace function public.athlete_household(athlete_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.household_id from public.athletes a where a.id = athlete_household.athlete_id;
$$;

create or replace function public.session_household(session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.household_id from public.sessions s where s.id = session_household.session_id;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.athlete_household(uuid) from public;
revoke all on function public.session_household(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.athlete_household(uuid) to authenticated;
grant execute on function public.session_household(uuid) to authenticated;

-- A session's athlete must belong to the session's household.
create or replace function public.check_session_athlete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.athlete_household(new.athlete_id) is distinct from new.household_id then
    raise exception 'athlete does not belong to this household';
  end if;
  return new;
end;
$$;

create trigger sessions_check_athlete
before insert or update on public.sessions
for each row execute function public.check_session_athlete();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.athletes enable row level security;
alter table public.sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.benchmarks enable row level security;
alter table public.body_metrics enable row level security;

-- households: members read; owner renames. Creation happens via ensure_household().
create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));

-- household_members: members see each other. Rows are written by ensure_household().
create policy members_select on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

-- household_invites: owner manages.
create policy invites_select on public.household_invites
  for select to authenticated using (public.is_household_member(household_id));
create policy invites_insert on public.household_invites
  for insert to authenticated with check (public.is_household_owner(household_id));
create policy invites_delete on public.household_invites
  for delete to authenticated using (public.is_household_owner(household_id));

-- athletes
create policy athletes_all on public.athletes
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- sessions
create policy sessions_all on public.sessions
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- set_logs (through the parent session)
create policy set_logs_all on public.set_logs
  for all to authenticated
  using (public.is_household_member(public.session_household(session_id)))
  with check (public.is_household_member(public.session_household(session_id)));

-- benchmarks (through the athlete)
create policy benchmarks_all on public.benchmarks
  for all to authenticated
  using (public.is_household_member(public.athlete_household(athlete_id)))
  with check (public.is_household_member(public.athlete_household(athlete_id)));

-- body_metrics (through the athlete)
create policy body_metrics_all on public.body_metrics
  for all to authenticated
  using (public.is_household_member(public.athlete_household(athlete_id)))
  with check (public.is_household_member(public.athlete_household(athlete_id)));
