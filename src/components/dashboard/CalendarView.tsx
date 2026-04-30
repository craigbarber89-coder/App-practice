'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import type { Appointment, Client, Service } from '@/types'
import DaySettingsModal, { type DaySetting } from './DaySettingsModal'

type ApptWithRelations = Appointment & { client: Client; service: Service | null }

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  confirmed: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  completed: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
  cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  no_show:   'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
}

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-blue-500',
  confirmed: 'bg-green-500',
  completed: 'bg-gray-400',
  cancelled: 'bg-red-400',
  no_show:   'bg-orange-400',
}

const BLOCK_STYLES: Record<string, { bg: string; label: string; icon: string; detailBg: string; detailBorder: string; textColor: string }> = {
  full: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    label: 'Closed',
    icon: '🚫',
    detailBg: 'bg-red-50 dark:bg-red-900/20',
    detailBorder: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-400',
  },
  am: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    label: 'AM closed',
    icon: '🌅',
    detailBg: 'bg-amber-50 dark:bg-amber-900/20',
    detailBorder: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  pm: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    label: 'PM closed',
    icon: '🌇',
    detailBg: 'bg-amber-50 dark:bg-amber-900/20',
    detailBorder: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
}

const CALENDAR_TABS = [
  { key: 'upcoming',  label: 'Upcoming',  statuses: ['scheduled', 'confirmed'] },
  { key: 'all',       label: 'All',       statuses: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] },
  { key: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
] as const

type CalendarTabKey = typeof CALENDAR_TABS[number]['key']

interface Props {
  appointments: ApptWithRelations[]
  onStatusChange: (id: string, status: Appointment['status']) => Promise<void>
  onNewAppointment: () => void
  updating: string | null
}

