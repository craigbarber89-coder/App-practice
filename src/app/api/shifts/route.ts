import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  employee_id: z.string().uuid(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes:       z.string().optional().nullable(),
})

/** Returns { user, employeeId, isOwner } — employeeId is null if owner. */
async function resolveIdentity() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Check user_id link first
  let { data: emp } = await service
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Auto-link by email if not yet linked
  if (!emp && user.email) {
    const { data: byEmail } = await service
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .is('user_id', null)
      .eq('is_active', true)
      .maybeSingle()

    if (byEmail) {
      await service
        .from('employees')
        .update({ user_id: user.id })
        .eq('id', byEmail.id)
      emp = byEmail
    }
  }

  return { user, employeeId: emp?.id ?? null, isOwner: !emp }
}

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveIdentity()
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const week = searchParams.get('week') // YYYY-MM-DD of the Monday

    const service = createServiceClient()

    // Build date range: week start → +6 days
    let query = service
      .from('employee_shifts')
      .select('*, employee:employees(id, first_name, last_name, color)')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (week) {
      const start = new Date(week)
      const end   = new Date(week)
      end.setDate(end.getDate() + 6)
      query = query
        .gte('date', start.toISOString().slice(0, 10))
        .lte('date', end.toISOString().slice(0, 10))
    }

    // Employees only see their own shifts
    if (!identity.isOwner && identity.employeeId) {
      query = query.eq('employee_id', identity.employeeId)
    }

    const { data: shifts, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Owners also get the employee list for the schedule grid
    if (identity.isOwner) {
      const { data: employees } = await service
        .from('employees')
        .select('id, first_name, last_name, color, is_active')
        .eq('is_active', true)
        .order('first_name')

      return NextResponse.json({ shifts, employees, role: 'owner' })
    }

    return NextResponse.json({ shifts, role: 'employee', employeeId: identity.employeeId })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveIdentity()
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!identity.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('employee_shifts')
      .insert(parsed.data)
      .select('*, employee:employees(id, first_name, last_name, color)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
