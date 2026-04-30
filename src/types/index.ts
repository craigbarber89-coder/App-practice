// ============================================================
// Domain types matching the database schema
// ============================================================

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type MessageChannel = 'sms' | 'email'
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export type MessageType =
  | 'booking_confirmation_client'
  | 'booking_notification_owner'
  | 'completion_thankyou'
  | 'feedback_request'
  | 'review_request'
  | 'referral_followup'
  | 'rebooking_reminder'
  | 'negative_feedback_owner_alert'
  | 'cancellation_confirmation'
export type FeedbackSentiment = 'positive' | 'negative'

export interface Client {
  id: string
  created_at: string
  updated_at: string
  first_name: string
  last_name: string
  email: string | null
  phone: string
  pet_name: string
  pet_breed: string | null
  pet_notes: string | null
  is_archived: boolean
  referral_code: string
  referred_by: string | null
  lifetime_revenue: number
  last_appointment_at: string | null
}

export interface Service {
  id: string
  created_at: string
  updated_at: string
  name: string
  description: string | null
  price: number
  duration_minutes: number
  is_active: boolean
  sort_order: number
}

export interface Appointment {
  id: string
  created_at: string
  updated_at: string
  client_id: string
  service_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  service_description: string | null
  price_charged: number | null
  notes: string | null
  booked_via: string
  cancelled_at: string | null
  cancellation_reason: string | null
  completed_at: string | null
  cancel_token: string
  // joined
  client?: Client
  service?: Service
}

export interface ScheduledMessage {
  id: string
  created_at: string
  updated_at: string
  client_id: string | null
  appointment_id: string | null
  message_type: MessageType
  channel: MessageChannel
  recipient_phone: string | null
  recipient_email: string | null
  recipient_name: string | null
  subject: string | null
  body: string
  send_at: string
  status: MessageStatus
  sent_at: string | null
  provider_message_id: string | null
  error_message: string | null
  retry_count: number
  idempotency_key: string
}

export interface FeedbackResponse {
  id: string
  created_at: string
  appointment_id: string
  client_id: string
  sentiment: FeedbackSentiment
  response_token: string
  responded_at: string | null
  ip_address: string | null
  // joined
  client?: Client
  appointment?: Appointment
}

export interface Referral {
  id: string
  created_at: string
  referrer_client_id: string
  referred_client_id: string
  first_appointment_id: string | null
  // joined
  referrer?: Client
  referred?: Client
}

export interface Settings {
  [key: string]: string | null
}

// ============================================================
// API / form types
// ============================================================

export interface CreateClientInput {
  first_name: string
  last_name: string
  email?: string
  phone: string
  pet_name: string
  pet_breed?: string
  pet_notes?: string
  referred_by_code?: string
}

export interface CreateAppointmentInput {
  client_id: string
  service_id?: string
  scheduled_at: string
  duration_minutes?: number
  service_description?: string
  price_charged?: number
  notes?: string
  booked_via?: 'owner' | 'portal'
}

export interface UpdateAppointmentInput {
  service_id?: string
  scheduled_at?: string
  duration_minutes?: number
  status?: AppointmentStatus
  service_description?: string
  price_charged?: number
  notes?: string
}

export interface BookingPortalInput {
  // New or existing client
  phone: string
  first_name?: string
  last_name?: string
  email?: string
  pet_name?: string
  pet_breed?: string
  // Appointment
  service_id: string
  scheduled_at: string
  referred_by_code?: string
}

// ============================================================
// Dashboard reporting
// ============================================================

export interface MonthlyReport {
  month: string
  revenue: number
  appointmentsCompleted: number
  newClients: number
  referralsGenerated: number
  messagesSent: number
}
