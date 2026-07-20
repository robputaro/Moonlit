-- Stories by Ami: Stripe membership, webhook idempotency, and atomic story credits.
-- Run this entire file in Supabase SQL Editor after moonlit_platform_foundation.sql.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

create unique index if not exists subscriptions_one_per_user on public.subscriptions(user_id);
create unique index if not exists story_credit_reference_unique
  on public.story_credit_ledger(reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

alter table public.subscriptions alter column plan set default 'ami_monthly';
update public.subscriptions set plan = 'ami_monthly' where plan = 'moonlit_monthly';

create or replace function public.story_credit_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(sum(amount), 0)::integer)
  from public.story_credit_ledger
  where user_id = p_user_id;
$$;

create or replace function public.reserve_story_credit(p_user_id uuid, p_reference_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  admin_user boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  select role = 'admin' into admin_user from public.profiles where id = p_user_id;
  if coalesce(admin_user, false) then return 999; end if;

  if exists (
    select 1 from public.story_credit_ledger
    where reference_type = 'story_generation_reservation' and reference_id = p_reference_id
  ) then
    return public.story_credit_balance(p_user_id);
  end if;

  current_balance := public.story_credit_balance(p_user_id);
  if current_balance < 1 then raise exception 'NO_STORY_CREDITS'; end if;

  insert into public.story_credit_ledger(user_id, amount, reason, reference_type, reference_id)
  values (p_user_id, -1, 'Story generation reserved', 'story_generation_reservation', p_reference_id);
  return current_balance - 1;
end;
$$;

create or replace function public.refund_story_credit(p_user_id uuid, p_reference_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if not exists (
    select 1 from public.story_credit_ledger
    where user_id = p_user_id and reference_type = 'story_generation_reservation' and reference_id = p_reference_id
  ) then
    return public.story_credit_balance(p_user_id);
  end if;
  insert into public.story_credit_ledger(user_id, amount, reason, reference_type, reference_id)
  values (p_user_id, 1, 'Failed story generation restored', 'story_generation_refund', p_reference_id)
  on conflict (reference_type, reference_id) where reference_type is not null and reference_id is not null do nothing;
  return public.story_credit_balance(p_user_id);
end;
$$;

create or replace function public.grant_monthly_story_credits(
  p_user_id uuid,
  p_invoice_id text,
  p_amount integer default 2,
  p_cap integer default 4
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  grant_amount integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if exists (
    select 1 from public.story_credit_ledger
    where reference_type = 'stripe_invoice_credit_grant' and reference_id = p_invoice_id
  ) then
    return public.story_credit_balance(p_user_id);
  end if;
  current_balance := public.story_credit_balance(p_user_id);
  grant_amount := greatest(0, least(p_amount, p_cap - current_balance));
  insert into public.story_credit_ledger(user_id, amount, reason, reference_type, reference_id)
  values (p_user_id, grant_amount, 'Monthly Ami Membership credits', 'stripe_invoice_credit_grant', p_invoice_id);
  return current_balance + grant_amount;
end;
$$;

revoke all on function public.reserve_story_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.refund_story_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_monthly_story_credits(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_story_credit(uuid, text) to service_role;
grant execute on function public.refund_story_credit(uuid, text) to service_role;
grant execute on function public.grant_monthly_story_credits(uuid, text, integer, integer) to service_role;
