-- Supabase grants EXECUTE on public functions to anon/authenticated directly,
-- so `revoke ... from public` alone doesn't remove them. Signed-out users get
-- no access to any helper, and the trigger function isn't callable at all.
-- (authenticated keeps EXECUTE on the RLS helpers and ensure_household: the
-- policies and the app need them, and they only answer for auth.uid().)

revoke execute on function public.is_household_member(uuid) from anon;
revoke execute on function public.is_household_owner(uuid) from anon;
revoke execute on function public.athlete_household(uuid) from anon;
revoke execute on function public.session_household(uuid) from anon;
revoke execute on function public.ensure_household(text) from anon;
revoke execute on function public.check_session_athlete() from public, anon, authenticated;
