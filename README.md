# Box Office — Seat Booking App

A mini BookMyShow-style app: users create events with an auto-generated seat
grid, other users book up to 4 seats at a time, and the database itself
guarantees no seat can ever be double-booked — even under concurrent load.

Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 +
Supabase** (Postgres, Auth, Row Level Security, RPC functions, Realtime,
Storage).

**Live URL:** https://ticket-booking-platform-amber.vercel.app/

---

## Features

- Email/password auth (sign up, log in, forgot/reset password)
- Any logged-in user can create an event: title, description, venue, date,
  price, rows × columns — seats are auto-generated (`A1`–`E10` style)
- Optional premium rows priced at 1.5× base price
- Events listing with search/filter (title, venue, max price, date) and a
  poster-style grid
- Seat map showing available / premium / selected / held / booked states,
  live-updated for every viewer via Supabase Realtime
- 5-minute seat holds with a countdown before a booking is confirmed
- Booking up to 4 seats atomically — all-or-nothing, race-proof (see below)
- QR-coded tickets under **My Bookings**, with cancellation before the event
  starts
- Organiser dashboard per event: seats sold, revenue, occupancy, attendee
  list with email and check-in status
- A check-in page for organisers (paste/scan a booking ID to check someone in)
- Editable user profile: full name, username, date of birth (age is derived
  live, not stored), place of birth, phone number, bio
- Optional event cover images via Supabase Storage
- A concurrency test script that races many simultaneous booking attempts
  against the same seat to prove the guarantee holds

---

## Project structure

```
app/
├── (auth)/{login,signup,forgot-password,reset-password}/page.tsx
├── events/
│   ├── page.tsx                     # listing + search/filter
│   ├── new/page.tsx                 # create event
│   └── [id]/
│       ├── page.tsx                 # seat map + booking
│       ├── dashboard/page.tsx       # organiser view
│       └── checkin/page.tsx         # organiser check-in
├── bookings/page.tsx                # My Bookings
├── profile/page.tsx
└── layout.tsx

components/
├── Navbar.tsx
├── AuthGuard.tsx
└── DeleteEventButton.tsx

lib/supabase/{client.ts,server.ts}
middleware.ts

supabase/
├── schema.sql
├── policies.sql
└── functions.sql

scripts/
└── concurrency-test.ts
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

### 2. Create a Supabase project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New project.

Under **Project Settings → Data API**, copy:
- **Project URL**
- **Publishable key** (formerly called the `anon` key)
- **Secret key** (formerly called the `service_role` key — only used by the
  concurrency test script, never shipped to the browser)

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the three values above:

```bash
cp .env.example .env.local
```

### 4. Run the SQL, in this exact order

In the Supabase **SQL Editor**, run each file's contents as its own query,
in order:

1. `supabase/schema.sql` — tables, the partial unique index that makes
   double-booking impossible, triggers, storage bucket
2. `supabase/policies.sql` — Row Level Security policies
3. `supabase/functions.sql` — `create_event_with_seats`, `book_seats`,
   `cancel_booking`, `hold_seats`, `release_hold`, `get_event_attendees`,
   `check_in`

### 5. Auth and Realtime settings in Supabase

- **Authentication → Sign In / Providers**: confirm Email is enabled. For
  faster local testing you can turn off "Confirm email" (the default
  built-in mailer is rate-limited to ~2 emails/hour and isn't meant for
  production use).
- **Authentication → URL Configuration**: add `http://localhost:3000` (and
  your deployed URL, once you have one) to the allowed site/redirect URLs —
  required for login redirects and the password reset flow.
- **Database → Replication**: make sure `bookings` and `holds` have
  Realtime enabled, so the seat map updates live for every viewer.

### 6. Run it

```bash
npm run dev
```

Visit `http://localhost:3000` (redirects to `/events`).

---

## How double-booking is prevented

This is enforced at the database level, not hidden in the UI, in three
layers:

