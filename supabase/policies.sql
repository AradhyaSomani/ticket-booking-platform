-- EVENTS
create policy "events_select_all"
  on events for select
  using (true);

create policy "events_insert_own"
  on events for insert
  with check (auth.uid() = owner_id);

create policy "events_update_own"
  on events for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "events_delete_own"
  on events for delete
  using (auth.uid() = owner_id);

-- SEATS: read-only from the client; all writes go through SECURITY DEFINER functions
create policy "seats_select_all"
  on seats for select
  using (true);

-- BOOKINGS: own bookings, or bookings for events you own
create policy "bookings_select_own"
  on bookings for select
  using (
    auth.uid() = user_id
    or auth.uid() in (
      select owner_id from events where events.id = bookings.event_id
    )
  );

-- PROFILES: readable by anyone (only email + id; no sensitive data)
create policy "profiles_select_all"
  on profiles for select
  using (true);

-- HOLDS: readable by anyone, so the seat map can grey out held seats live
create policy "holds_select_all"
  on holds for select
  using (true);

-- STORAGE: event cover images
create policy "cover_public_read"
  on storage.objects for select
  using (bucket_id = 'event-covers');

create policy "cover_owner_write"
  on storage.objects for insert
  with check (bucket_id = 'event-covers' and auth.uid()::text = (storage.foldername(name))[1]);