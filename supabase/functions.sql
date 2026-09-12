-- ============================================================
-- create_event_with_seats — validated event creation + auto seat generation
-- ============================================================
create or replace function create_event_with_seats(
  p_title text, p_description text, p_venue text, p_starts_at timestamptz,
  p_price numeric, p_rows int, p_cols int, p_premium_rows text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  r int; c int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_rows < 1 or p_rows > 20 or p_cols < 1 or p_cols > 20 then
    raise exception 'Rows and columns must be between 1 and 20';
  end if;
  if p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;
  if p_starts_at <= now() then
    raise exception 'Event date must be in the future';
  end if;

  insert into events (owner_id, title, description, venue, starts_at, price, rows, cols)
  values (auth.uid(), p_title, p_description, p_venue, p_starts_at, p_price, p_rows, p_cols)
  returning id into v_event_id;

  insert into seats (event_id, label, row_index, col_index, category, price_override)
  select v_event_id,
         chr(65 + r) || (c + 1)::text,
         r, c,
         case when chr(65 + r) = any(p_premium_rows) then 'premium' else 'standard' end,
         case when chr(65 + r) = any(p_premium_rows) then round(p_price * 1.5, 2) else null end
  from generate_series(0, p_rows - 1) r
  cross join generate_series(0, p_cols - 1) c;

  return v_event_id;
end;
$$;

revoke all on function create_event_with_seats(text,text,text,timestamptz,numeric,int,int,text[]) from public;
grant execute on function create_event_with_seats(text,text,text,timestamptz,numeric,int,int,text[]) to authenticated;


-- ============================================================
-- book_seats — the atomic, race-proof booking function
-- ============================================================
create or replace function book_seats(p_event_id uuid, p_seat_ids uuid[])
returns table (booking_id uuid, seat_id uuid, label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event   events%rowtype;
  v_seat_count int;
  v_conflict_label text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'No seats selected';
  end if;

  if array_length(p_seat_ids, 1) > 4 then
    raise exception 'You can book a maximum of 4 seats' using errcode = 'P0001';
  end if;

  select * into v_event from events where id = p_event_id for share;
  if not found then
    raise exception 'Event not found';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'This event has already started or passed' using errcode = 'P0002';
  end if;

  select count(distinct s.id) into v_seat_count
  from seats s
  where s.id = any(p_seat_ids) and s.event_id = p_event_id;

  if v_seat_count <> array_length(p_seat_ids, 1) then
    raise exception 'One or more seats are invalid for this event';
  end if;

  -- lock candidate rows in a fixed order to serialize concurrent attempts
  perform 1
  from seats s
  where s.id = any(p_seat_ids)
  order by s.id
  for update;

  select s.label into v_conflict_label
  from seats s
  join bookings b on b.seat_id = s.id and b.status = 'booked'
  where s.id = any(p_seat_ids)
  limit 1;

  if v_conflict_label is not null then
    raise exception 'Seat % was just booked by someone else', v_conflict_label
      using errcode = 'P0003';
  end if;

  -- release any hold the caller had on these seats now that they're booked
  delete from holds where seat_id = any(p_seat_ids) and user_id = v_user_id;

  return query
  insert into bookings (seat_id, event_id, user_id, status)
  select s.id, p_event_id, v_user_id, 'booked'
  from seats s
  where s.id = any(p_seat_ids)
  returning id as booking_id, seat_id,
    (select label from seats where seats.id = bookings.seat_id);
end;
$$;

revoke all on function book_seats(uuid, uuid[]) from public;
grant execute on function book_seats(uuid, uuid[]) to authenticated;


-- ============================================================
-- cancel_booking
-- ============================================================
create or replace function cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking bookings%rowtype;
  v_event   events%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'Not your booking';
  end if;

  select * into v_event from events where id = v_booking.event_id;
  if v_event.starts_at <= now() then
    raise exception 'Cannot cancel after the event has started';
  end if;

  update bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

revoke all on function cancel_booking(uuid) from public;
grant execute on function cancel_booking(uuid) to authenticated;


-- ============================================================
-- hold_seats / release_hold — 5-minute soft reservation
-- ============================================================
create or replace function hold_seats(p_event_id uuid, p_seat_ids uuid[])
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_expires timestamptz := now() + interval '5 minutes';
  v_conflict text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if array_length(p_seat_ids, 1) > 4 then
    raise exception 'You can hold a maximum of 4 seats';
  end if;

  delete from holds where expires_at <= now();

  perform 1 from seats where id = any(p_seat_ids) order by id for update;

  select s.label into v_conflict
  from seats s
  where s.id = any(p_seat_ids)
    and (
      exists (select 1 from bookings b where b.seat_id = s.id and b.status = 'booked')
      or exists (select 1 from holds h where h.seat_id = s.id and h.user_id <> v_user_id and h.expires_at > now())
    )
  limit 1;

  if v_conflict is not null then
    raise exception 'Seat % is no longer available', v_conflict;
  end if;

  insert into holds (seat_id, user_id, expires_at)
  select s.id, v_user_id, v_expires from seats s where s.id = any(p_seat_ids)
  on conflict (seat_id) do update set user_id = excluded.user_id, expires_at = excluded.expires_at;

  return v_expires;
end;
$$;
revoke all on function hold_seats(uuid, uuid[]) from public;
grant execute on function hold_seats(uuid, uuid[]) to authenticated;

create or replace function release_hold(p_seat_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from holds where seat_id = any(p_seat_ids) and user_id = auth.uid();
end;
$$;
revoke all on function release_hold(uuid[]) from public;
grant execute on function release_hold(uuid[]) to authenticated;


-- ============================================================
-- get_event_attendees — owner-only attendee list with emails
-- ============================================================
create or replace function get_event_attendees(p_event_id uuid)
returns table (booking_id uuid, seat_label text, email text, checked_in_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from events where id = p_event_id and owner_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  return query
  select b.id, s.label, p.email, b.checked_in_at, b.created_at
  from bookings b
  join seats s on s.id = b.seat_id
  join profiles p on p.id = b.user_id
  where b.event_id = p_event_id and b.status = 'booked'
  order by s.row_index, s.col_index;
end;
$$;
revoke all on function get_event_attendees(uuid) from public;
grant execute on function get_event_attendees(uuid) to authenticated;


-- ============================================================
-- check_in — organiser-only, one-time
-- ============================================================
create or replace function check_in(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select e.owner_id into v_owner
  from bookings b join events e on e.id = b.event_id
  where b.id = p_booking_id;

  if v_owner is null then raise exception 'Booking not found'; end if;
  if v_owner <> auth.uid() then raise exception 'Not authorized'; end if;

  update bookings set checked_in_at = now()
  where id = p_booking_id and status = 'booked' and checked_in_at is null;

  if not found then raise exception 'Already checked in or booking not active'; end if;
end;
$$;
revoke all on function check_in(uuid) from public;
grant execute on function check_in(uuid) to authenticated;