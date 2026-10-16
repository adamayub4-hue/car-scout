begin;

create or replace function public.delete_user_account(
  target_user_id uuid,
  confirmation_email text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := auth.uid();
  target_email text;
  deleted_user_id uuid;
begin
  if caller_user_id is null or public.is_admin() is not true then
    raise exception using errcode = '42501', message = 'Only an owner can delete an account.';
  end if;

  -- Hold the caller's membership until completion, including during concurrent revocation.
  perform 1 from public.admins as caller_admin
  where caller_admin.user_id = caller_user_id
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'Only an owner can delete an account.';
  end if;

  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Choose an account to delete.';
  end if;
  if target_user_id = caller_user_id then
    raise exception using errcode = '42501', message = 'You cannot delete your own owner account.';
  end if;
  if confirmation_email is null or pg_catalog.btrim(confirmation_email) = '' then
    raise exception using errcode = '22023', message = 'Type the account email to confirm deletion.';
  end if;

  -- This row lock also conflicts with the foreign-key check for a concurrent admin promotion.
  select target.email into target_email
  from auth.users as target
  where target.id = target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The account no longer exists. Refresh the account list.';
  end if;

  -- Check after acquiring the auth row, so an already committed promotion is protected.
  if exists (select 1 from public.admins as protected_admin where protected_admin.user_id = target_user_id) then
    raise exception using errcode = '42501', message = 'Owner accounts cannot be deleted here.';
  end if;
  if target_email is null or pg_catalog.lower(pg_catalog.btrim(target_email)) <> pg_catalog.lower(pg_catalog.btrim(confirmation_email)) then
    raise exception using errcode = '22023', message = 'The confirmation email does not match. Refresh the account list and try again.';
  end if;

  -- auth.users deletion and all ON DELETE CASCADE changes share this transaction.
  delete from auth.users as target
  where target.id = target_user_id
  returning target.id into deleted_user_id;
  if not found or deleted_user_id is distinct from target_user_id then
    raise exception using errcode = 'P0002', message = 'The account was not deleted. Refresh the account list.';
  end if;
  return deleted_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid, text) from public, anon;
grant execute on function public.delete_user_account(uuid, text) to authenticated;

commit;
