'use client'

import { useState } from 'react'
import type { Client } from '@/types'
import Modal from '@/components/ui/Modal'

interface Props {
  client?: Client
  onClose: () => void
  onSaved: () => void
}

export default function ClientFormModal({ client, onClose, onSaved }: Props) {
  const isEdit = !!client
  const [form, setForm] = useState({
    first_name: client?.first_name ?? '',
    last_name: client?.last_name ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    pet_name: client?.pet_name ?? '',
    pet_breed: client?.pet_breed ?? '',
    pet_notes: client?.pet_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || undefined,
      phone: form.phone,
      pet_name: form.pet_name,
      pet_breed: form.pet_breed || undefined,
      pet_notes: form.pet_notes || undefined,
    }

    const res = await fetch(isEdit ? `/api/clients/${client!.id}` : '/api/clients', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      onSaved()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Client' : 'Add Client'} onClose={onClose}>
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
          <label className="label">Phone *</label>
          <input className="input" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Pet Name *</label>
            <input className="input" value={form.pet_name} onChange={set('pet_name')} required />
          </div>
          <div>
            <label className="label">Breed</label>
            <input className="input" value={form.pet_breed} onChange={set('pet_breed')} placeholder="optional" />
          </div>
        </div>
        <div>
          <label className="label">Pet Notes</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.pet_notes}
            onChange={set('pet_notes')}
            placeholder="Aggression, special needs, health conditions…"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
