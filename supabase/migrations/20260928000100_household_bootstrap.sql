-- Household bootstrap ("seed on first sign-up") and invite claiming.
--
-- The app calls public.ensure_household(name) right after a user signs in and
-- has no household yet. It is idempotent:
--   1. Already a member?            -> return that household.
--   2. Pending invite for my email? -> join that household as 'adult'.
--      (Only when the email is confirmed, so nobody can claim an invite by
--       signing up with someone else's address.)
--   3. Otherwise                    -> create a household and join as 'owner'.

create or replace function public.ensure_household(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_household uuid;
  v_invite uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select m.household_id into v_household
  from public.household_members m
  where m.user_id = v_uid
  order by m.created_at
  limit 1;
  if v_household is not null then
    return v_household;
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_confirmed is not null then
    select i.id, i.household_id into v_invite, v_household
    from public.household_invites i
    where i.email = v_email and i.accepted_at is null
    order by i.created_at
    limit 1;

    if v_invite is not null then
      insert into public.household_members (user_id, household_id, role)
      values (v_uid, v_household, 'adult');
      update public.household_invites set accepted_at = now() where id = v_invite;
      return v_household;
    end if;
  end if;

  insert into public.households (name)
  values (coalesce(nullif(trim(p_name), ''), 'Our household'))
  returning id into v_household;

  insert into public.household_members (user_id, household_id, role)
  values (v_uid, v_household, 'owner');

  return v_household;
end;
$$;

revoke all on function public.ensure_household(text) from public;
grant execute on function public.ensure_household(text) to authenticated;
