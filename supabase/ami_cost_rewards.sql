-- AMI: AI cost visibility and safe surprise rewards.
-- Run this entire file in Supabase SQL Editor.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid references public.stories(id) on delete set null,
  operation text not null,
  provider text not null,
  model text not null,
  status text not null default 'succeeded' check (status in ('succeeded','failed')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  image_count integer not null default 0,
  quality text,
  size text,
  reference_image boolean not null default false,
  estimated_cost_micros bigint not null default 0,
  provider_request_id text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_story_created_idx on public.ai_usage_events(story_id, created_at desc);
create index if not exists ai_usage_user_created_idx on public.ai_usage_events(user_id, created_at desc);
alter table public.ai_usage_events enable row level security;

drop policy if exists "Users can read their own AI usage" on public.ai_usage_events;
create policy "Users can read their own AI usage" on public.ai_usage_events
for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.ami_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('extra_regeneration','theme_unlock','story_credit','print_discount')),
  quantity integer not null default 1 check (quantity > 0),
  consumed_quantity integer not null default 0 check (consumed_quantity >= 0),
  trigger text not null,
  reference_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  granted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, reward_type, trigger, reference_id)
);

create index if not exists ami_rewards_user_created_idx on public.ami_reward_ledger(user_id, created_at desc);
alter table public.ami_reward_ledger enable row level security;

drop policy if exists "Users can read their own AMI rewards" on public.ami_reward_ledger;
create policy "Users can read their own AMI rewards" on public.ami_reward_ledger
for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.grant_ami_reward(
  p_user_id uuid,
  p_reward_type text,
  p_quantity integer,
  p_trigger text,
  p_reference_id text,
  p_metadata jsonb default '{}'::jsonb,
  p_granted_by uuid default null,
  p_expires_at timestamptz default null
)
returns public.ami_reward_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  reward public.ami_reward_ledger;
begin
  if p_reward_type not in ('extra_regeneration','theme_unlock','story_credit','print_discount') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;
  insert into public.ami_reward_ledger(user_id,reward_type,quantity,trigger,reference_id,metadata,granted_by,expires_at)
  values (p_user_id,p_reward_type,greatest(1,p_quantity),p_trigger,p_reference_id,coalesce(p_metadata,'{}'::jsonb),p_granted_by,p_expires_at)
  on conflict (user_id,reward_type,trigger,reference_id) do update
    set metadata = public.ami_reward_ledger.metadata
  returning * into reward;
  return reward;
end;
$$;

create or replace function public.consume_ami_reward(
  p_user_id uuid,
  p_reward_type text,
  p_quantity integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_id uuid;
begin
  select id into reward_id
  from public.ami_reward_ledger
  where user_id = p_user_id
    and reward_type = p_reward_type
    and consumed_quantity < quantity
    and (expires_at is null or expires_at > now())
  order by expires_at nulls last, created_at
  for update skip locked
  limit 1;
  if reward_id is null then return false; end if;
  update public.ami_reward_ledger
  set consumed_quantity = least(quantity, consumed_quantity + greatest(1,p_quantity))
  where id = reward_id;
  return true;
end;
$$;

revoke all on function public.grant_ami_reward(uuid,text,integer,text,text,jsonb,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.consume_ami_reward(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.grant_ami_reward(uuid,text,integer,text,text,jsonb,uuid,timestamptz) to service_role;
grant execute on function public.consume_ami_reward(uuid,text,integer) to service_role;
