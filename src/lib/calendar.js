function formatDateOnly(value) {
  if (!value) return ''
  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function escapeCalendarText(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildCalendarEventDetails(event = {}) {
  const title = String(event.title || event.eventTitle || 'Community event').trim()
  const description = String(event.detail || event.description || '').trim()
  const location = String(event.location || '').trim()
  const mapsUrl = String(event.mapsUrl || '').trim()
  const date = String(event.eventDate || '').trim()
  const dateCode = formatDateOnly(date)

  if (!dateCode) return null

  const nextDate = new Date(`${date}T12:00:00`)
  if (Number.isNaN(nextDate.getTime())) return null
  nextDate.setDate(nextDate.getDate() + 1)
  const nextDateCode = `${nextDate.getFullYear()}${String(nextDate.getMonth() + 1).padStart(2, '0')}${String(nextDate.getDate()).padStart(2, '0')}`

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dateCode}/${nextDateCode}`,
    details: [description, mapsUrl ? `Map: ${mapsUrl}` : ''].filter(Boolean).join('\n'),
    location,
  })

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?${query.toString()}`
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gourishankar Mandir//Community Event//EN',
    'BEGIN:VEVENT',
    `UID:${`${title}-${dateCode}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART;VALUE=DATE:${dateCode}`,
    `DTEND;VALUE=DATE:${nextDateCode}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    description ? `DESCRIPTION:${escapeCalendarText([description, mapsUrl ? `Map: ${mapsUrl}` : ''].filter(Boolean).join('\n'))}` : '',
    location ? `LOCATION:${escapeCalendarText(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  const icsContent = `${icsLines.join('\r\n')}\r\n`

  return {
    title,
    dateCode,
    googleCalendarUrl,
    icsContent,
    icsFileName: `${dateCode}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'community-event'}.ics`,
  }
}
