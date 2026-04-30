/**
 * Manually queue a message to a specific client.
 * Supports: rebooking_reminder, review_request, completion_thankyou, custom
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { interpolateTemplate, makeIdempotencyKey } from '@/lib/utils'
import { businessConfig } from '@config'
import { z } from 'zod'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

const schema = z.object({
  client_id: z.string().uuid(),
  message_type: z.enum([
    'rebooking_reminder',
    'review_request',
    'completion_thankyou',
    'feedback_request',
    'custom',
  ]),
  channel: z.enum(['sms', 'email', 'both']),
  custom_body: z.string().optional(), // required when message_type = 'custom'
  custom_subject: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { client_id, message_type, channel, custom_body, custom_subject } = parsed.data

    // Load client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single()
    if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Load settings for templates
    const { data: settingsRows } = await supabase.from('settings').select('key, value')
    const settings: Record<string, string> = {}
    for (const row of settingsRows ?? []) settings[row.key] = row.value ?? ''

    const vars: Record<string, string> = {
      client_first_name: client.first_name,
      pet_name: client.pet_name,
      business_name: businessConfig.name,
      business_phone: businessConfig.phone,
      review_url: `${APP_URL}/api/review-click?client=${client.id}`,
      referral_url: `${APP_URL}/book?ref=${client.referral_code}`,
      booking_url: `${APP_URL}/book`,
      feedback_url: '',
      appointment_date: '',
      appointment_time: '',
      cancel_url: '',
    }

    let smsBody = ''
    let emailSubject = ''
    let emailBody = ''

    if (message_type === 'custom') {
      if (!custom_body) return NextResponse.json({ error: 'custom_body required for custom messages' }, { status: 400 })
      smsBody = interpolateTemplate(custom_body, vars)
      emailSubject = custom_subject ? interpolateTemplate(custom_subject, vars) : `Message from ${businessConfig.name}`
      emailBody = smsBody
    } else {
      const templateKey = `sms_template_${message_type}`
      smsBody = interpolateTemplate(settings[templateKey] ?? '', vars)
      emailSubject = `Message from ${businessConfig.name}`
      emailBody = smsBody
    }

    const now = new Date().toISOString()
    const queued: string[] = []

    // Use timestamp in idempotency key so manual sends aren't blocked by prior sends
    const idemSuffix = Date.now().toString()

    if (channel === 'sms' || channel === 'both') {
      if (client.phone) {
        await supabase.from('scheduled_messages').insert({
          client_id,
          message_type: message_type === 'custom' ? 'completion_thankyou' : message_type,
          channel: 'sms',
          recipient_phone: client.phone,
          recipient_name: `${client.first_name} ${client.last_name}`,
          body: smsBody,
          send_at: now,
          status: 'pending',
          idempotency_key: `manual:${message_type}:${client_id}:sms:${idemSuffix}`,
        })
        queued.push('SMS')
      }
    }

    if (channel === 'email' || channel === 'both') {
      if (client.email) {
        await supabase.from('scheduled_messages').insert({
          client_id,
          message_type: message_type === 'custom' ? 'completion_thankyou' : message_type,
          channel: 'email',
          recipient_email: client.email,
          recipient_name: `${client.first_name} ${client.last_name}`,
          subject: emailSubject,
          body: emailBody,
          send_at: now,
          status: 'pending',
          idempotency_key: `manual:${message_type}:${client_id}:email:${idemSuffix}`,
        })
        queued.push('Email')
      } else {
        return NextResponse.json({
          warning: 'Client has no email address on file',
          queued,
        })
      }
    }

    if (queued.length === 0) {
      return NextResponse.json({ error: 'Client has no contact info for the selected channel' }, { status: 422 })
    }

    return NextResponse.json({ ok: true, queued })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
