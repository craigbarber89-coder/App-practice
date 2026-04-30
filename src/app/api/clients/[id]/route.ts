import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalisePhone } from '@/lib/twilio'
import { z } from 'zod'

const updateClientSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(7).optional(),
  pet_name: z.string().min(1).optional(),
  pet_breed: z.string().nullable().optional(),
  pet_notes: z.string().nullable().optional(),
  is_archived: z.boolean().optional(),
})

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      appointments (
        id, scheduled_at, status, service_description, price_charged, notes, duration_minutes,
        service:services(name)
      ),
      referrals_made:referrals!referrer_client_id (
        id,
        referred:clients!referred_client_id (first_name, last_name)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const body = await request.json()

  const parsed = updateClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.phone) {
    const phone = normalisePhone(parsed.data.phone)
    if (!phone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    updates.phone = phone
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  // Archive instead of hard delete to preserve history
  const { error } = await supabase
    .from('clients')
    .update({ is_archived: true })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
