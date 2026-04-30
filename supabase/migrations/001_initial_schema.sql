-- ============================================================
-- Groomer App — Initial Schema
-- All timestamps stored in UTC. Display in business timezone app-side.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- CLIENTS
-- ============================================================
create table public.clients (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Contact info
  first_name    text not null,
  last_name     text not null,
  email         text,
  -- E.164 format, e.g. +15550001234
  phone         text not null,

  -- Pet info (primary pet; additional pets via pet_profiles table)
  pet_name      text not null,
  pet_breed     text,
  pet_notes     text,  -- aggression, special needs, etc.

  -- Status
  is_archived   boolean not null default false,

  -- Referral tracking
  referral_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  referred_by   uuid references public.clients(id),

  -- Computed/cached fields (updated via trigger)
  lifetime_revenue  numeric(10,2) not null default 0,
  last_appointment_at timestamptz
);

create index idx_clients_phone on public.clients(phone);
create index idx_clients_referral_code on public.clients(referral_code);
create index idx_clients_archived on public.clients(is_archived);

-- ============================================================
-- SERVICES
-- ============================================================
create table public.services (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  name        text not null,
  description text,
  price       numeric(10,2) not null,
  duration_minutes int not null default 60,
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

-- Seed default services
insert into public.services (name, description, price, duration_minutes, sort_order) values
  ('Bath & Brush', 'Full bath, blow-dry, and brush-out', 45.00, 60, 1),
  ('Full Groom', 'Bath, blow-dry, haircut, nail trim, ear cleaning', 75.00, 90, 2),
  ('Nail Trim', 'Nail clipping and filing', 20.00, 20, 3),
  ('Teeth Brushing', 'Professional teeth brushing', 15.00, 15, 4),
  ('De-shedding Treatment', 'Specialized treatment to reduce shedding', 35.00, 45, 5);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
create type appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

create table public.appointments (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  client_id       uuid not null references public.clients(id),
  service_id      uuid references public.services(id),

  -- Scheduled time in UTC
  scheduled_at    timestamptz not null,
  -- Duration in minutes (copied from service at booking time, can be overridden)
  duration_minutes int not null default 60,

  status          appointment_status not null default 'scheduled',

  -- What was actually done / charged (may differ from booked service)
  service_description text,
  price_charged   numeric(10,2),
  notes           text,

  -- Booking source
  booked_via      text not null default 'owner',  -- 'owner' | 'portal'

  -- Cancellation
  cancelled_at    timestamptz,
  cancellation_reason text,

  -- Completion tracking
  completed_at    timestamptz,

  -- Unique token for client self-cancel link
  cancel_token    text unique not null default encode(gen_random_bytes(16), 'hex')
);

create index idx_appointments_client on public.appointments(client_id);
create index idx_appointments_scheduled_at on public.appointments(scheduled_at);
create index idx_appointments_status on public.appointments(status);

-- ============================================================
-- SCHEDULED MESSAGES
-- Records every message to be sent; processed by cron job.
-- ============================================================
create type message_channel as enum ('sms', 'email');
create type message_status as enum ('pending', 'sent', 'failed', 'skipped');
create type message_type as enum (
  'booking_confirmation_client',
  'booking_notification_owner',
  'completion_thankyou',
  'feedback_request',
  'review_request',
  'referral_followup',
  'rebooking_reminder',
  'negative_feedback_owner_alert',
  'cancellation_confirmation'
);

create table public.scheduled_messages (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  client_id       uuid references public.clients(id),
  appointment_id  uuid references public.appointments(id),

  message_type    message_type not null,
  channel         message_channel not null,

  -- Recipient (denormalized so we can send even if client record changes)
  recipient_phone text,
  recipient_email text,
  recipient_name  text,

  -- Content
  subject         text,   -- email only
  body            text not null,

  -- Scheduling
  send_at         timestamptz not null,
  status          message_status not null default 'pending',

  -- Results
  sent_at         timestamptz,
  provider_message_id text,  -- Twilio SID or SendGrid message ID
  error_message   text,
  retry_count     int not null default 0,

  -- Idempotency — prevents duplicate sends
  idempotency_key text unique not null
);

create index idx_scheduled_messages_send_at on public.scheduled_messages(send_at) where status = 'pending';
create index idx_scheduled_messages_client on public.scheduled_messages(client_id);
create index idx_scheduled_messages_appointment on public.scheduled_messages(appointment_id);
create index idx_scheduled_messages_status on public.scheduled_messages(status);

-- ============================================================
-- FEEDBACK RESPONSES
-- ============================================================
create type feedback_sentiment as enum ('positive', 'negative');

create table public.feedback_responses (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  appointment_id  uuid not null references public.appointments(id),
  client_id       uuid not null references public.clients(id),

  sentiment       feedback_sentiment not null,
  response_token  text unique not null default encode(gen_random_bytes(16), 'hex'),
  responded_at    timestamptz,
  ip_address      text
);

create index idx_feedback_appointment on public.feedback_responses(appointment_id);
create index idx_feedback_token on public.feedback_responses(response_token);

-- ============================================================
-- REFERRALS
-- ============================================================
create table public.referrals (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),

  -- Who referred
  referrer_client_id uuid not null references public.clients(id),
  -- New client who was referred
  referred_client_id uuid not null references public.clients(id),

  -- When the referred client first booked
  first_appointment_id uuid references public.appointments(id)
);

