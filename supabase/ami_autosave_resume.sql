-- AMI autosave/resume metadata lives inside stories.story_data, so no schema change is required.
-- This compatibility migration documents and verifies the required stories table.
do $$
begin
  if to_regclass('public.stories') is null then
    raise exception 'public.stories is missing. Run supabase/setup.sql first.';
  end if;
end $$;
