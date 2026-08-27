create extension if not exists pgcrypto;

create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text not null, created_at timestamptz not null default now());
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles (id, email) select id, email from auth.users where email is not null on conflict (id) do update set email = excluded.email;

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vehicle', 'car_search', 'part_search')),
  title text not null check (char_length(title) between 1 and 160), data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_events (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('car_search', 'part_search', 'part_number_search', 'vehicle_lookup', 'save_item')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists saved_items_user_created_idx on public.saved_items (user_id, created_at desc);
create index if not exists complaints_status_created_idx on public.complaints (status, created_at desc);
create index if not exists activity_events_created_idx on public.activity_events (created_at desc);

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.saved_items enable row level security;
alter table public.complaints enable row level security;
alter table public.activity_events enable row level security;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "Admins read admin membership" on public.admins for select using (auth.uid() = user_id or public.is_admin());
create policy "Users read own saved items" on public.saved_items for select using (auth.uid() = user_id or public.is_admin());
create policy "Users create own saved items" on public.saved_items for insert with check (auth.uid() = user_id);
create policy "Users delete own saved items" on public.saved_items for delete using (auth.uid() = user_id);
create policy "Users create own complaints" on public.complaints for insert with check (auth.uid() = user_id);
create policy "Users read own complaints" on public.complaints for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins update complaints" on public.complaints for update using (public.is_admin()) with check (public.is_admin());
create policy "Users create own events" on public.activity_events for insert with check (auth.uid() = user_id);
create policy "Users read own events and admins read all" on public.activity_events for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.limit_complaint_submissions() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.complaints where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Complaint submission limit reached. Please try again later.';
  end if;
  return new;
end;
$$;
create trigger limit_complaints_before_insert before insert on public.complaints for each row execute procedure public.limit_complaint_submissions();

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then raise exception 'The owner account cannot be self-deleted.'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Run once after creating the owner's account, replacing the email:
-- insert into public.admins (user_id) select id from auth.users where email = 'owner@example.com' on conflict do nothing;
