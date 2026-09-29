begin;

-- Preserve every existing search/vehicle save. Listings are separate kinds.
alter table public.saved_items drop constraint if exists saved_items_kind_check;
alter table public.saved_items add constraint saved_items_kind_check
  check (kind in ('vehicle', 'car_search', 'part_search', 'car_listing', 'part_listing'));

alter table public.saved_items drop constraint if exists saved_items_listing_data_check;
alter table public.saved_items add constraint saved_items_listing_data_check check (
  kind not in ('car_listing', 'part_listing') or (
    jsonb_typeof(data) = 'object'
    and data->>'version' = '1'
    and data->>'id' ~ '^[0-9]{9,15}(:[0-9]{1,20})?$'
    and char_length(data->>'url') between 1 and 256
    and data->>'url' ~ '^https://(www\.|m\.)?ebay\.(co\.uk|com)/itm/[0-9]{9,15}(\?var=[0-9]{1,20})?$'
  ) is true
);

-- Cross-tab retries return the existing listing. No UPDATE policy or changes
-- to historical saved searches are needed; RLS remains owner-scoped.
create unique index if not exists saved_items_listing_identity_idx
  on public.saved_items (user_id, kind, (data->>'id'))
  where kind in ('car_listing', 'part_listing');

commit;
