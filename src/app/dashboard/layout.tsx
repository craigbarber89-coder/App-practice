import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/dashboard/DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Role detection ────────────────────────────────────────────────────────
  // An employee is anyone whose record appears in the employees table.
  // The owner is anyone who is NOT in that table.
  const service = createServiceClient()

  // 1. Try matching by user_id (fastest — already linked)
  let { data: emp } = await service
    .from('employees')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // 2. Auto-link by email on first login
  if (!emp && user.email) {
    const { data: byEmail } = await service
      .from('employees')
      .select('id, first_name, last_name')
      .eq('email', user.email)
      .is('user_id', null)
      .eq('is_active', true)
      .maybeSingle()

    if (byEmail) {
      // Link this Supabase user to their employee record
      await service
        .from('employees')
        .update({ user_id: user.id })
        .eq('id', byEmail.id)
      emp = byEmail
    }
  }

  const role: 'owner' | 'employee' = emp ? 'employee' : 'owner'
  const employeeId = emp?.id ?? undefined
  const employeeName = emp ? `${emp.first_name} ${emp.last_name}` : undefined

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <DashboardNav role={role} employeeId={employeeId} employeeName={employeeName} />
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
