drop policy if exists "Admins read events" on public.activity_events;
drop policy if exists "Users read own events and admins read all" on public.activity_events;
create policy "Users read own events and admins read all" on public.activity_events for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.limit_complaint_submissions() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.complaints where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Complaint submission limit reached. Please try again later.';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_complaints_before_insert on public.complaints;
create trigger limit_complaints_before_insert before insert on public.complaints for each row execute procedure public.limit_complaint_submissions();

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then raise exception 'The owner account cannot be self-deleted.'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
