alter table public.activity_events
drop constraint if exists activity_events_event_name_check;

alter table public.activity_events
add constraint activity_events_event_name_check
check (event_name in ('car_search', 'part_search', 'part_number_search', 'vehicle_lookup', 'save_item'));