1. **Row-level locking.** `book_seats(event_id, seat_ids)` is a single
   Postgres function, called via `supabase.rpc()`. Before checking
   availability, it takes `SELECT ... FOR UPDATE` locks on every requested
   seat, in a deterministic order (`ORDER BY id`). If two requests race for
   the same seat, Postgres forces the second transaction to wait until the
   first commits or rolls back — it can never read a stale "available"
   state.

2. **Partial unique index — the hard backstop.**
   ```sql
   create unique index one_active_booking_per_seat
     on bookings (seat_id)
     where status = 'booked';
   ```
   Even if the locking logic above had a bug, Postgres itself physically
   refuses a second row with `status = 'booked'` for the same `seat_id`.
   This is what makes the guarantee true "at the database level" rather
   than just "as far as the application code checks." Cancelling a booking
   sets `status = 'cancelled'`, which the partial index ignores — so a
   cancelled seat becomes bookable again automatically.

3. **All-or-nothing multi-seat booking.** The lock → check → insert
   sequence for all requested seats happens inside one PL/pgSQL function
   call, i.e. one transaction. If any seat in the batch turns out to be
   taken, the function raises an exception and the entire transaction rolls
   back — no partial bookings are ever left behind.

On conflict, the function raises a specific, human-readable error (e.g.
`Seat C4 was just booked by someone else`), which the frontend displays
inline and uses as the trigger to refresh the seat map from the database.

**Verified with:** `scripts/concurrency-test.ts` creates N throwaway users,
signs each one in with their own Supabase session, and fires `book_seats`
at the exact same seat simultaneously via `Promise.all`. Across repeated
runs, exactly one request succeeds and the rest fail with the "already
booked" message — never more than one success.

```bash
npx tsx scripts/concurrency-test.ts <event_id> <seat_id>
```

---

## Row Level Security

All four required rules, defined in `supabase/policies.sql`:

| Rule | Policy |
|---|---|
| Anyone can read events and seats | `events_select_all`, `seats_select_all` — both `using (true)` |
| Only the event owner can edit/delete their event | `events_update_own`, `events_delete_own` — `using (auth.uid() = owner_id)` |
| Users can only read their own bookings | part of `bookings_select_own` — `auth.uid() = user_id` |
| Event owners can read bookings for their own events | other half of `bookings_select_own` — `auth.uid() in (select owner_id from events where events.id = bookings.event_id)` |

Seats and bookings are never written directly by the client — all
mutations go through `SECURITY DEFINER` Postgres functions
(`create_event_with_seats`, `book_seats`, `cancel_booking`, `hold_seats`,
`release_hold`, `check_in`), each of which checks `auth.uid()` itself
before doing anything.

---

## Validation

Enforced in both the UI (for immediate feedback) and the database (so it
can't be bypassed):

- Event date must be in the future — UI check + `starts_in_future` table
  constraint + a check inside `create_event_with_seats`
- Price ≥ 0 — UI check + table `check` constraint + function check
- Rows and columns between 1 and 20 — UI check + table `check` constraints
  + function check
- Maximum 4 seats per booking — UI check + `book_seats` raises an
  exception above 4
- Can't book a past event — `book_seats` checks `starts_at <= now()`
  inside the same transaction as the booking, so it can't race past the
  event's start time
- Inline, specific error messages throughout (field-level on forms,
  seat-specific on booking conflicts)

---

## Deployment

Deployed on Vercel, connected directly to this GitHub repo — every push to
`main` auto-deploys.

1. Import the repo at [vercel.com](https://vercel.com)
2. Add the same three environment variables from `.env.local`
3. Deploy
4. Add the resulting `https://<your-app>.vercel.app` URL to Supabase's
   Authentication → URL Configuration

**Live URL:** https://ticket-booking-platform-amber.vercel.app/

---

## Screenshots

_Add screenshots here: events listing, seat map, booking success/conflict
message, My Bookings with QR code, organiser dashboard._

---

## Tech notes

- Tailwind CSS v4 is configured via `@import "tailwindcss"` and an
  `@theme` block in `app/globals.css` — there is no `tailwind.config.ts`.
- `middleware.ts` refreshes the Supabase session cookie on every request,
  required for the SSR auth pattern used in server components (e.g. the
  organiser dashboard).