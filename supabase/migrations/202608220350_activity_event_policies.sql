drop policy if exists "Users create own events" on public.activity_events;
create policy "Users create own events"
on public.activity_events
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users read own events and admins read all" on public.activity_events;
create policy "Users read own events and admins read all"
on public.activity_events
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());
