import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createAppointmentSchema = z.object({
  client_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().min(15).optional(),
  service_description: z.string().optional(),
  price_charged: z.number().min(0).optional(),
  notes: z.string().optional(),
  booked_via: z.enum(['owner', 'portal']).default('owner'),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const clientId = searchParams.get('client_id')

    let query = supabase
      .from('appointments')
      .select(`
        *,
        client:clients(id, first_name, last_name, phone, email, pet_name, pet_breed),
        service:services(id, name, price, duration_minutes)
      `)
      .order('scheduled_at', { ascending: true })

    if (status) query = query.eq('status', status)
    if (from) query = query.gte('scheduled_at', from)
    if (to) query = query.lte('scheduled_at', to)
    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    const parsed = createAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Resolve duration from service if not specified
    let durationMinutes = parsed.data.duration_minutes
    if (!durationMinutes && parsed.data.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', parsed.data.service_id)
        .single()
      durationMinutes = service?.duration_minutes ?? 60
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        ...parsed.data,
        duration_minutes: durationMinutes ?? 60,
      })
      .select(`
        *,
        client:clients(*),
        service:services(*)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(appointment, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 })
  }
}
