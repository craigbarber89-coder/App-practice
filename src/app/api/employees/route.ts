import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  first_name: z.string().min(1),
  last_name:  z.string().min(1),
  email:      z.string().email().optional().nullable(),
  phone:      z.string().optional().nullable(),
  color:      z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  is_active:  z.boolean().default(true),
  notes:      z.string().optional().nullable(),
})

async function requireOwner() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // If the user is in the employees table they are NOT an owner
  const service = createServiceClient()
  const { data: emp } = await service
    .from('employees')
    .select('id')
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .eq('is_active', true)
    .maybeSingle()

  return emp ? null : user   // null means "not an owner — deny"
}

export async function GET() {
  try {
    const user = await requireOwner()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('employees')
      .select('*')
      .order('first_name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireOwner()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('employees')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
