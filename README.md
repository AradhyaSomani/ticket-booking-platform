This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

**Why this is race-proof:** **for update** locks the seat rows in a deterministic order before checking availability. If two requests hit the same seat at the same instant, Postgres forces the second transaction to wait for the first to commit or roll back — it cannot read a stale "available" state. After waiting, it re-checks and finds the seat booked, and raises the friendly error. The partial unique index (**unique (seat_id) where status='booked'**) is the last line of defense even if the locking logic ever had a bug — the database physically refuses a second active booking on the same seat. And because everything (lock, check, insert) is one PL/pgSQL function called in one transaction, a failure on any seat rolls back the entire batch — true all-or-nothing.

├── Setup steps (clone, npm install, supabase project, env vars, run SQL files in order:
│   schema.sql → policies.sql → functions.sql, npm run dev)
├── .env.example
├── /supabase/schema.sql, policies.sql, functions.sql
├── Screenshots (events list, seat map, booking success/failure, my bookings, dashboard)
├── "How we prevent double-booking" section — summarize section 3 above:
│     partial unique index + row-level locking inside a single SECURITY DEFINER
│     transaction = the DB itself refuses a second active booking on a seat,
│     and any failure rolls back the whole multi-seat request.
└── Deployed link (Vercel for the app; Supabase project for the backend)