import type { Session } from './types'

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toUtcBasic(d: Date): string {
  return (
    d.getUTCFullYear().toString().padStart(4, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    'T' +
    String(d.getUTCHours()).padStart(2, '0') +
    String(d.getUTCMinutes()).padStart(2, '0') +
    String(d.getUTCSeconds()).padStart(2, '0') +
    'Z'
  )
}

function eventTimes(session: Session): { start: Date; end: Date } {
  const start = new Date(session.starts_at)
  const durationMin = session.duration_minutes > 0 ? session.duration_minutes : 60
  return { start, end: new Date(start.getTime() + durationMin * 60_000) }
}

export function buildIcs(session: Session, domain = 'english-workshop.app'): string {
  const { start, end } = eventTimes(session)
  const location = session.meeting_link || session.location || ''
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${session.id}@${domain}`,
    `DTSTAMP:${toUtcBasic(new Date())}`,
    `DTSTART:${toUtcBasic(start)}`,
    `DTEND:${toUtcBasic(end)}`,
    `SUMMARY:${icsEscape(session.title)}`,
    `DESCRIPTION:${icsEscape(session.description ?? '')}`,
    `LOCATION:${icsEscape(location)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

export function downloadIcs(session: Session): void {
  const blob = new Blob([buildIcs(session)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.title.replace(/[^\w-]+/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function googleCalendarUrl(session: Session): string {
  const { start, end } = eventTimes(session)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: session.description ?? '',
    location: session.meeting_link || session.location || ''
  })
  // Note: only works for a signed-in Google user; there is no server-side
  // confirmation the event was actually added.
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
