create extension if not exists pgcrypto;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  child_name text,
  cover_path text,
  form_data jsonb not null default '{}'::jsonb,
  story_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_user_updated_idx on public.stories(user_id, updated_at desc);

alter table public.stories enable row level security;

drop policy if exists "Users can read their stories" on public.stories;
create policy "Users can read their stories" on public.stories
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their stories" on public.stories;
create policy "Users can create their stories" on public.stories
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their stories" on public.stories;
create policy "Users can update their stories" on public.stories
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their stories" on public.stories;
create policy "Users can delete their stories" on public.stories
for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('story-assets', 'story-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read their story assets" on storage.objects;
create policy "Users can read their story assets" on storage.objects
for select to authenticated
using (bucket_id = 'story-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their story assets" on storage.objects;
create policy "Users can upload their story assets" on storage.objects
for insert to authenticated
with check (bucket_id = 'story-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their story assets" on storage.objects;
create policy "Users can update their story assets" on storage.objects
for update to authenticated
using (bucket_id = 'story-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'story-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their story assets" on storage.objects;
create policy "Users can delete their story assets" on storage.objects
for delete to authenticated
using (bucket_id = 'story-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
