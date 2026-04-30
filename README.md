# Groomer App

A full-featured pet grooming business management app with a two-sided design:

- **Owner Dashboard** — appointments, client management, automated messaging, reporting
- **Client Booking Portal** — public-facing booking page at `/book`

## Architecture

- **Next.js 14** (App Router) — frontend + API routes
- **Supabase** — PostgreSQL database, authentication, row-level security
- **Twilio** — SMS messaging
- **SendGrid** — email messaging
- **Stripe** — future payment collection
- **Vercel** — deployment + cron jobs

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL**, **anon key**, and **service role key** from Project Settings → API
3. In the SQL editor, run the migration:

```
supabase/migrations/001_initial_schema.sql
```

4. Create the owner account:
   - Go to Authentication → Users → Add User
   - Enter the email you'll use to log in and a strong password

### 2. Configure Twilio

1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Get a phone number
3. Note your **Account SID**, **Auth Token**, and **phone number**

### 3. Configure SendGrid

1. Create a SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Create an API key with "Mail Send" permission
3. Verify your sender email address (or a domain)

### 4. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Dashboard |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Dashboard |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers |
| `SENDGRID_API_KEY` | SendGrid → Settings → API Keys |
| `SENDGRID_FROM_EMAIL` | Your verified sender email |
| `OWNER_EMAIL` | Your email (for owner alerts) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g. https://mypetgroomer.vercel.app) |
| `CRON_SECRET` | Any random string, 32+ characters |

Optional business customisation (override defaults from `config/business.ts`):

```
NEXT_PUBLIC_BUSINESS_NAME=Pawfect Grooming
NEXT_PUBLIC_BUSINESS_TAGLINE=Professional pet grooming you can trust
NEXT_PUBLIC_BUSINESS_PHONE=+15550000000
NEXT_PUBLIC_BUSINESS_TIMEZONE=America/New_York
NEXT_PUBLIC_COLOR_PRIMARY=#7c3aed
```

### 5. Run Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/dashboard` to log in as the owner.
Visit `http://localhost:3000/book` for the client booking portal.

### 6. Deploy to Vercel

1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Deploy

Vercel will automatically pick up `vercel.json` and run the cron job every minute to process scheduled messages.

---

## How the Automated Message Sequence Works

When you mark an appointment **Complete** in the dashboard:

1. **Immediately** — Thank-you SMS + email sent to client
2. **24 hours later** — Feedback request SMS with thumbs-up/thumbs-down link
3. **If thumbs-up** — 2 hours later: review request + referral link SMS
4. **If thumbs-down** — Immediate alert to owner via SMS + email (private, no further automated messages to the client)
5. **6 weeks after last appointment** — Rebooking reminder to clients with no future appointment

All messages are logged in the database before sending. If Twilio or SendGrid fails, the message is retried up to 3 times, then marked failed. Failed messages appear as an alert in the dashboard.

---

## Multi-Business Deployment

To deploy this app for a different grooming business, fork the repo and set different environment variables in Vercel:

- `NEXT_PUBLIC_BUSINESS_NAME`
- `NEXT_PUBLIC_BUSINESS_PHONE`
- `NEXT_PUBLIC_COLOR_PRIMARY`
- `NEXT_PUBLIC_GOOGLE_REVIEW_URL`
- `OWNER_EMAIL`
- All Twilio/SendGrid/Supabase credentials for that business

The codebase itself never needs to be modified.

---

## URL Structure

| URL | Description |
|---|---|
| `/` | Redirects to `/book` |
| `/book` | Client booking portal |
| `/book?ref=CODE` | Booking portal with referral code pre-filled |
| `/login` | Owner login |
| `/dashboard` | Owner dashboard overview |
| `/dashboard/appointments` | Appointment management |
| `/dashboard/clients` | Client list |
| `/dashboard/clients/[id]` | Client detail + history |
| `/dashboard/messages` | Message log + failure alerts |
| `/dashboard/reviews` | Reviews & referral tracking |
| `/dashboard/settings` | Business settings + message templates |
| `/api/cron` | Message processor (called by Vercel cron) |
| `/api/feedback/[token]` | Feedback thumbs-up/thumbs-down handler |
| `/api/cancel/[token]` | Client self-cancellation |
| `/api/review-click` | Review link click tracker |
