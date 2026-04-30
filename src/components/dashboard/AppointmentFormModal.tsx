'use client'

import { useState, useEffect, useRef } from 'react'
import type { Appointment, Service, Client } from '@/types'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

interface Props {
  appointment?: Appointment & { client?: Client; service?: Service | null }
  defaultClientId?: string
  onClose: () => void
  onSaved: () => void
}

export default function AppointmentFormModal({ appointment, defaultClientId, onClose, onSaved }: Props) {
  const isEdit = !!appointment

  const [services,  setServices]  = useState<Service[]>([])
  const [clients,   setClients]   = useState<Client[]>([])
  const [form, setForm] = useState({
    client_id:           appointment?.client_id ?? defaultClientId ?? '',
    service_id:          appointment?.service_id ?? '',
    scheduled_at:        appointment?.scheduled_at
                           ? new Date(appointment.scheduled_at).toISOString().slice(0, 16)
                           : '',
    // When a service is selected: adjustment that adds/subtracts from standard price
    // When no service: this is the flat price
    adjustment:          '',
    notes:               appointment?.notes ?? '',
    service_description: appointment?.service_description ?? '',
  })

  // Base price tracks the selected service's standard price
  const [basePrice,     setBasePrice]     = useState<number>(0)
  // Track whether the adjustment field was initialised for the current edit
  const adjInitialised = useRef(false)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // ── Load services + clients ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json()).catch(() => [])
      .then((d) => Array.isArray(d) && setServices(d.filter((s: Service) => s.is_active)))
    if (!defaultClientId) {
      fetch('/api/clients')
        .then((r) => r.json()).catch(() => [])
        .then((d) => Array.isArray(d) && setClients(d))
    }
  }, [defaultClientId])

  // ── Sync base price when selected service changes ──────────────────────────
  useEffect(() => {
    if (form.service_id) {
      const svc = services.find((s) => s.id === form.service_id)
      setBasePrice(svc?.price ?? 0)
    } else {
      setBasePrice(0)
    }
  }, [form.service_id, services])

  // ── Pre-fill adjustment when editing (runs once, after services load) ──────
  useEffect(() => {
    if (!isEdit || adjInitialised.current || services.length === 0) return
    if (appointment?.price_charged == null) { adjInitialised.current = true; return }

    if (appointment.service_id) {
      const svc = services.find((s) => s.id === appointment.service_id)
      if (svc) {
        const adj = appointment.price_charged - svc.price
        if (Math.abs(adj) > 0.005) {
          setForm((f) => ({ ...f, adjustment: (adj >= 0 ? '+' : '') + adj.toFixed(2) }))
        }
        setBasePrice(svc.price)
      }
    } else {
      // No service — flat price field
      setForm((f) => ({ ...f, adjustment: appointment.price_charged!.toFixed(2) }))
    }
    adjInitialised.current = true
  }, [isEdit, services, appointment])

  // ── Derived values ─────────────────────────────────────────────────────────
  const selectedService = services.find((s) => s.id === form.service_id) ?? null
  const hasService      = !!selectedService

  const adjustmentNum   = form.adjustment !== '' ? parseFloat(form.adjustment) : 0
  const adjustmentValid = !isNaN(adjustmentNum)
  const effectivePrice  = adjustmentValid ? basePrice + adjustmentNum : null

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function selectService(id: string) {
    const toggled = id === form.service_id ? '' : id
    setForm((f) => ({ ...f, service_id: toggled, adjustment: '' }))
    adjInitialised.current = false
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (effectivePrice !== null && effectivePrice < 0) {
      setError('Charge amount cannot be negative')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      client_id:           form.client_id,
      service_id:          form.service_id || undefined,
      scheduled_at:        new Date(form.scheduled_at).toISOString(),
      price_charged:       effectivePrice ?? undefined,
      notes:               form.notes || undefined,
      service_description: (!form.service_id && form.service_description) ? form.service_description : undefined,
    }

    const res = await fetch(
      isEdit ? `/api/appointments/${appointment!.id}` : '/api/appointments',
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
    <Modal title={isEdit ? 'Edit Appointment' : 'New Appointment'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Client */}
        {!defaultClientId && (
          <div>
            <label className="label">Client *</label>
            <select className="input" value={form.client_id} onChange={set('client_id')} required>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} — {c.pet_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date & Time */}
        <div>
          <label className="label">Date & Time *</label>
          <input
            className="input"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={set('scheduled_at')}
            required
          />
        </div>

        {/* Service picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Service</label>
            {hasService && (
              <button
                type="button"
                onClick={() => selectService('')}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>

          {services.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              No services configured.{' '}
              <a href="/dashboard/services" className="underline text-brand-600 dark:text-brand-400">Add services →</a>
            </p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {services.map((svc) => {
                const selected = form.service_id === svc.id
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => selectService(svc.id)}
                    className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                      selected
                        ? 'border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/30'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-brand-300 dark:hover:border-brand-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-gray-100'}`}>
                          {svc.name}
                        </p>
                        {svc.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{svc.description}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{svc.duration_minutes} min</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {formatCurrency(svc.price)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Custom description when no service */}
        {!hasService && (
          <div>
            <label className="label">Service Description</label>
            <input
              className="input"
              value={form.service_description}
              onChange={set('service_description')}
              placeholder="e.g. Hand-scissor trim, puppy groom…"
            />
          </div>
        )}

        {/* Pricing section */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 space-y-2.5">
            {/* Math rows — only when a service is selected */}
            {hasService && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Standard price</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">
                  {formatCurrency(basePrice)}
                </span>
              </div>
            )}

            {/* Adjustment / Price field */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 dark:text-gray-400 shrink-0 w-28">
                {hasService ? 'Adjustment' : 'Price'}
              </label>
              <div className="relative flex-1">
                {!hasService && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none select-none">$</span>
                )}
                <input
                  className={`input ${!hasService ? 'pl-7' : ''} tabular-nums`}
                  type="number"
                  step="0.01"
                  value={form.adjustment}
                  onChange={set('adjustment')}
                  placeholder={hasService ? '−5.00 or +10.00' : '0.00'}
                />
              </div>
              {hasService && form.adjustment !== '' && adjustmentValid && (
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                  adjustmentNum < 0 ? 'text-red-600 dark:text-red-400' : adjustmentNum > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                }`}>
                  {adjustmentNum > 0 ? '+' : ''}{formatCurrency(adjustmentNum)}
                </span>
              )}
            </div>

            {/* Divider + total — only when a service is selected */}
            {hasService && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Charge amount</span>
                  <span className={`text-lg font-bold tabular-nums ${
                    effectivePrice !== null && effectivePrice < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-brand-700 dark:text-brand-400'
                  }`}>
                    {effectivePrice !== null ? formatCurrency(effectivePrice) : '—'}
                  </span>
                </div>
                {effectivePrice !== null && effectivePrice < 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">Charge amount cannot be negative</p>
                )}
              </>
            )}

            {/* Simple total when no service */}
            {!hasService && form.adjustment !== '' && adjustmentValid && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2.5">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Charge amount</span>
                <span className="text-lg font-bold text-brand-700 dark:text-brand-400 tabular-nums">
                  {formatCurrency(adjustmentNum)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.notes}
            onChange={set('notes')}
            placeholder="Any special instructions…"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Appointment'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}
