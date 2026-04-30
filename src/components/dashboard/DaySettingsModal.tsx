'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'

export interface DaySetting {
  id?: string
  date: string
  note: string | null
  block_type: 'none' | 'full' | 'am' | 'pm'
  label: string | null
}

interface Props {
  date: Date
  existing: DaySetting | null
  onClose: () => void
  onSaved: (setting: DaySetting | null) => void
}

const BLOCK_OPTIONS = [
  { value: 'none', label: 'No block — open for bookings', icon: '✅' },
  { value: 'full', label: 'Full day — no bookings', icon: '🚫' },
  { value: 'am', label: 'Morning only (AM) — no bookings before noon', icon: '🌅' },
  { value: 'pm', label: 'Afternoon only (PM) — no bookings after noon', icon: '🌇' },
] as const

export default function DaySettingsModal({ date, existing, onClose, onSaved }: Props) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const [note, setNote] = useState(existing?.note ?? '')
  const [blockType, setBlockType] = useState<DaySetting['block_type']>(existing?.block_type ?? 'none')
  const [label, setLabel] = useState(existing?.label ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/day-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: dateStr,
        note: note.trim() || null,
        block_type: blockType,
        label: label.trim() || null,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    onSaved(data.deleted ? null : data)
  }

  async function handleClear() {
    setSaving(true)
    await fetch(`/api/day-settings?date=${dateStr}`, { method: 'DELETE' })
    onSaved(null)
  }

  return (
    <Modal title={`${format(date, 'EEEE, MMMM d yyyy')}`} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-5">

        {/* Block type */}
        <div>
          <label className="label">Availability</label>
          <div className="space-y-2 mt-1">
            {BLOCK_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  blockType === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="block_type"
                  value={opt.value}
                  checked={blockType === opt.value}
                  onChange={() => setBlockType(opt.value)}
                  className="accent-brand-600"
                />
                <span className="text-base">{opt.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Label (only relevant when blocking) */}
        {blockType !== 'none' && (
          <div>
            <label className="label">
              Block Label{' '}
              <span className="text-gray-400 dark:text-gray-500 font-normal">(shown on calendar)</span>
            </label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Vacation, Holiday, Personal"
            />
          </div>
        )}

        {/* Note */}
        <div>
          <label className="label">
            Day Note{' '}
            <span className="text-gray-400 dark:text-gray-500 font-normal">(optional internal note)</span>
          </label>
          <textarea
            className="input resize-none"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Team lunch at 12pm, pick up supplies after last appointment…"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {existing && (
            <button
              type="button"
              disabled={saving}
              onClick={handleClear}
              className="btn-secondary px-3"
              title="Clear all settings for this day"
            >
              Clear
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
