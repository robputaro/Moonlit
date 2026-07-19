-- Moonlit platform foundation: roles, subscriptions, credits, Studio orders, versions, proofs, and print tracking.
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'moonlit_monthly',
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  member_print_discount_cents integer not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  reference_type text,
  reference_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id text unique,
  product_type text not null,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_orders (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual',
  external_order_id text,
  customer_name text,
  customer_email text,
  child_name text,
  product_type text not null default 'studio_hardcover',
  language text not null default 'en',
  status text not null default 'new_order',
  payment_status text not null default 'pending',
  due_date date,
  shipping_address jsonb not null default '{}'::jsonb,
  intake_data jsonb not null default '{}'::jsonb,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_books (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.studio_orders(id) on delete cascade,
  source_story_id uuid,
  title text,
  story_data jsonb not null default '{}'::jsonb,
  current_version integer not null default 1,
  approval_status text not null default 'internal_review',
  approved_at timestamptz,
  approved_by_name text,
  proof_token text unique default encode(gen_random_bytes(18), 'hex'),
  interior_pdf_path text,
  cover_pdf_path text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_versions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.studio_books(id) on delete cascade,
  version_number integer not null,
  story_json jsonb not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(book_id, version_number)
);

create table if not exists public.revision_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.studio_books(id) on delete cascade,
  customer_message text not null,
  status text not null default 'open',
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.proof_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.studio_books(id) on delete cascade,
  event_type text not null,
  customer_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.print_orders (
  id uuid primary key default gen_random_uuid(),
  studio_book_id uuid not null references public.studio_books(id) on delete cascade,
  provider text not null default 'lulu',
  provider_job_id text,
  status text not null default 'not_submitted',
  print_cost_cents integer,
  shipping_cost_cents integer,
  tracking_number text,
  tracking_url text,
  submitted_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email, updated_at = now();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.story_credit_ledger enable row level security;
alter table public.purchases enable row level security;
alter table public.studio_orders enable row level security;
alter table public.studio_books enable row level security;
alter table public.book_versions enable row level security;
alter table public.revision_requests enable row level security;
alter table public.proof_events enable row level security;
alter table public.print_orders enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users read own credit ledger" on public.story_credit_ledger;
create policy "Users read own credit ledger" on public.story_credit_ledger for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users read own purchases" on public.purchases;
create policy "Users read own purchases" on public.purchases for select using (user_id = auth.uid() or public.is_admin());

create policy "Admins manage studio orders" on public.studio_orders for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage studio books" on public.studio_books for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage book versions" on public.book_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage revision requests" on public.revision_requests for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage proof events" on public.proof_events for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage print orders" on public.print_orders for all using (public.is_admin()) with check (public.is_admin());

-- IMPORTANT: replace the email below with your own Moonlit login email, then run this statement.
-- update public.profiles set role = 'admin' where lower(email) = lower('YOUR_EMAIL_HERE');
