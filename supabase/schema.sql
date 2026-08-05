-- ============================================================================
-- MoneySmart — Supabase schema
-- ============================================================================
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query -> Run).
-- It is idempotent-ish: safe to re-run in a fresh project. Enables Row Level
-- Security so every household's data is isolated to its own members.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- A "household" is a shared budget space that family members join.
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);

-- Membership links an auth user to a household.
create table if not exists public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'member',   -- 'owner' | 'member'
  joined_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Money buckets: checking, savings, cash, credit card, etc.
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            text not null,
  type            text not null default 'checking',   -- checking | savings | cash | credit | other
  starting_balance numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- Spending / income categories.
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  kind         text not null default 'expense',   -- expense | income
  color        text not null default '#10b981',
  icon         text not null default 'tag',
  created_at   timestamptz not null default now()
);

-- Individual money movements.
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id   uuid references public.accounts (id) on delete set null,
  category_id  uuid references public.categories (id) on delete set null,
  kind         text not null default 'expense',   -- expense | income
  amount       numeric(14,2) not null check (amount >= 0),
  description  text,
  occurred_on  date not null default current_date,
  created_by   uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now()
);

-- A monthly spending limit for a category. `month` is the first day of the month.
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  amount       numeric(14,2) not null check (amount >= 0),
  month        date not null,
  created_at   timestamptz not null default now(),
  unique (category_id, month)
);

-- Helpful indexes for the common queries.
create index if not exists idx_members_user       on public.household_members (user_id);
create index if not exists idx_members_household   on public.household_members (household_id);
create index if not exists idx_accounts_household  on public.accounts (household_id);
create index if not exists idx_categories_house    on public.categories (household_id);
create index if not exists idx_tx_household_date   on public.transactions (household_id, occurred_on);
create index if not exists idx_budgets_house_month on public.budgets (household_id, month);

-- ----------------------------------------------------------------------------
-- Membership helper (SECURITY DEFINER avoids RLS recursion on household_members)
-- ----------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts          enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;

-- households: members can read their households; anyone signed in can create one.
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (public.is_household_member(id) or created_by = auth.uid());

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert with check (created_by = auth.uid());

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (public.is_household_member(id));

-- household_members: you can see your own rows and fellow members; you may add
-- yourself (join) and remove yourself (leave).
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select using (user_id = auth.uid() or public.is_household_member(household_id));

drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members
  for insert with check (user_id = auth.uid());

drop policy if exists members_update on public.household_members;
create policy members_update on public.household_members
  for update using (user_id = auth.uid());

drop policy if exists members_delete on public.household_members;
create policy members_delete on public.household_members
  for delete using (user_id = auth.uid());

-- Generic per-household policies for the data tables.
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets']
  loop
    execute format('drop policy if exists %1$s_all on public.%1$s;', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id));', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- RPCs used by the app (SECURITY DEFINER so they can bootstrap membership)
-- ----------------------------------------------------------------------------

-- Create a household, add the caller as owner, and seed default categories.
create or replace function public.create_household(household_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  insert into public.households (name, created_by)
  values (household_name, auth.uid())
  returning id into hid;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (hid, auth.uid(), coalesce(nullif(member_name, ''), 'Me'), 'owner');

  insert into public.categories (household_id, name, kind, color, icon) values
    (hid, 'Groceries',      'expense', '#22c55e', 'shopping-cart'),
    (hid, 'Rent/Mortgage',  'expense', '#3b82f6', 'home'),
    (hid, 'Utilities',      'expense', '#f59e0b', 'zap'),
    (hid, 'Transport',      'expense', '#8b5cf6', 'car'),
    (hid, 'Dining Out',     'expense', '#ef4444', 'utensils'),
    (hid, 'Entertainment',  'expense', '#ec4899', 'tv'),
    (hid, 'Health',         'expense', '#14b8a6', 'heart-pulse'),
    (hid, 'Kids',           'expense', '#f97316', 'baby'),
    (hid, 'Savings',        'expense', '#06b6d4', 'piggy-bank'),
    (hid, 'Salary',         'income',  '#10b981', 'wallet'),
    (hid, 'Other Income',   'income',  '#84cc16', 'plus');

  return hid;
end;
$$;

-- Join an existing household by its invite code. Returns the household id.
create or replace function public.join_household(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select id into hid from public.households
  where lower(invite_code) = lower(trim(code));

  if hid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id, display_name)
  values (hid, auth.uid(), coalesce(nullif(member_name, ''), 'Member'))
  on conflict (household_id, user_id) do nothing;

  return hid;
end;
$$;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text)  to authenticated;
grant execute on function public.is_household_member(uuid)   to authenticated;
