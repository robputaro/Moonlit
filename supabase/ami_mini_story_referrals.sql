-- AMI Mini Stories + referrals
create extension if not exists pgcrypto;

create table if not exists public.mini_story_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'available' check (status in ('available','reserved','used')),
  generation_id text,
  reserved_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'signed_up' check (status in ('signed_up','paid','rewarded','reversed')),
  first_paid_invoice_id text unique,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

create index if not exists referrals_referrer_idx on public.referrals(referrer_user_id, created_at desc);

alter table public.mini_story_entitlements enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "Users read own mini entitlement" on public.mini_story_entitlements;
create policy "Users read own mini entitlement" on public.mini_story_entitlements for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users read own referral code" on public.referral_codes;
create policy "Users read own referral code" on public.referral_codes for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Users read own referrals" on public.referrals;
create policy "Users read own referrals" on public.referrals for select using (referrer_user_id = auth.uid() or referred_user_id = auth.uid() or public.is_admin());

create or replace function public.ensure_ami_referral_code(p_user_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_code text;
begin
  select code into v_code from public.referral_codes where user_id = p_user_id;
  if v_code is not null then return v_code; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    begin
      insert into public.referral_codes(user_id, code) values (p_user_id, v_code);
      return v_code;
    exception when unique_violation then null;
    end;
  end loop;
end;
$$;

create or replace function public.reserve_free_mini_story(p_user_id uuid, p_generation_id text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_status text; v_generation text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  insert into public.mini_story_entitlements(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select status, generation_id into v_status, v_generation from public.mini_story_entitlements where user_id = p_user_id for update;
  if v_status = 'used' then raise exception 'MINI_STORY_ALREADY_USED'; end if;
  if v_status = 'reserved' and v_generation = p_generation_id then return 'reserved'; end if;
  if v_status = 'reserved' then raise exception 'MINI_STORY_IN_PROGRESS'; end if;
  update public.mini_story_entitlements set status='reserved', generation_id=p_generation_id, reserved_at=now(), updated_at=now() where user_id=p_user_id;
  return 'reserved';
end;
$$;

create or replace function public.complete_free_mini_story(p_user_id uuid, p_generation_id text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.mini_story_entitlements set status='used', used_at=now(), updated_at=now()
  where user_id=p_user_id and status='reserved' and generation_id=p_generation_id;
end;
$$;

create or replace function public.release_free_mini_story(p_user_id uuid, p_generation_id text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.mini_story_entitlements set status='available', generation_id=null, reserved_at=null, updated_at=now()
  where user_id=p_user_id and status='reserved' and generation_id=p_generation_id;
end;
$$;

create or replace function public.capture_ami_referral(p_referred_user_id uuid, p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_referrer uuid;
begin
  select user_id into v_referrer from public.referral_codes where upper(code)=upper(trim(p_code));
  if v_referrer is null or v_referrer = p_referred_user_id then return false; end if;
  insert into public.referrals(referrer_user_id, referred_user_id, referral_code)
  values (v_referrer, p_referred_user_id, upper(trim(p_code)))
  on conflict (referred_user_id) do nothing;
  return found;
end;
$$;

create or replace function public.reward_paid_referral(p_referred_user_id uuid, p_invoice_id text, p_monthly_cap integer default 5)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_referral public.referrals%rowtype; v_count integer;
begin
  select * into v_referral from public.referrals where referred_user_id=p_referred_user_id and status='signed_up' for update;
  if not found then return false; end if;
  select count(*) into v_count from public.referrals where referrer_user_id=v_referral.referrer_user_id and status='rewarded' and rewarded_at >= date_trunc('month', now());
  update public.referrals set first_paid_invoice_id=p_invoice_id, status='paid', updated_at=now() where id=v_referral.id;
  if v_count >= p_monthly_cap then return false; end if;
  insert into public.story_credit_ledger(user_id, amount, reason, reference_type, reference_id)
  values (v_referral.referrer_user_id, 1, 'AMI referral bonus credit', 'ami_referral_reward', v_referral.id::text)
  on conflict (reference_type, reference_id) where reference_type is not null and reference_id is not null do nothing;
  update public.referrals set status='rewarded', rewarded_at=now(), updated_at=now() where id=v_referral.id;
  return true;
end;
$$;

revoke all on function public.ensure_ami_referral_code(uuid) from public, anon, authenticated;
revoke all on function public.reserve_free_mini_story(uuid,text) from public, anon, authenticated;
revoke all on function public.complete_free_mini_story(uuid,text) from public, anon, authenticated;
revoke all on function public.release_free_mini_story(uuid,text) from public, anon, authenticated;
revoke all on function public.capture_ami_referral(uuid,text) from public, anon, authenticated;
revoke all on function public.reward_paid_referral(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.ensure_ami_referral_code(uuid) to service_role;
grant execute on function public.reserve_free_mini_story(uuid,text) to service_role;
grant execute on function public.complete_free_mini_story(uuid,text) to service_role;
grant execute on function public.release_free_mini_story(uuid,text) to service_role;
grant execute on function public.capture_ami_referral(uuid,text) to service_role;
grant execute on function public.reward_paid_referral(uuid,text,integer) to service_role;
