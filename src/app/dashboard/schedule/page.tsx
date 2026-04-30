'use client'

import { useEffect, useState, useCallback } from 'react'
import Modal from '@/components/ui/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
  id:         string
  first_name: string
  last_name:  string
  color:      string
  is_active:  boolean
}

interface Shift {
  id:          string
  employee_id: string
  date:        string   // YYYY-MM-DD
  start_time:  string   // HH:MM:SS
  end_time:    string   // HH:MM:SS
  notes:       string | null
  employee?:   Pick<Employee, 'id' | 'first_name' | 'last_name' | 'color'>
}

interface ScheduleData {
  role:        'owner' | 'employee'
  shifts:      Shift[]
  employees?:  Employee[]
  employeeId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for the Monday of the week containing `d` */
function getMondayOf(d: Date): string {
  const date = new Date(d)
  const day  = date.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

/** Shift length in decimal hours */
function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}

/** "09:00" → "9:00 AM" */
function fmt(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

/** Offset a YYYY-MM-DD string by `days` */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" → "Mon Apr 28" */
function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Shift modal ───────────────────────────────────────────────────────────────

function ShiftModal({
  shift,
  employees,
  defaultEmployeeId,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}: {
  shift?:             Shift
  employees:          Employee[]
  defaultEmployeeId?: string
  defaultDate?:       string
  onClose:            () => void
  onSaved:            () => void
  onDeleted?:         () => void
}) {
  const isEdit = !!shift
  const [form, setForm] = useState({
    employee_id: shift?.employee_id ?? defaultEmployeeId ?? (employees[0]?.id ?? ''),
    date:        shift?.date        ?? defaultDate        ?? '',
    start_time:  shift?.start_time?.slice(0, 5) ?? '09:00',
    end_time:    shift?.end_time?.slice(0, 5)   ?? '17:00',
    notes:       shift?.notes ?? '',
  })
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState('')

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const hours = shiftHours(form.start_time, form.end_time)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hours <= 0) { setError('End time must be after start time'); return }
    setSaving(true)
    setError('')

    const payload = {
      employee_id: form.employee_id,
      date:        form.date,
      start_time:  form.start_time,
      end_time:    form.end_time,
      notes:       form.notes || null,
    }

    const res = await fetch(
      isEdit ? `/api/shifts/${shift!.id}` : '/api/shifts',
      {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      },
    )

    if (res.ok) { onSaved() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!shift) return
    setDeleting(true)
    await fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
    onDeleted?.()
  }

