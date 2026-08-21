create extension if not exists pgcrypto;

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('vehicle', 'car_search', 'part_search')),
  title text not null check (char_length(title) between 1 and 160),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);

alter table public.saved_items enable row level security;

create policy "Users can read their own saved items"
  on public.saved_items for select
  using ((select auth.uid()) = user_id);

create policy "Users can create their own saved items"
  on public.saved_items for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved items"
  on public.saved_items for delete
  using ((select auth.uid()) = user_id);
