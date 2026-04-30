'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { businessConfig } from '@config'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import DarkModeToggle from './DarkModeToggle'

interface NavItem {
  href:       string
  label:      string
  icon:       string
  exact?:     boolean
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',              label: 'Overview',           icon: '📊', exact: true },
  { href: '/dashboard/appointments', label: 'Appointments',       icon: '📅' },
  { href: '/dashboard/clients',      label: 'Clients',            icon: '🐾' },
  { href: '/dashboard/services',     label: 'Services',           icon: '✂️' },
  { href: '/dashboard/employees',    label: 'Employees',          icon: '👥', ownerOnly: true },
  { href: '/dashboard/schedule',     label: 'Schedule',           icon: '🗓️' },
  { href: '/dashboard/messages',     label: 'Messages',           icon: '💬' },
  { href: '/dashboard/reviews',      label: 'Reviews & Referrals', icon: '⭐' },
  { href: '/dashboard/revenue',      label: 'Revenue',            icon: '💰', ownerOnly: true },
  { href: '/dashboard/applications', label: 'Applications',       icon: '📋', ownerOnly: true },
  { href: '/dashboard/settings',     label: 'Settings',           icon: '⚙️', ownerOnly: true },
]

interface Props {
  role:          'owner' | 'employee'
  employeeId?:   string
  employeeName?: string
}

export default function DashboardNav({ role, employeeId, employeeName }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const isOwner  = role === 'owner'

  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [pendingCount,  setPendingCount]  = useState(0)

  // Owners see pending application badge
  useEffect(() => {
    if (!isOwner) return
    async function fetchPending() {
      try {
        const res = await fetch('/api/applications?status=pending')
        if (!res.ok) return
        const data = await res.json().catch(() => [])
        setPendingCount(Array.isArray(data) ? data.length : 0)
      } catch { /* ignore */ }
    }
    fetchPending()
    const id = setInterval(fetchPending, 60_000)
    return () => clearInterval(id)
  }, [isOwner])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = NAV_ITEMS.filter((item) => isOwner || !item.ownerOnly)

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700">
        <span className="font-bold text-brand-600 dark:text-brand-500 text-lg">{businessConfig.name}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {isOwner ? 'Owner Dashboard' : `Employee · ${employeeName ?? 'Staff'}`}
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const active     = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const showBadge  = isOwner && item.href === '/dashboard/applications' && pendingCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              )}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4 h-4 shrink-0">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <DarkModeToggle />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
        >
          <span>🚪</span>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shrink-0">
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 h-14">
        <span className="font-bold text-brand-600 dark:text-brand-500">{businessConfig.name}</span>
        <div className="flex items-center gap-2">
          {isOwner && pendingCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold w-4 h-4">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-14 left-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
            {navContent}
          </aside>
        </div>
      )}

      {/* Mobile top-bar spacer */}
      <div className="lg:hidden h-14 shrink-0" />
    </>
  )
}
