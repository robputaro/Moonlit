-- AMI product-family foundation and free Adventure Book entitlement.
-- Run this entire file once in the Supabase SQL Editor before enabling the feature.

create extension if not exists pgcrypto;

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_name text not null,
  age integer check (age between 0 and 18),
  age_band text,
  pronouns text,
  appearance_notes text,
  interests text,
  character_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists child_profiles_user_updated_idx on public.child_profiles(user_id, updated_at desc);

create table if not exists public.ami_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete set null,
  product_type text not null,
  title text,
  theme text,
  status text not null default 'draft',
  project_data jsonb not null default '{}'::jsonb,
  source_project_id uuid references public.ami_projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ami_projects_user_updated_idx on public.ami_projects(user_id, updated_at desc);
create index if not exists ami_projects_child_idx on public.ami_projects(child_profile_id, updated_at desc);
create index if not exists ami_projects_product_idx on public.ami_projects(product_type, status);

create table if not exists public.activity_templates (
  id text primary key,
  version integer not null default 1,
  name text not null,
  theme_ids text[] not null default '{}',
  age_bands text[] not null default '{}',
  difficulty integer not null default 1,
  activity_type text not null,
  template_path text,
  required_assets jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '{}'::jsonb,
  answer_key jsonb,
  metadata jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adventure_book_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'available' check (status in ('available','used','revoked')),
  project_id uuid references public.ami_projects(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.child_profiles enable row level security;
alter table public.ami_projects enable row level security;
alter table public.activity_templates enable row level security;
alter table public.adventure_book_entitlements enable row level security;

drop policy if exists "Users manage own child profiles" on public.child_profiles;
create policy "Users manage own child profiles" on public.child_profiles for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users manage own AMI projects" on public.ami_projects;
create policy "Users manage own AMI projects" on public.ami_projects for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Customers read enabled activities" on public.activity_templates;
create policy "Customers read enabled activities" on public.activity_templates for select using (enabled or public.is_admin());
drop policy if exists "Admins manage activities" on public.activity_templates;
create policy "Admins manage activities" on public.activity_templates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users read own Adventure entitlement" on public.adventure_book_entitlements;
create policy "Users read own Adventure entitlement" on public.adventure_book_entitlements for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.create_free_ami_adventure_book(
  p_user_id uuid,
  p_child_name text,
  p_age integer,
  p_age_band text,
  p_pronouns text,
  p_appearance text,
  p_interests text,
  p_theme text,
  p_library_version text,
  p_page_plan jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_child_id uuid;
  v_project_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select status into v_status from public.adventure_book_entitlements where user_id = v_user_id for update;
  if v_status = 'used' then raise exception 'ADVENTURE_BOOK_ALREADY_USED'; end if;

  select id into v_child_id
  from public.child_profiles
  where user_id = v_user_id and lower(first_name) = lower(trim(p_child_name))
  order by updated_at desc limit 1;

  if v_child_id is null then
    insert into public.child_profiles (user_id, first_name, age, age_band, pronouns, appearance_notes, interests)
    values (v_user_id, trim(p_child_name), p_age, p_age_band, nullif(p_pronouns,''), nullif(p_appearance,''), nullif(p_interests,''))
    returning id into v_child_id;
  else
    update public.child_profiles set age = p_age, age_band = p_age_band,
      pronouns = coalesce(nullif(p_pronouns,''), pronouns),
      appearance_notes = coalesce(nullif(p_appearance,''), appearance_notes),
      interests = coalesce(nullif(p_interests,''), interests), updated_at = now()
    where id = v_child_id;
  end if;

  insert into public.ami_projects (user_id, child_profile_id, product_type, title, theme, status, project_data)
  values (v_user_id, v_child_id, 'adventure_book_free_20', trim(p_child_name) || '''s AMI Adventure Book', p_theme, 'complete',
    jsonb_build_object('age',p_age,'age_band',p_age_band,'library_version',p_library_version,'page_count',20,'page_plan',coalesce(p_page_plan,'[]'::jsonb),'format','digital_letter_pdf'))
  returning id into v_project_id;

  insert into public.adventure_book_entitlements (user_id, status, project_id, used_at)
  values (v_user_id, 'used', v_project_id, now())
  on conflict (user_id) do update set status = 'used', project_id = excluded.project_id, used_at = now(), updated_at = now();

  return v_project_id;
end;
$$;

revoke all on function public.create_free_ami_adventure_book(uuid,text,integer,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.create_free_ami_adventure_book(uuid,text,integer,text,text,text,text,text,text,jsonb) from authenticated;
grant execute on function public.create_free_ami_adventure_book(uuid,text,integer,text,text,text,text,text,text,jsonb) to service_role;

-- Seed metadata for the first reusable library. Template rendering remains versioned in application code for v1.
insert into public.activity_templates (id,name,theme_ids,age_bands,difficulty,activity_type,metadata)
values
  ('bookplate-v1','Personalized ownership page',array['dinosaurs','outer-space','princess-magic'],array['2-3','4-5','6-7','8-10'],1,'bookplate','{"personalization":"name"}'),
  ('trace-path-v1','Adventure tracing path',array['dinosaurs','outer-space','princess-magic'],array['2-3','4-5','6-7','8-10'],2,'trace-path','{"personalization":"light"}'),
  ('matching-v1','Themed matching',array['dinosaurs','outer-space','princess-magic'],array['2-3','4-5','6-7'],2,'matching','{"answer_key":true}'),
  ('maze-v1','Themed maze',array['dinosaurs','outer-space','princess-magic'],array['4-5','6-7','8-10'],3,'maze','{"answer_key":true}'),
  ('draw-world-v1','Draw the next discovery',array['dinosaurs','outer-space','princess-magic'],array['2-3','4-5','6-7','8-10'],1,'creative-drawing','{"personalization":"name-theme"}'),
  ('word-code-v1','Secret word code',array['dinosaurs','outer-space','princess-magic'],array['6-7','8-10'],4,'code','{"answer_key":true}'),
  ('certificate-v1','AMI Explorer certificate',array['dinosaurs','outer-space','princess-magic'],array['2-3','4-5','6-7','8-10'],1,'certificate','{"personalization":"name"}')
on conflict (id) do update set metadata = excluded.metadata, updated_at = now();
