/**
 * Messaging engine — schedules and dispatches all automated messages.
 * All sends are logged BEFORE sending. Duplicate protection via idempotency_key.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'
import { interpolateTemplate, makeIdempotencyKey, formatInBusinessTz } from '@/lib/utils'
import { businessConfig } from '@config'
import type { Appointment, Client, MessageType, MessageChannel } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

// ============================================================
// Schedule messages after an appointment is completed
// ============================================================
export async function scheduleCompletionSequence(
  appointment: Appointment & { client: Client }
) {
  const supabase = createServiceClient()
  const { client } = appointment

  const settings = await getSettings()
  const now = new Date()

  const vars = buildTemplateVars(appointment, client, settings)

  // 1. Immediate thank-you
  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'completion_thankyou',
    channel: 'sms',
    recipientPhone: client.phone,
    recipientName: `${client.first_name} ${client.last_name}`,
    body: interpolateTemplate(settings['sms_template_completion_thankyou'] ?? '', vars),
    sendAt: now,
  })

  if (client.email) {
    await enqueueMessage(supabase, {
      clientId: client.id,
      appointmentId: appointment.id,
      messageType: 'completion_thankyou',
      channel: 'email',
      recipientEmail: client.email,
      recipientName: `${client.first_name} ${client.last_name}`,
      subject: `Thanks for visiting — ${businessConfig.name}`,
      body: interpolateTemplate(settings['sms_template_completion_thankyou'] ?? '', vars),
      sendAt: now,
    })
  }

  // 2. Feedback request — 24 hours later
  const feedbackAt = new Date(now.getTime() + businessConfig.messaging.feedbackDelayHours * 3600_000)

  // Create feedback token row
  const { data: feedbackRow } = await supabase
    .from('feedback_responses')
    .insert({
      appointment_id: appointment.id,
      client_id: client.id,
      sentiment: 'positive', // placeholder; overwritten when client responds
    })
    .select()
    .single()

  const feedbackVars = {
    ...vars,
    feedback_url: `${APP_URL}/feedback/${feedbackRow?.response_token ?? ''}`,
  }

  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'feedback_request',
    channel: 'sms',
    recipientPhone: client.phone,
    recipientName: `${client.first_name} ${client.last_name}`,
    body: interpolateTemplate(settings['sms_template_feedback_request'] ?? '', feedbackVars),
    sendAt: feedbackAt,
  })
}

// ============================================================
// Schedule review request after positive feedback
// ============================================================
export async function scheduleReviewRequest(
  appointment: Appointment & { client: Client }
) {
  const supabase = createServiceClient()
  const { client } = appointment
  const settings = await getSettings()
  const sendAt = new Date(Date.now() + businessConfig.messaging.reviewDelayHours * 3600_000)
  const vars = buildTemplateVars(appointment, client, settings)

  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'review_request',
    channel: 'sms',
    recipientPhone: client.phone,
    recipientName: `${client.first_name} ${client.last_name}`,
    body: interpolateTemplate(settings['sms_template_review_request'] ?? '', vars),
    sendAt,
  })
}

// ============================================================
// Alert owner of negative feedback
// ============================================================
export async function alertOwnerNegativeFeedback(
  appointment: Appointment & { client: Client }
) {
  const supabase = createServiceClient()
  const { client } = appointment
  const ownerPhone = process.env.TWILIO_PHONE_NUMBER!
  const ownerEmail = process.env.OWNER_EMAIL!
  const now = new Date()

  const body = `⚠️ Negative feedback received from ${client.first_name} ${client.last_name} (${client.phone}) for their appointment on ${formatInBusinessTz(appointment.scheduled_at)}. Please reach out personally.`

  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'negative_feedback_owner_alert',
    channel: 'sms',
    recipientPhone: process.env.TWILIO_PHONE_NUMBER!,
    recipientName: 'Owner',
    body,
    sendAt: now,
  })

  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'negative_feedback_owner_alert',
    channel: 'email',
    recipientEmail: ownerEmail,
    recipientName: 'Owner',
    subject: `⚠️ Negative feedback — ${client.first_name} ${client.last_name}`,
    body,
    sendAt: now,
  })
}

// ============================================================
// Schedule rebooking reminders (run by cron job)
// ============================================================
export async function scheduleRebookingReminders() {
  const supabase = createServiceClient()
  const settings = await getSettings()
  const weeksAgo = new Date()
  weeksAgo.setDate(weeksAgo.getDate() - businessConfig.messaging.rebookingReminderWeeks * 7)

  // Find clients whose last appointment was exactly ~6 weeks ago and have no future booking
  const { data: candidates } = await supabase
    .from('clients')
    .select('*, appointments:appointments(id, scheduled_at, status)')
    .eq('is_archived', false)
    .not('last_appointment_at', 'is', null)
    .lte('last_appointment_at', weeksAgo.toISOString())
    .gte('last_appointment_at', new Date(weeksAgo.getTime() - 86_400_000).toISOString()) // within a 1-day window

  if (!candidates) return

  for (const client of candidates) {
    // Skip if they already have a future appointment scheduled
    const hasFutureAppt = (client.appointments as { scheduled_at: string; status: string }[]).some(
      (a) => a.status === 'scheduled' && new Date(a.scheduled_at) > new Date()
    )
    if (hasFutureAppt) continue

    const vars: Record<string, string> = {
      client_first_name: client.first_name,
      pet_name: client.pet_name,
      booking_url: `${APP_URL}/book`,
      business_name: businessConfig.name,
    }

    await enqueueMessage(supabase, {
      clientId: client.id,
      appointmentId: null,
      messageType: 'rebooking_reminder',
      channel: 'sms',
      recipientPhone: client.phone,
      recipientName: `${client.first_name} ${client.last_name}`,
      body: interpolateTemplate(settings['sms_template_rebooking_reminder'] ?? '', vars),
      sendAt: new Date(),
    })
  }
}

// ============================================================
// Process pending messages — called by cron every minute
// ============================================================
export async function processPendingMessages() {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data: messages } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('send_at', now)
    .lt('retry_count', 3)
    .order('send_at', { ascending: true })
    .limit(50)

  if (!messages || messages.length === 0) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0

  for (const msg of messages) {
    let result: { success: boolean; providerId?: string; error?: string }

    if (msg.channel === 'sms') {
      if (!msg.recipient_phone) {
        await markSkipped(supabase, msg.id, 'No recipient phone')
        continue
      }
      result = await sendSms(msg.recipient_phone, msg.body)
    } else {
      if (!msg.recipient_email) {
        await markSkipped(supabase, msg.id, 'No recipient email')
        continue
      }
      result = await sendEmail(msg.recipient_email, msg.subject ?? '', msg.body)
    }

    if (result.success) {
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerId ?? null,
          error_message: null,
        })
        .eq('id', msg.id)
      processed++
    } else {
      await supabase
        .from('scheduled_messages')
        .update({
          status: msg.retry_count >= 2 ? 'failed' : 'pending',
          retry_count: msg.retry_count + 1,
          error_message: result.error ?? 'Unknown error',
        })
        .eq('id', msg.id)
      failed++
    }
  }

  return { processed, failed }
}

// ============================================================
// Send booking confirmation to client
// ============================================================
export async function sendBookingConfirmation(
  appointment: Appointment & { client: Client; service?: { name: string } | null }
) {
  const supabase = createServiceClient()
  const { client } = appointment
  const settings = await getSettings()
  const now = new Date()

  const vars = {
    client_first_name: client.first_name,
    pet_name: client.pet_name,
    appointment_date: formatInBusinessTz(appointment.scheduled_at, 'EEEE, MMMM d, yyyy'),
    appointment_time: formatInBusinessTz(appointment.scheduled_at, 'h:mm a'),
    service_name: appointment.service?.name ?? appointment.service_description ?? 'Grooming',
    cancel_url: `${APP_URL}/cancel/${appointment.cancel_token}`,
    business_name: businessConfig.name,
    business_phone: businessConfig.phone,
  }

  const smsBody = `Hi ${client.first_name}, your ${vars.service_name} appointment for ${client.pet_name} is confirmed for ${vars.appointment_date} at ${vars.appointment_time}. Cancel: ${vars.cancel_url}`

  await enqueueMessage(supabase, {
    clientId: client.id,
    appointmentId: appointment.id,
    messageType: 'booking_confirmation_client',
    channel: 'sms',
    recipientPhone: client.phone,
    recipientName: `${client.first_name} ${client.last_name}`,
    body: smsBody,
    sendAt: now,
  })

  if (client.email) {
    const emailBody = interpolateTemplate(
      settings['email_template_booking_confirmation_body'] ?? '',
      vars
    )
    await enqueueMessage(supabase, {
      clientId: client.id,
      appointmentId: appointment.id,
      messageType: 'booking_confirmation_client',
      channel: 'email',
      recipientEmail: client.email,
      recipientName: `${client.first_name} ${client.last_name}`,
      subject: interpolateTemplate(
        settings['email_template_booking_confirmation_subject'] ?? 'Appointment Confirmed',
        vars
      ),
      body: emailBody,
      sendAt: now,
    })
  }
}

// ============================================================
// Notify owner of new booking request
// ============================================================
export async function notifyOwnerNewBooking(
  appointment: Appointment & { client: Client; service?: { name: string } | null }
) {
  const supabase = createServiceClient()
  const { client } = appointment
  const now = new Date()
  const apptDate = formatInBusinessTz(appointment.scheduled_at, 'EEEE MMM d')
  const apptTime = formatInBusinessTz(appointment.scheduled_at, 'h:mm a')
  const serviceName = appointment.service?.name ?? appointment.service_description ?? 'Grooming'

  const body = `New booking request: ${client.first_name} ${client.last_name} (${client.pet_name}) for ${serviceName} on ${apptDate} at ${apptTime}. Review in dashboard: ${APP_URL}/dashboard/appointments`

  if (process.env.TWILIO_PHONE_NUMBER) {
    await enqueueMessage(supabase, {
      clientId: client.id,
      appointmentId: appointment.id,
      messageType: 'booking_notification_owner',
      channel: 'sms',
      recipientPhone: process.env.TWILIO_PHONE_NUMBER,
      recipientName: 'Owner',
      body,
      sendAt: now,
    })
  }

  if (process.env.OWNER_EMAIL) {
    await enqueueMessage(supabase, {
      clientId: client.id,
      appointmentId: appointment.id,
      messageType: 'booking_notification_owner',
      channel: 'email',
      recipientEmail: process.env.OWNER_EMAIL,
      recipientName: 'Owner',
      subject: `New booking: ${client.first_name} ${client.last_name} — ${apptDate}`,
      body,
      sendAt: now,
    })
  }
}

// ============================================================
// Helpers
// ============================================================

interface EnqueueParams {
  clientId: string | null
  appointmentId: string | null
  messageType: MessageType
  channel: MessageChannel
  recipientPhone?: string
  recipientEmail?: string
  recipientName?: string
  subject?: string
  body: string
  sendAt: Date
}

async function enqueueMessage(
  supabase: ReturnType<typeof createServiceClient>,
  params: EnqueueParams
) {
  const idKey = makeIdempotencyKey(
    params.messageType,
    params.appointmentId ?? params.clientId ?? 'global',
    params.channel
  )

  // Check for existing — never duplicate
  const { data: existing } = await supabase
    .from('scheduled_messages')
    .select('id')
    .eq('idempotency_key', idKey)
    .maybeSingle()

  if (existing) return

  await supabase.from('scheduled_messages').insert({
    client_id: params.clientId,
    appointment_id: params.appointmentId,
    message_type: params.messageType,
    channel: params.channel,
    recipient_phone: params.recipientPhone ?? null,
    recipient_email: params.recipientEmail ?? null,
    recipient_name: params.recipientName ?? null,
    subject: params.subject ?? null,
    body: params.body,
    send_at: params.sendAt.toISOString(),
    status: 'pending',
    idempotency_key: idKey,
  })
}

async function markSkipped(
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  reason: string
) {
  await supabase
    .from('scheduled_messages')
    .update({ status: 'skipped', error_message: reason })
    .eq('id', id)
}

async function getSettings(): Promise<Record<string, string>> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('settings').select('key, value')
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ''
  }
  return map
}

function buildTemplateVars(
  appointment: Appointment,
  client: Client,
  settings: Record<string, string>
): Record<string, string> {
  return {
    client_first_name: client.first_name,
    pet_name: client.pet_name,
    business_name: businessConfig.name,
    business_phone: businessConfig.phone,
    review_url: settings['google_review_url'] ?? '',
    referral_url: `${APP_URL}/book?ref=${client.referral_code}`,
    booking_url: `${APP_URL}/book`,
    appointment_date: formatInBusinessTz(appointment.scheduled_at, 'EEEE, MMMM d, yyyy'),
    appointment_time: formatInBusinessTz(appointment.scheduled_at, 'h:mm a'),
    feedback_url: '', // filled by caller when needed
    cancel_url: `${APP_URL}/cancel/${appointment.cancel_token}`,
  }
}
