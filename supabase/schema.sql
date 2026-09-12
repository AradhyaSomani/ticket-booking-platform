create extension if not exists "pgcrypto";

create table events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text,
  venue        text not null,
  starts_at    timestamptz not null,
  price        numeric(10,2) not null default 0 check (price >= 0),
  rows         int not null check (rows between 1 and 20),
  cols         int not null check (cols between 1 and 20),
  cover_url    text,
  created_at   timestamptz not null default now(),
  constraint starts_in_future check (starts_at > now())
);

create table seats (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  label          text not null,
  row_index      int not null,
  col_index      int not null,
  category       text not null default 'standard',
  price_override numeric(10,2),
  unique (event_id, label)
);

create table bookings (
  id            uuid primary key default gen_random_uuid(),
  seat_id       uuid not null references seats(id) on delete cascade,
  event_id      uuid not null references events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'booked' check (status in ('booked','cancelled')),
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);

-- === THE CORE INTEGRITY RULE ===
create unique index one_active_booking_per_seat
  on bookings (seat_id)
  where status = 'booked';

create index bookings_user_idx  on bookings(user_id);
create index bookings_event_idx on bookings(event_id);
create index seats_event_idx    on seats(event_id);

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create table holds (
  seat_id    uuid primary key references seats(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

alter table events   enable row level security;
alter table seats    enable row level security;
alter table bookings enable row level security;
alter table profiles enable row level security;
alter table holds    enable row level security;

-- keep profiles synced with auth.users automatically
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- storage bucket for event cover images
insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;