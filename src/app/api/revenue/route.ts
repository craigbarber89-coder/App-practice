import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  addDays, addWeeks, addMonths, addQuarters,
  subDays, subWeeks, subMonths, subQuarters,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  format,
} from 'date-fns'
import { businessConfig } from '@config'

type Period = 'day' | 'week' | 'month' | 'quarter'

interface Appt {
  price_charged: number | null
  status: string
  scheduled_at: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getPeriodBounds(anchor: Date, period: Period, tz: string) {
  const zoned = toZonedTime(anchor, tz)
  let zonedStart: Date, zonedEnd: Date

  switch (period) {
    case 'day':
      zonedStart = startOfDay(zoned)
      zonedEnd   = endOfDay(zoned)
      break
    case 'week':
      zonedStart = startOfWeek(zoned, { weekStartsOn: 1 })
      zonedEnd   = endOfWeek(zoned,   { weekStartsOn: 1 })
      break
    case 'month':
      zonedStart = startOfMonth(zoned)
      zonedEnd   = endOfMonth(zoned)
      break
    case 'quarter':
      zonedStart = startOfQuarter(zoned)
      zonedEnd   = endOfQuarter(zoned)
      break
  }

  return {
    start: fromZonedTime(zonedStart, tz),
    end:   fromZonedTime(zonedEnd,   tz),
    zonedStart,
    zonedEnd,
  }
}

function shiftPeriod(anchor: Date, period: Period, direction: 1 | -1, tz: string): Date {
  const zoned = toZonedTime(anchor, tz)
  let shifted: Date
  switch (period) {
    case 'day':     shifted = direction > 0 ? addDays(zoned, 1)      : subDays(zoned, 1);      break
    case 'week':    shifted = direction > 0 ? addWeeks(zoned, 1)     : subWeeks(zoned, 1);     break
    case 'month':   shifted = direction > 0 ? addMonths(zoned, 1)    : subMonths(zoned, 1);    break
    case 'quarter': shifted = direction > 0 ? addQuarters(zoned, 1)  : subQuarters(zoned, 1);  break
  }
  return fromZonedTime(shifted, tz)
}

function computeLabel(anchor: Date, period: Period, tz: string): string {
  const zoned = toZonedTime(anchor, tz)
  switch (period) {
    case 'day':
      return format(zoned, 'EEEE, MMMM d, yyyy')
    case 'week': {
      const s = startOfWeek(zoned, { weekStartsOn: 1 })
      const e = endOfWeek(zoned,   { weekStartsOn: 1 })
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
    }
    case 'month':
      return format(zoned, 'MMMM yyyy')
    case 'quarter': {
      const q = Math.floor(zoned.getMonth() / 3) + 1
      return `Q${q} ${format(zoned, 'yyyy')}`
    }
  }
}

function computeBreakdown(
  appts: Appt[],
  period: Period,
  zonedStart: Date,
  zonedEnd: Date,
  utcStart: Date,
  utcEnd: Date,
  now: Date,
  tz: string,
) {
  if (period === 'day') return []

  let intervals: Array<{ label: string; start: Date; end: Date }>

  switch (period) {
    case 'week': {
      const days = eachDayOfInterval({ start: zonedStart, end: zonedEnd })
      intervals = days.map((d) => ({
        label: format(d, 'EEE M/d'),
        start: fromZonedTime(startOfDay(d), tz),
        end:   fromZonedTime(endOfDay(d),   tz),
      }))
      break
    }
    case 'month': {
      const weeks = eachWeekOfInterval({ start: zonedStart, end: zonedEnd }, { weekStartsOn: 1 })
      intervals = weeks.map((wStart) => {
        const wEnd      = endOfWeek(wStart, { weekStartsOn: 1 })
        const clippedS  = wStart < zonedStart ? zonedStart : wStart
        const clippedE  = wEnd   > zonedEnd   ? zonedEnd   : wEnd
        return {
          label: `Wk of ${format(clippedS, 'M/d')}`,
          start: fromZonedTime(startOfDay(clippedS), tz),
          end:   fromZonedTime(endOfDay(clippedE),   tz),
        }
      })
      break
    }
    case 'quarter': {
      const months = eachMonthOfInterval({ start: zonedStart, end: zonedEnd })
      intervals = months.map((m) => ({
        label: format(m, 'MMMM'),
        start: fromZonedTime(startOfMonth(m), tz),
        end:   fromZonedTime(endOfMonth(m),   tz),
      }))
      break
    }
    default:
      return []
  }

  return intervals.map(({ label, start, end }) => {
    const slice = appts.filter((a) => {
      const t = new Date(a.scheduled_at)
      return t >= start && t <= end
    })
    const actual    = slice.filter((a) => a.status === 'completed').reduce((s, a) => s + (a.price_charged ?? 0), 0)
    const projected = slice
      .filter((a) => (a.status === 'scheduled' || a.status === 'confirmed') && new Date(a.scheduled_at) > now)
      .reduce((s, a) => s + (a.price_charged ?? 0), 0)
    const count = slice.filter((a) => a.status === 'completed').length
    return { label, actual, projected, count }
  })
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { searchParams } = new URL(request.url)

    const period   = (searchParams.get('period') ?? 'month') as Period
    const anchorRaw = searchParams.get('anchor')
    const TZ       = businessConfig.timezone
    const now      = new Date()
    const anchor   = anchorRaw ? new Date(anchorRaw) : now

    // ── current period ──────────────────────────────────────────────────────
    const curr = getPeriodBounds(anchor, period, TZ)

    // ── previous period ─────────────────────────────────────────────────────
    const prevAnchor = shiftPeriod(anchor, period, -1, TZ)
    const prev       = getPeriodBounds(prevAnchor, period, TZ)

    // ── next period ─────────────────────────────────────────────────────────
    const nextAnchor = shiftPeriod(anchor, period, 1, TZ)

    const isCurrent = now >= curr.start && now <= curr.end

    // ── fetch appointments ──────────────────────────────────────────────────
    const [{ data: currAppts }, { data: prevAppts }, { data: settingsData }] = await Promise.all([
      service
        .from('appointments')
        .select('price_charged, status, scheduled_at')
        .gte('scheduled_at', curr.start.toISOString())
        .lte('scheduled_at', curr.end.toISOString())
        .not('status', 'eq', 'cancelled'),
      service
        .from('appointments')
        .select('price_charged, status, scheduled_at')
        .gte('scheduled_at', prev.start.toISOString())
        .lte('scheduled_at', prev.end.toISOString())
        .eq('status', 'completed'),
      service
        .from('settings')
        .select('key, value')
        .eq('key', 'tax_rate_percent'),
    ])

    // ── compute current period stats ────────────────────────────────────────
    const completed   = (currAppts ?? []).filter((a) => a.status === 'completed')
    const upcoming    = (currAppts ?? []).filter(
      (a) => (a.status === 'scheduled' || a.status === 'confirmed') && new Date(a.scheduled_at) > now
    )

    const actual         = completed.reduce((s, a) => s + (a.price_charged ?? 0), 0)
    const projected      = upcoming.reduce((s,  a) => s + (a.price_charged ?? 0), 0)
    const prevActual     = (prevAppts ?? []).reduce((s, a) => s + (a.price_charged ?? 0), 0)

    const taxRate        = parseFloat(settingsData?.[0]?.value ?? '0') / 100
    const taxEstimate    = actual * taxRate

    // ── breakdown ───────────────────────────────────────────────────────────
    const breakdown = computeBreakdown(
      currAppts ?? [],
      period,
      curr.zonedStart,
      curr.zonedEnd,
      curr.start,
      curr.end,
      now,
      TZ,
    )

    return NextResponse.json({
      period,
      current: {
        label:          computeLabel(anchor, period, TZ),
        start:          curr.start.toISOString(),
        end:            curr.end.toISOString(),
        actual,
        projected,
        count:          completed.length,
        projected_count: upcoming.length,
        breakdown,
      },
      previous: {
        label:  computeLabel(prevAnchor, period, TZ),
        start:  prev.start.toISOString(),
        end:    prev.end.toISOString(),
        actual: prevActual,
        count:  (prevAppts ?? []).length,
      },
      prev_anchor:      prevAnchor.toISOString(),
      next_anchor:      nextAnchor.toISOString(),
      is_current_period: isCurrent,
      tax_rate:         taxRate,
      tax_estimate:     taxEstimate,
    })
  } catch (err) {
    console.error('[revenue]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