  return (
    <Modal title={isEdit ? 'Edit Shift' : 'Add Shift'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {employees.length > 1 && (
          <div>
            <label className="label">Employee *</label>
            <select className="input" value={form.employee_id} onChange={set('employee_id')} required>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Date *</label>
          <input className="input" type="date" value={form.date} onChange={set('date')} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Time *</label>
            <input className="input" type="time" value={form.start_time} onChange={set('start_time')} required />
          </div>
          <div>
            <label className="label">End Time *</label>
            <input className="input" type="time" value={form.end_time} onChange={set('end_time')} required />
          </div>
        </div>

        {hours > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
            {hours % 1 === 0 ? hours : hours.toFixed(1)} hour{hours !== 1 ? 's' : ''}
          </p>
        )}

        <div>
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={set('notes')} placeholder="e.g. Opening shift, covers Saturday rush…" />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Shift'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger flex-1"
            >
              {deleting ? 'Removing…' : 'Remove Shift'}
            </button>
          )}
          {!isEdit && (
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOf(new Date()))
  const [data,       setData]       = useState<ScheduleData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [modal, setModal] = useState<{
    shift?:             Shift
    defaultEmployeeId?: string
    defaultDate?:       string
  } | null>(null)

  const load = useCallback(async (monday: string) => {
    setLoading(true)
    const res  = await fetch(`/api/shifts?week=${monday}`)
    if (!res.ok) { setLoading(false); return }
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => { load(weekMonday) }, [weekMonday, load])

  function prevWeek() { setWeekMonday((w) => addDays(w, -7)) }
  function nextWeek() { setWeekMonday((w) => addDays(w, 7)) }
  function thisWeek() { setWeekMonday(getMondayOf(new Date())) }

  const isThisWeek = weekMonday === getMondayOf(new Date())

  // 7 date strings for the current week
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i))

  const isOwner   = data?.role === 'owner'
  const employees = data?.employees ?? []
  const shifts    = data?.shifts ?? []

  // For employee view, create a single synthetic "employee" row
  const rows: Employee[] = isOwner
    ? employees
    : data?.employeeId
      ? [{ id: data.employeeId, first_name: 'My', last_name: 'Schedule', color: '#6366f1', is_active: true }]
      : []

  // Map: employeeId → date → shift[]
  const shiftMap = new Map<string, Map<string, Shift[]>>()
  for (const shift of shifts) {
    if (!shiftMap.has(shift.employee_id)) shiftMap.set(shift.employee_id, new Map())
    const empMap = shiftMap.get(shift.employee_id)!
    if (!empMap.has(shift.date)) empMap.set(shift.date, [])
    empMap.get(shift.date)!.push(shift)
  }

  // Weekly hours per employee
  function weeklyHours(empId: string): number {
    return (shiftMap.get(empId) ? [...shiftMap.get(empId)!.values()] : [])
      .flat()
      .reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0)
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Schedule</h1>
        {isOwner && (
          <button onClick={() => setModal({})} className="btn-primary">+ Add Shift</button>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevWeek}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          aria-label="Previous week"
        >‹</button>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {fmtDay(weekMonday)} – {fmtDay(addDays(weekMonday, 6))}
          </span>
        </div>

        <button
          onClick={nextWeek}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          aria-label="Next week"
        >›</button>

        {!isThisWeek && (
          <button onClick={thisWeek} className="btn-secondary text-xs py-1 px-2 ml-1">
            Today
          </button>
        )}
      </div>

      {/* Schedule grid */}
      {loading ? (
        <div className="card py-16 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card py-16 text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400">
            {isOwner ? 'No active employees yet.' : 'No schedule found.'}
          </p>
          {isOwner && (
            <a href="/dashboard/employees" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
              Add employees →
            </a>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {/* Employee column header */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36 min-w-[9rem]">
                    {isOwner ? 'Employee' : 'My Schedule'}
                  </th>
                  {/* Day column headers */}
                  {weekDates.map((date, i) => {
                    const isToday = date === new Date().toISOString().slice(0, 10)
                    return (
                      <th
                        key={date}
                        className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                          isToday
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className={`text-[10px] font-normal mt-0.5 ${isToday ? 'font-bold' : ''}`}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </th>
                    )
                  })}
                  {/* Total column */}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {rows.map((emp) => {
                  const empShifts = shiftMap.get(emp.id)
                  const total = weeklyHours(emp.id)

                  return (
                    <tr key={emp.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      {/* Employee name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: emp.color }} />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
                            {isOwner ? `${emp.first_name} ${emp.last_name}` : 'My Schedule'}
                          </span>
                        </div>
                      </td>

                      {/* Day cells */}
                      {weekDates.map((date) => {
                        const dayShifts = empShifts?.get(date) ?? []
                        const isToday   = date === new Date().toISOString().slice(0, 10)

                        return (
                          <td
                            key={date}
                            className={`px-2 py-2 text-center align-top min-w-[7rem] ${isToday ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}
                          >
                            {dayShifts.length > 0 ? (
                              <div className="space-y-1">
                                {dayShifts.map((shift) => (
                                  <button
                                    key={shift.id}
                                    onClick={() => isOwner && setModal({ shift })}
                                    disabled={!isOwner}
                                    className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                                      isOwner ? 'hover:brightness-90 cursor-pointer' : 'cursor-default'
                                    }`}
                                    style={{ backgroundColor: emp.color + '22', borderLeft: `3px solid ${emp.color}` }}
                                  >
                                    <p className="text-xs font-semibold" style={{ color: emp.color }}>
                                      {fmt(shift.start_time)} – {fmt(shift.end_time)}
                                    </p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                      {shiftHours(shift.start_time, shift.end_time).toFixed(1)}h
                                      {shift.notes && ` · ${shift.notes}`}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            ) : isOwner ? (
                              <button
                                onClick={() => setModal({ defaultEmployeeId: emp.id, defaultDate: date })}
                                className="w-full h-10 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 hover:border-brand-400 hover:text-brand-400 dark:hover:border-brand-500 dark:hover:text-brand-500 transition-colors text-xs font-medium opacity-0 group-hover:opacity-100"
                                aria-label={`Add shift for ${emp.first_name} on ${date}`}
                              >
                                + add
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
                            )}
                          </td>
                        )
                      })}

                      {/* Weekly total */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold tabular-nums ${total > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-700'}`}>
                          {total > 0 ? `${total % 1 === 0 ? total : total.toFixed(1)}h` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer: daily totals */}
              {isOwner && rows.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <td className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Daily total
                    </td>
                    {weekDates.map((date) => {
                      const dayTotal = shifts
                        .filter((s) => s.date === date)
                        .reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0)
                      return (
                        <td key={date} className="px-3 py-2 text-center">
                          <span className={`text-xs font-semibold tabular-nums ${dayTotal > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                            {dayTotal > 0 ? `${dayTotal % 1 === 0 ? dayTotal : dayTotal.toFixed(1)}h` : '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-bold text-brand-700 dark:text-brand-400 tabular-nums">
                        {(() => {
                          const t = shifts.reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0)
                          return t > 0 ? `${t % 1 === 0 ? t : t.toFixed(1)}h` : '—'
                        })()}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Shift modal */}
      {modal && isOwner && (
        <ShiftModal
          shift={modal.shift}
          employees={employees}
          defaultEmployeeId={modal.defaultEmployeeId}
          defaultDate={modal.defaultDate}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(weekMonday) }}
          onDeleted={() => { setModal(null); load(weekMonday) }}
        />
      )}
    </div>
  )
}
