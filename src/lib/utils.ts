import { format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { businessConfig } from '@config'

/** Format a UTC ISO string for display in the business timezone. */
export function formatInBusinessTz(isoString: string, fmt = 'MMM d, yyyy h:mm a') {
  const utcDate = parseISO(isoString)
  const zoned = toZonedTime(utcDate, businessConfig.timezone)
  return format(zoned, fmt)
}

/** Format date only */
export function formatDateInBusinessTz(isoString: string) {
  return formatInBusinessTz(isoString, 'MMM d, yyyy')
}

/** Format time only */
export function formatTimeInBusinessTz(isoString: string) {
  return formatInBusinessTz(isoString, 'h:mm a')
}

/** Replace template placeholders: {{key}} → value */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/** Generate a Google Calendar add link from appointment details */
export function buildCalendarLink(params: {
  title: string
  start: string
  durationMinutes: number
  description?: string
  location?: string
}) {
  const start = params.start.replace(/[-:]/g, '').replace('.000Z', 'Z')
  const endDate = new Date(params.start)
  endDate.setMinutes(endDate.getMinutes() + params.durationMinutes)
  const end = endDate.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z')

  const qs = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${start}/${end}`,
    details: params.description ?? '',
    location: params.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${qs.toString()}`
}

/** Idempotency key for a specific message type + appointment/client */
export function makeIdempotencyKey(
  messageType: string,
  entityId: string,
  channel: string
): string {
  return `${messageType}:${entityId}:${channel}`
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
