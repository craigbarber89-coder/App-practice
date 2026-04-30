import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateSchema = z.object({
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  end_time:   z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  notes:      z.string().nullable().optional(),
})

async function requireOwner() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: emp } = await service
    .from('employees')
    .select('id')
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .eq('is_active', true)
    .maybeSingle()

  return emp ? null : user
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireOwner()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('employee_shifts')
      .update(parsed.data)
      .eq('id', params.id)
      .select('*, employee:employees(id, first_name, last_name, color)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireOwner()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const service = createServiceClient()
    const { error } = await service.from('employee_shifts').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
