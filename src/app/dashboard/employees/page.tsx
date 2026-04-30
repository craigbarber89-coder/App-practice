'use client'

import { useEffect, useState, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import { redirect } from 'next/navigation'

interface Employee {
  id:         string
  first_name: string
  last_name:  string
  email:      string | null
  phone:      string | null
  color:      string
  is_active:  boolean
  notes:      string | null
  user_id:    string | null
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
]

const EMPTY_FORM = {
  first_name: '',
  last_name:  '',
  email:      '',
  phone:      '',
  color:      '#6366f1',
  is_active:  true,
  notes:      '',
}

type FormState = typeof EMPTY_FORM

function EmployeeModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Employee
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm]   = useState<FormState>(
    initial
      ? {
          first_name: initial.first_name,
          last_name:  initial.last_name,
          email:      initial.email      ?? '',
          phone:      initial.phone      ?? '',
          color:      initial.color,
          is_active:  initial.is_active,
          notes:      initial.notes      ?? '',
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      email:      form.email.trim()  || null,
      phone:      form.phone.trim()  || null,
      color:      form.color,
      is_active:  form.is_active,
      notes:      form.notes.trim()  || null,
    }

    const res = await fetch(
      isEdit ? `/api/employees/${initial!.id}` : '/api/employees',
      {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      },
    )

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Employee' : 'Add Employee'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First Name *</label>
            <input className="input" value={form.first_name} onChange={set('first_name')} required />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="input" value={form.last_name} onChange={set('last_name')} required />
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="employee@example.com" />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            They can log in with this email — their account will be linked automatically.
          </p>
        </div>

        <div>
          <label className="label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
        </div>

        {/* Color picker */}
        <div>
          <label className="label">Calendar Colour</label>
          <div className="flex gap-2 flex-wrap mt-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-gray-100 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={set('notes')} placeholder="Role, specialties, emergency contact…" />
        </div>

        <div className="flex items-center gap-3">
          <label className="label mb-0">Active</label>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

export default function EmployeesPage() {
  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState<'create' | Employee | null>(null)
  const [confirmDel,  setConfirmDel]  = useState<Employee | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [togglingId,  setTogglingId]  = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/employees')
    if (res.status === 401 || res.status === 403) { setUnauthorized(true); setLoading(false); return }
    const data = res.ok ? await res.json() : []
    setEmployees(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(emp: Employee) {
    setTogglingId(emp.id)
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    await load()
    setTogglingId(null)
  }

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(true)
    await fetch(`/api/employees/${confirmDel.id}`, { method: 'DELETE' })
    setConfirmDel(null)
    setDeleting(false)
    await load()
  }

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  const active   = employees.filter((e) => e.is_active)
  const inactive = employees.filter((e) => !e.is_active)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employees</h1>
        <button onClick={() => setModal('create')} className="btn-primary">+ Add Employee</button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Add team members here. If you enter their email address, they can log in and their account will be
        linked automatically — they&apos;ll see the employee view of the dashboard.
      </p>

      {loading ? (
        <div className="card py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : employees.length === 0 ? (
        <div className="card py-12 text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400">No employees yet.</p>
          <button onClick={() => setModal('create')} className="btn-primary">Add your first employee</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active employees */}
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  toggling={togglingId === emp.id}
                  onEdit={() => setModal(emp)}
                  onToggle={() => toggleActive(emp)}
                  onDelete={() => setConfirmDel(emp)}
                />
              ))}
            </div>
          )}

          {/* Inactive employees (collapsed section) */}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                Inactive ({inactive.length})
              </p>
              {inactive.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  toggling={togglingId === emp.id}
                  onEdit={() => setModal(emp)}
                  onToggle={() => toggleActive(emp)}
                  onDelete={() => setConfirmDel(emp)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <EmployeeModal
          initial={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <Modal title="Remove Employee" onClose={() => setConfirmDel(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to remove <strong>{confirmDel.first_name} {confirmDel.last_name}</strong>?
              Their shift history will also be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? 'Removing…' : 'Remove Employee'}
              </button>
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function EmployeeRow({
  emp, toggling, onEdit, onToggle, onDelete,
}: {
  emp:      Employee
  toggling: boolean
  onEdit:   () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className={`card flex items-center gap-4 transition-opacity ${!emp.is_active ? 'opacity-60' : ''}`}>
      {/* Colour swatch */}
      <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: emp.color }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {emp.first_name} {emp.last_name}
          </span>
          {emp.user_id && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">
              ✓ Linked
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          {emp.email && <span>{emp.email}</span>}
          {emp.phone && <span>{emp.phone}</span>}
          {emp.notes && <span className="italic truncate max-w-48">{emp.notes}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggle}
          disabled={toggling}
          title={emp.is_active ? 'Deactivate' : 'Reactivate'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${emp.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${emp.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
        <button onClick={onEdit} className="btn-secondary text-xs py-1 px-2">Edit</button>
        <button onClick={onDelete} className="btn-danger text-xs py-1 px-2">Remove</button>
      </div>
    </div>
  )
}
