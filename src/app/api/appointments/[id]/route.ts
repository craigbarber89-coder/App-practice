import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  scheduleCompletionSequence,
  sendBookingConfirmation,
} from '@/lib/messaging'
import { z } from 'zod'

const updateSchema = z.object({
  service_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(15).optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  service_description: z.string().nullable().optional(),
  price_charged: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  cancellation_reason: z.string().optional(),
})

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:clients(*),
      service:services(*)
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const body = await request.json()

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Fetch current state before updating
  const { data: current } = await supabase
    .from('appointments')
    .select('*, client:clients(*), service:services(*)')
    .eq('id', params.id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { ...parsed.data }

  // Set timestamps for status transitions
  if (parsed.data.status === 'completed' && current.status !== 'completed') {
    updates.completed_at = new Date().toISOString()
  }
  if (parsed.data.status === 'cancelled' && current.status !== 'cancelled') {
    updates.cancelled_at = new Date().toISOString()
  }

  const { data: appointment, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .select('*, client:clients(*), service:services(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Side effects based on status transition
  if (parsed.data.status === 'completed' && current.status !== 'completed' && appointment.client) {
    scheduleCompletionSequence(appointment as Parameters<typeof scheduleCompletionSequence>[0]).catch(
      (err) => console.error('Failed to schedule completion sequence:', err)
    )
  }

  if (parsed.data.status === 'confirmed' && current.status !== 'confirmed' && appointment.client) {
    sendBookingConfirmation(appointment as Parameters<typeof sendBookingConfirmation>[0]).catch(
      (err) => console.error('Failed to send booking confirmation:', err)
    )
  }

  return NextResponse.json(appointment)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