export default function CalendarView({ appointments, onStatusChange, onNewAppointment, updating }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [activeTab, setActiveTab] = useState<CalendarTabKey>('upcoming')
  const [daySettings, setDaySettings] = useState<Record<string, DaySetting>>({})
  const [editingDay, setEditingDay] = useState<Date | null>(null)

  const activeStatuses = CALENDAR_TABS.find((t) => t.key === activeTab)?.statuses ?? []

  const loadDaySettings = useCallback(async () => {
    const from = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const to   = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const res  = await fetch(`/api/day-settings?from=${from}&to=${to}`)
    const data: DaySetting[] = await res.json().catch(() => [])
    if (!Array.isArray(data)) return
    const map: Record<string, DaySetting> = {}
    for (const s of data) map[s.date] = s
    setDaySettings(map)
  }, [currentMonth])

  useEffect(() => { loadDaySettings() }, [loadDaySettings])

  const filteredAppointments = useMemo(
    () => appointments.filter((a) => activeStatuses.includes(a.status)),
    [appointments, activeTab] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),   { weekStartsOn: 0 })
    const days: Date[] = []
    let day = start
    while (day <= end) { days.push(day); day = addDays(day, 1) }
    return days
  }, [currentMonth])

  const apptsByDay = useMemo(() => {
    const map: Record<string, ApptWithRelations[]> = {}
    for (const appt of filteredAppointments) {
      const key = format(new Date(appt.scheduled_at), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(appt)
    }
    return map
  }, [filteredAppointments])

  const selectedDayKey  = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const selectedAppts   = selectedDayKey ? (apptsByDay[selectedDayKey] ?? []) : []
  const selectedSetting = selectedDayKey ? (daySettings[selectedDayKey] ?? null) : null

  const sortedSelectedAppts = [...selectedAppts].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )

  function handleSettingSaved(setting: DaySetting | null) {
    if (!editingDay) return
    const key = format(editingDay, 'yyyy-MM-dd')
    setDaySettings((prev) => {
      const next = { ...prev }
      if (setting) next[key] = setting
      else delete next[key]
      return next
    })
    setEditingDay(null)
  }

  return (
    <div className="space-y-3">
      {/* Tab toggles */}
      <div className="flex gap-1 flex-wrap">
        {CALENDAR_TABS.map(({ key, label, statuses }) => {
          const isActive = activeTab === key
          const activeClass = isActive
            ? key === 'upcoming' || key === 'all' ? 'bg-brand-600 text-white dark:bg-brand-500'
            : key === 'scheduled' ? 'bg-blue-600 text-white'
            : key === 'confirmed' ? 'bg-green-600 text-white'
            : key === 'completed' ? 'bg-gray-600 text-white'
            : 'bg-red-600 text-white'
            : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeClass}`}
            >
              {!isActive && statuses.length === 1 && (
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[statuses[0]] ?? 'bg-gray-400'}`} />
              )}
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 items-start">
        {/* Calendar grid */}
        <div className="card flex-1 min-w-0 p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            >←</button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            >→</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {calendarDays.map((day) => {
              const key        = format(day, 'yyyy-MM-dd')
              const dayAppts   = apptsByDay[key] ?? []
              const setting    = daySettings[key]
              const blockStyle = setting?.block_type && setting.block_type !== 'none'
                ? BLOCK_STYLES[setting.block_type] : null
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
              const isT        = isToday(day)

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={[
                    'relative bg-white dark:bg-gray-900 text-left p-1.5 min-h-[80px] transition-colors',
                    !isCurrentMonth ? 'opacity-40' : '',
                    blockStyle ? blockStyle.bg : '',
                    isSelected ? 'ring-2 ring-inset ring-brand-500' : 'hover:brightness-95 dark:hover:bg-gray-800',
                  ].filter(Boolean).join(' ')}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isT ? 'bg-brand-600 dark:bg-brand-500 text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {setting?.note && (
                      <span title={setting.note} className="text-[10px] text-gray-400">📝</span>
                    )}
                  </div>

                  {/* Block indicator */}
                  {blockStyle && (
                    <div className={`text-[10px] font-semibold flex items-center gap-0.5 mb-0.5 leading-tight ${blockStyle.textColor}`}>
                      <span>{blockStyle.icon}</span>
                      <span className="truncate">{setting?.label || blockStyle.label}</span>
                    </div>
                  )}

                  {/* Appointment chips */}
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, blockStyle ? 1 : 2).map((appt) => (
                      <div key={appt.id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate font-medium ${STATUS_COLORS[appt.status] ?? ''}`}>
                        {format(new Date(appt.scheduled_at), 'h:mma').toLowerCase()} {appt.client?.first_name}
                      </div>
                    ))}
                    {dayAppts.length > (blockStyle ? 1 : 2) && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1">
                        +{dayAppts.length - (blockStyle ? 1 : 2)} more
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            {activeStatuses.map((status) => (
              <span key={status} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
                {status.replace('_', ' ')}
              </span>
            ))}
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">🚫 Blocked</span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">📝 Note</span>
          </div>
        </div>

        {/* Day detail panel */}
        <div className="card w-72 shrink-0 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a day'}
            </h3>
            {selectedDay && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditingDay(selectedDay)}
                  className="text-xs btn-secondary py-1 px-2"
                  title="Add note or block this day"
                >
                  ✏️ Edit Day
                </button>
                <button onClick={onNewAppointment} className="text-xs btn-primary py-1 px-2">
                  + Appt
                </button>
              </div>
            )}
          </div>

          {/* Block notice */}
          {selectedSetting?.block_type && selectedSetting.block_type !== 'none' && (() => {
            const bs = BLOCK_STYLES[selectedSetting.block_type]
            return (
              <div className={`rounded-lg border px-3 py-2 ${bs.detailBg} ${bs.detailBorder}`}>
                <p className={`text-xs font-semibold flex items-center gap-1 ${bs.textColor}`}>
                  {bs.icon} {selectedSetting.label || bs.label}
                </p>
                <p className={`text-xs mt-0.5 ${bs.textColor} opacity-80`}>
                  {selectedSetting.block_type === 'full'
                    ? 'Full day blocked — no new bookings via portal.'
                    : selectedSetting.block_type === 'am'
                    ? 'AM blocked — no bookings before 12pm via portal.'
                    : 'PM blocked — no bookings from 12pm via portal.'}
                </p>
              </div>
            )
          })()}

          {/* Day note */}
          {selectedSetting?.note && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-0.5">📝 Note</p>
              <p className="text-xs text-yellow-900 dark:text-yellow-300">{selectedSetting.note}</p>
            </div>
          )}

          {!selectedDay && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Click a day to see appointments.</p>
          )}

          {selectedDay && sortedSelectedAppts.length === 0 && (
            !selectedSetting || (selectedSetting.block_type === 'none' && !selectedSetting.note)
          ) && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No appointments this day.</p>
          )}

          {sortedSelectedAppts.map((appt) => (
            <div key={appt.id}
              className={`rounded-lg border p-3 space-y-2 ${STATUS_COLORS[appt.status] ?? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {format(new Date(appt.scheduled_at), 'h:mm a')}
                  </p>
                  <Link href={`/dashboard/clients/${appt.client_id}`}
                    className="text-sm font-medium text-brand-700 dark:text-brand-400 hover:underline leading-tight">
                    {appt.client?.first_name} {appt.client?.last_name}
                  </Link>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{appt.client?.pet_name}</p>
                </div>
                {appt.price_charged != null && (
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 shrink-0">
                    {formatCurrency(appt.price_charged)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {appt.service?.name ?? appt.service_description ?? 'Grooming'}
              </p>
              {appt.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{appt.notes}</p>}
              <div className="flex gap-2 pt-1 flex-wrap">
                {appt.status === 'scheduled' && (
                  <>
                    <button disabled={updating === appt.id}
                      onClick={() => onStatusChange(appt.id, 'confirmed')}
                      className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-gray-800 dark:text-gray-200 transition-colors">
                      Confirm
                    </button>
                    <button disabled={updating === appt.id}
                      onClick={() => onStatusChange(appt.id, 'cancelled')}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium">
                      Cancel
                    </button>
                  </>
                )}
                {appt.status === 'confirmed' && (
                  <>
                    <button disabled={updating === appt.id}
                      onClick={() => onStatusChange(appt.id, 'completed')}
                      className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded px-2 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium text-gray-800 dark:text-gray-200 transition-colors">
                      Complete
                    </button>
                    <button disabled={updating === appt.id}
                      onClick={() => onStatusChange(appt.id, 'no_show')}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                      No Show
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day settings modal */}
      {editingDay && (
        <DaySettingsModal
          date={editingDay}
          existing={daySettings[format(editingDay, 'yyyy-MM-dd')] ?? null}
          onClose={() => setEditingDay(null)}
          onSaved={handleSettingSaved}
        />
      )}
    </div>
  )
}