create index idx_referrals_referrer on public.referrals(referrer_client_id);

-- ============================================================
-- REVIEW LINK CLICKS
-- ============================================================
create table public.review_link_clicks (
  id              uuid primary key default uuid_generate_v4(),
  clicked_at      timestamptz not null default now(),
  client_id       uuid not null references public.clients(id),
  appointment_id  uuid references public.appointments(id),
  ip_address      text
);

-- ============================================================
-- SETTINGS
-- Key-value store for owner-configurable settings.
-- ============================================================
create table public.settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

-- Seed default settings
insert into public.settings (key, value) values
  ('google_review_url', ''),
  ('business_hours_json', '{"mon":{"open":"09:00","close":"17:00"},"tue":{"open":"09:00","close":"17:00"},"wed":{"open":"09:00","close":"17:00"},"thu":{"open":"09:00","close":"17:00"},"fri":{"open":"09:00","close":"17:00"},"sat":{"open":"09:00","close":"14:00"},"sun":null}'),
  ('sms_template_completion_thankyou', 'Hi {{client_first_name}}, thank you for bringing {{pet_name}} in today! We loved having them. 🐾'),
  ('sms_template_feedback_request', 'Hi {{client_first_name}}, how did {{pet_name}}''s grooming go today? Let us know: {{feedback_url}}'),
  ('sms_template_review_request', 'So glad to hear it! Would you mind leaving us a quick Google review? It really helps: {{review_url}} — and if you know anyone with a pet who needs grooming, share your referral link: {{referral_url}}'),
  ('sms_template_rebooking_reminder', 'Hi {{client_first_name}}, it''s been a while since {{pet_name}}''s last groom! Ready to book again? {{booking_url}}'),
  ('email_template_booking_confirmation_subject', 'Your appointment is confirmed — {{business_name}}'),
  ('email_template_booking_confirmation_body', 'Hi {{client_first_name}},\n\nYour appointment is confirmed!\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nService: {{service_name}}\nPet: {{pet_name}}\n\nNeed to cancel? Use this link (up to 24 hours before): {{cancel_url}}\n\nSee you soon!\n{{business_name}}');

-- ============================================================
-- TRIGGERS: updated_at auto-maintenance
-- ============================================================
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function update_updated_at_column();

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row execute function update_updated_at_column();

create trigger set_services_updated_at
  before update on public.services
  for each row execute function update_updated_at_column();

create trigger set_scheduled_messages_updated_at
  before update on public.scheduled_messages
  for each row execute function update_updated_at_column();

-- ============================================================
-- TRIGGER: update client cached fields on appointment changes
-- ============================================================
create or replace function update_client_stats()
returns trigger language plpgsql as $$
begin
  update public.clients
  set
    lifetime_revenue = (
      select coalesce(sum(price_charged), 0)
      from public.appointments
      where client_id = coalesce(new.client_id, old.client_id)
        and status = 'completed'
        and price_charged is not null
    ),
    last_appointment_at = (
      select max(scheduled_at)
      from public.appointments
      where client_id = coalesce(new.client_id, old.client_id)
        and status = 'completed'
    )
  where id = coalesce(new.client_id, old.client_id);
  return new;
end;
$$;

create trigger sync_client_stats
  after insert or update or delete on public.appointments
  for each row execute function update_client_stats();

-- ============================================================
-- ROW LEVEL SECURITY
-- All tables locked down — only service role bypasses RLS.
-- The app uses service role key server-side.
-- ============================================================
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.feedback_responses enable row level security;
alter table public.referrals enable row level security;
alter table public.review_link_clicks enable row level security;
alter table public.settings enable row level security;

-- Service role bypasses RLS automatically.
-- Anon/public users can only read active services (for booking portal).
create policy "Public can view active services"
  on public.services for select
  to anon
  using (is_active = true);
