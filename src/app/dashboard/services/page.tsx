'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Service } from '@/types'
import Modal from '@/components/ui/Modal'

const EMPTY_FORM = {
  name:             '',
  description:      '',
  price:            '',
  duration_minutes: '60',
  is_active:        true,
}

type FormState = typeof EMPTY_FORM

function ServiceFormModal({
  initial,
  maxSortOrder,
  onClose,
  onSaved,
}: {
  initial?: Service
  maxSortOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name:             initial.name,
          description:      initial.description ?? '',
          price:            String(initial.price),
          duration_minutes: String(initial.duration_minutes),
          is_active:        initial.is_active,
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const price = parseFloat(form.price)
    const duration = parseInt(form.duration_minutes, 10)

    if (isNaN(price) || price < 0) { setError('Enter a valid price'); setSaving(false); return }
    if (isNaN(duration) || duration < 5) { setError('Duration must be at least 5 minutes'); setSaving(false); return }

    const payload = {
      name:             form.name.trim(),
      description:      form.description.trim() || null,
      price,
      duration_minutes: duration,
      is_active:        form.is_active,
      ...(isEdit ? {} : { sort_order: maxSortOrder + 1 }),
    }

    const res = await fetch(
      isEdit ? `/api/services/${initial!.id}` : '/api/services',
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
    <Modal title={isEdit ? 'Edit Service' : 'New Service'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Service Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Full Groom, Bath & Brush"
            required
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.description}
            onChange={set('description')}
            placeholder="What's included in this service…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Standard Price ($) *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={set('price')}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="label">Duration (minutes) *</label>
            <input
              className="input"
              type="number"
              min="5"
              step="5"
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              placeholder="60"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="label mb-0">Active</label>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              form.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {form.is_active ? 'Visible on booking portal' : 'Hidden from booking portal'}
          </span>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Service'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

export default function ServicesPage() {
  const [services,    setServices]    = useState<Service[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState<'create' | Service | null>(null)
  const [confirmDel,  setConfirmDel]  = useState<Service | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [togglingId,  setTogglingId]  = useState<string | null>(null)
  const [movingId,    setMovingId]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/services').catch(() => null)
    const data = res?.ok ? await res.json() : []
    setServices(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(svc: Service) {
    setTogglingId(svc.id)
    await fetch(`/api/services/${svc.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !svc.is_active }),
    })
    await load()
    setTogglingId(null)
  }

  async function move(svc: Service, direction: 'up' | 'down') {
    const idx    = services.indexOf(svc)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= services.length) return

    const swap = services[swapIdx]
    setMovingId(svc.id)

    await Promise.all([
      fetch(`/api/services/${svc.id}`,  { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: swap.sort_order }) }),
      fetch(`/api/services/${swap.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: svc.sort_order }) }),
    ])
    await load()
    setMovingId(null)
  }

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(true)
    await fetch(`/api/services/${confirmDel.id}`, { method: 'DELETE' })
    setConfirmDel(null)
    setDeleting(false)
    await load()
  }

  const maxSortOrder = services.reduce((m, s) => Math.max(m, s.sort_order), 0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Services</h1>
        <button onClick={() => setModal('create')} className="btn-primary">
          + New Service
        </button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Services listed here appear on the client booking portal. Reorder them with the arrow buttons.
        The standard price auto-fills when creating appointments but can always be overridden.
      </p>

      {loading ? (
        <div className="card py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      ) : services.length === 0 ? (
        <div className="card py-12 text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400">No services yet.</p>
          <button onClick={() => setModal('create')} className="btn-primary">
            Create your first service
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((svc, idx) => (
            <div
              key={svc.id}
              className={`card flex items-start gap-4 transition-opacity ${
                !svc.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* Sort controls */}
              <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                <button
                  onClick={() => move(svc, 'up')}
                  disabled={idx === 0 || movingId === svc.id}
                  className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 transition-colors leading-none"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(svc, 'down')}
                  disabled={idx === services.length - 1 || movingId === svc.id}
                  className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 transition-colors leading-none"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{svc.name}</span>
                  {svc.is_active ? (
                    <span className="badge-confirmed text-[10px]">Active</span>
                  ) : (
                    <span className="badge-cancelled text-[10px]">Inactive</span>
                  )}
                </div>
                {svc.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{svc.description}</p>
                )}
                <div className="flex gap-4 mt-1.5 text-sm">
                  <span className="font-bold text-brand-700 dark:text-brand-400">{formatCurrency(svc.price)}</span>
                  <span className="text-gray-500 dark:text-gray-400">{svc.duration_minutes} min</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(svc)}
                  disabled={togglingId === svc.id}
                  title={svc.is_active ? 'Deactivate' : 'Activate'}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                    svc.is_active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      svc.is_active ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setModal(svc)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDel(svc)}
                  className="btn-danger text-xs py-1 px-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <ServiceFormModal
          initial={modal === 'create' ? undefined : modal}
          maxSortOrder={maxSortOrder}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDel && (
        <Modal title="Delete Service" onClose={() => setConfirmDel(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{confirmDel.name}</strong>?
              Existing appointments that used this service will keep their record.
            </p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? 'Deleting…' : 'Delete Service'}
              </button>
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
