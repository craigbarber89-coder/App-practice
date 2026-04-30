'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'

type Period = 'day' | 'week' | 'month' | 'quarter'

interface BreakdownRow {
  label: string
  actual: number
  projected: number
  count: number
}

interface PeriodData {
  label: string
  start: string
  end: string
  actual: number
  projected: number
  count: number
  projected_count: number
  breakdown: BreakdownRow[]
}

interface PreviousData {
  label: string
  start: string
  end: string
  actual: number
  count: number
}

interface RevenueData {
  period: Period
  current: PeriodData
  previous: PreviousData
  prev_anchor: string
  next_anchor: string
  is_current_period: boolean
  tax_rate: number
  tax_estimate: number
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',     label: 'Day'     },
  { value: 'week',    label: 'Week'    },
  { value: 'month',   label: 'Month'   },
  { value: 'quarter', label: 'Quarter' },
]

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function PctBadge({ current, previous }: { current: number; previous: number }) {
  const pct = pctChange(current, previous)
  if (pct === null) return <span className="text-xs text-gray-400 dark:text-gray-500">— no prior data</span>
  const up = pct >= 0
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function BreakdownChart({ rows, max }: { rows: BreakdownRow[]; max: number }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2 pt-2">
      {rows.map((row) => {
        const actualPct   = max > 0 ? (row.actual   / max) * 100 : 0
        const projectedPct = max > 0 ? (row.projected / max) * 100 : 0
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-400 w-24 shrink-0">{row.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                {formatCurrency(row.actual + row.projected)}
              </span>
            </div>
            <div className="flex gap-0.5 h-4 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
              {row.actual > 0 && (
                <div
                  className="bg-brand-500 dark:bg-brand-600 transition-all"
                  style={{ width: `${actualPct}%` }}
                  title={`Completed: ${formatCurrency(row.actual)}`}
                />
              )}
              {row.projected > 0 && (
                <div
                  className="bg-blue-400 dark:bg-blue-500 transition-all"
                  style={{ width: `${projectedPct}%` }}
                  title={`Projected: ${formatCurrency(row.projected)}`}
                />
              )}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-4 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-brand-500 dark:bg-brand-600 inline-block" />
          Completed
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-500 inline-block" />
          Projected
        </span>
      </div>
    </div>
  )
}

export default function RevenuePage() {
  const [period, setPeriod]     = useState<Period>('month')
  const [anchor, setAnchor]     = useState<string>('')        // ISO — empty means "now"
  const [data, setData]         = useState<RevenueData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [taxInput, setTaxInput] = useState<string>('')
  const [savingTax, setSavingTax] = useState(false)
  const [taxSaved, setTaxSaved]   = useState(false)

  const fetchRevenue = useCallback(async (p: Period, a: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: p })
      if (a) params.set('anchor', a)
      const res = await fetch(`/api/revenue?${params}`)
      if (!res.ok) return
      const json: RevenueData = await res.json()
      setData(json)
      // Initialise tax input from server if not yet edited
      setTaxInput((prev) => prev === '' ? String(Math.round(json.tax_rate * 100)) : prev)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRevenue(period, anchor)
  }, [period, anchor, fetchRevenue])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    setAnchor('')   // reset to current period
  }

  function handlePrev() {
    if (!data) return
    setAnchor(data.prev_anchor)
  }

  function handleNext() {
    if (!data || data.is_current_period) return
    setAnchor(data.next_anchor)
  }

  async function saveTaxRate() {
    const rate = parseFloat(taxInput)
    if (isNaN(rate) || rate < 0 || rate > 100) return
    setSavingTax(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tax_rate_percent: String(rate) }),
    })
    setSavingTax(false)
    setTaxSaved(true)
    setTimeout(() => setTaxSaved(false), 2500)
    // Refresh revenue to pick up new rate
    await fetchRevenue(period, anchor)
  }

  const current       = data?.current
  const previous      = data?.previous
  const total         = (current?.actual ?? 0) + (current?.projected ?? 0)
  const breakdownMax  = Math.max(...(current?.breakdown ?? []).map((r) => r.actual + r.projected), 1)

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Revenue</h1>

      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrev}
          disabled={loading}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          aria-label="Previous period"
        >
          ‹
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-0">
          {loading ? '…' : (current?.label ?? '—')}
        </span>
        <button
          onClick={handleNext}
          disabled={loading || (data?.is_current_period ?? true)}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          aria-label="Next period"
        >
          ›
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Completed"
          value={formatCurrency(current?.actual ?? 0)}
          sub={`${current?.count ?? 0} appt${current?.count !== 1 ? 's' : ''}`}
          loading={loading}
          accent="brand"
        />
        <SummaryCard
          label="Projected"
          value={formatCurrency(current?.projected ?? 0)}
          sub={`${current?.projected_count ?? 0} upcoming`}
          loading={loading}
          accent="blue"
        />
        <SummaryCard
          label="Total"
          value={formatCurrency(total)}
          sub="actual + projected"
          loading={loading}
          accent="gray"
        />
        <SummaryCard
          label="Tax Estimate"
          value={formatCurrency(data?.tax_estimate ?? 0)}
          sub={`@ ${taxInput || '0'}%`}
          loading={loading}
          accent="amber"
        />
      </div>

      {/* Tax rate editor */}
      <div className="card flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
          Tax rate %
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={taxInput}
          onChange={(e) => setTaxInput(e.target.value)}
          className="input w-24"
          placeholder="e.g. 25"
        />
        <button
          onClick={saveTaxRate}
          disabled={savingTax}
          className="btn-primary text-sm py-1.5 px-3"
        >
          {savingTax ? 'Saving…' : 'Save'}
        </button>
        {taxSaved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">Saved!</span>}
        <p className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          Applied to completed revenue only
        </p>
      </div>

      {/* vs Previous period */}
      {previous && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            vs {previous.label}
          </h2>
          <div className="space-y-3">
            <CompareRow
              label="Revenue"
              current={current?.actual ?? 0}
              previous={previous.actual}
            />
            <CompareRow
              label="Appointments"
              current={current?.count ?? 0}
              previous={previous.count}
              isCurrency={false}
            />
          </div>
        </div>
      )}

      {/* Breakdown */}
      {current && current.breakdown.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {period === 'week' ? 'By Day' : period === 'month' ? 'By Week' : 'By Month'}
          </h2>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
          ) : (
            <BreakdownChart rows={current.breakdown} max={breakdownMax} />
          )}
        </div>
      )}

      {/* Day view — no breakdown, just a note */}
      {current && current.breakdown.length === 0 && period === 'day' && !loading && (
        <div className="card text-center py-8">
          <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">
            {formatCurrency(current.actual)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {current.count} completed appointment{current.count !== 1 ? 's' : ''} on {current.label}
          </p>
          {current.projected > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              + {formatCurrency(current.projected)} projected from {current.projected_count} upcoming
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, loading, accent,
}: {
  label: string
  value: string
  sub: string
  loading: boolean
  accent: 'brand' | 'blue' | 'gray' | 'amber'
}) {
  const valueClass = {
    brand: 'text-brand-700 dark:text-brand-400',
    blue:  'text-blue-600  dark:text-blue-400',
    gray:  'text-gray-900  dark:text-gray-100',
    amber: 'text-amber-600 dark:text-amber-400',
  }[accent]

  return (
    <div className="card py-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass} ${loading ? 'opacity-40' : ''}`}>
        {loading ? '—' : value}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}

function CompareRow({
  label, current, previous, isCurrency = true,
}: {
  label: string
  current: number
  previous: number
  isCurrency?: boolean
}) {
  const fmt = (v: number) => isCurrency ? formatCurrency(v) : String(v)
  const maxVal = Math.max(current, previous, 1)
  const currPct = (current / maxVal) * 100
  const prevPct = (previous / maxVal) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
        <PctBadge current={current} previous={previous} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">This</span>
          <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-brand-500 dark:bg-brand-600 transition-all" style={{ width: `${currPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 w-16">{fmt(current)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">Prior</span>
          <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-300 dark:bg-gray-600 transition-all" style={{ width: `${prevPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-16">{fmt(previous)}</span>
        </div>
      </div>
    </div>
  )
}
