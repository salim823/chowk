-- ============================================================================
-- Chowk admin live signups — add public.profiles to the supabase_realtime
-- publication so the admin panel gets instant INSERT notifications when
-- someone registers. Run once in Supabase Dashboard → SQL Editor → Run.
-- Idempotent: safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
