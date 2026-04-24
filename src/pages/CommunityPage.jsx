import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  communityItems,
  communityPillars,
  membershipPlans,
} from '../content.js'
import { buildCalendarEventDetails } from '../lib/calendar.js'
import { createRsvp, loadCommunityEvents, loadCurrentUser, loadUserRsvps } from '../lib/siteApi.js'
import { createSubmissionKey, isRetryableSubmissionError, queuePendingSubmission } from '../lib/offlineQueue.js'

function formatEventDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildGoogleMapsLink(event) {
  if (event.mapsUrl) return event.mapsUrl
  if (!event.address) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`
}

function normalizeSearchText(value = '') {
  return String(value || '').toLowerCase().trim()
}

function CommunityPage() {
  const navigate = useNavigate()
  const [rsvpStatus, setRsvpStatus] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [userRsvps, setUserRsvps] = useState([])
  const [rsvpBusyById, setRsvpBusyById] = useState({})
  const [rsvpStatusById, setRsvpStatusById] = useState({})
  const [communityEvents, setCommunityEvents] = useState([])
  const [calendarBusyById, setCalendarBusyById] = useState({})
  const [calendarStatusById, setCalendarStatusById] = useState({})
  const [communityQuery, setCommunityQuery] = useState('')
  const [communityFilter, setCommunityFilter] = useState('all')
  const rsvpSubmitLockRef = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    loadCurrentUser()
      .then((result) => {
        if (cancelled) return
        setCurrentUser(result?.authenticated ? result.user || null : null)
      })
      .catch(() => {
        if (cancelled) return
        setCurrentUser(null)
      })
    loadCommunityEvents()
      .then((result) => {
        if (cancelled) return
        setCommunityEvents(Array.isArray(result.communityEvents) ? result.communityEvents : [])
      })
      .catch(() => {
        if (cancelled) return
        setCommunityEvents([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!currentUser) {
      setUserRsvps([])
      return () => {
        cancelled = true
      }
    }

    loadUserRsvps()
      .then((result) => {
        if (cancelled) return
        setUserRsvps(Array.isArray(result.rsvps) ? result.rsvps : [])
      })
      .catch(() => {
        if (cancelled) return
        setUserRsvps([])
      })

    return () => {
      cancelled = true
    }
  }, [currentUser])

  const userRsvpsByEventId = useMemo(() => {
    return new Map(userRsvps.map((item) => [item.eventId, item]))
  }, [userRsvps])

  const handleRsvp = async (event) => {
    if (!currentUser) {
      setRsvpStatus('Log in to save an RSVP to your account.')
      navigate('/login')
      return
    }

    if (rsvpSubmitLockRef.current.has(event.id)) return
    rsvpSubmitLockRef.current.add(event.id)

    const submissionKey = createSubmissionKey('rsvp')
    const payload = {
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.eventDate || '',
      section: event.section,
      kind: event.kind,
      guestCount: 1,
      reminderOptIn: currentUser.notificationPrefs?.eventReminders !== false,
      location: event.location || '',
      mapsUrl: event.mapsUrl || '',
      submissionKey,
    }

    setRsvpBusyById((current) => ({ ...current, [event.id]: true }))
    setRsvpStatusById((current) => ({ ...current, [event.id]: '' }))

    try {
      const result = await createRsvp(payload)

      if (result?.entry) {
        setUserRsvps((current) => {
          const filtered = current.filter((item) => item.eventId !== result.entry.eventId)
          filtered.unshift(result.entry)
          return filtered
        })
      }

      setRsvpStatusById((current) => ({
        ...current,
        [event.id]: result?.message || 'RSVP saved.',
      }))
      setRsvpStatus(result?.message || 'RSVP saved.')
    } catch (error) {
      if (isRetryableSubmissionError(error)) {
        queuePendingSubmission({
          kind: 'rsvp',
          submissionKey,
          payload,
          label: 'Event RSVP',
        })
        const message = 'Saved offline. It will sync when the connection returns.'
        setRsvpStatusById((current) => ({
          ...current,
          [event.id]: message,
        }))
        setRsvpStatus(message)
        return
      }

      const message = error?.message || 'Unable to save right now.'
      setRsvpStatusById((current) => ({
        ...current,
        [event.id]: message,
      }))
      setRsvpStatus(message)
    } finally {
      rsvpSubmitLockRef.current.delete(event.id)
      setRsvpBusyById((current) => ({ ...current, [event.id]: false }))
    }
  }

  const communityEventCards = useMemo(
    () =>
      communityEvents.map((event) => ({
        id: event.id,
        title: event.title || '',
        time: event.kind === 'ad-hoc' ? formatEventDate(event.eventDate) : event.scheduleLabel || 'Recurring',
        eventDate: event.eventDate || '',
        detail: event.detail,
        location: event.inPerson ? event.address || 'In person' : 'Virtual',
        mapsUrl: buildGoogleMapsLink(event),
        section: event.section || 'events',
        kind: event.kind || 'recurring',
      })),
    [communityEvents],
  )

  const filteredCommunityEventCards = useMemo(() => {
    const query = normalizeSearchText(communityQuery)
    return communityEventCards.filter((event) => {
      if (communityFilter === 'events' && event.section !== 'events') return false
      if (communityFilter === 'observances' && event.section !== 'observances') return false
      if (!query) return true

      const haystack = [event.title, event.detail, event.time, event.location, event.section, event.kind]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [communityEventCards, communityFilter, communityQuery])

  const eventsSectionItems = useMemo(() => {
    return filteredCommunityEventCards
      .filter((event) => event.section === 'events')
      .map((event) => ({
        title: event.title,
        time: event.time,
        eventDate: event.eventDate,
        detail: event.detail,
        location: event.location,
        mapsUrl: event.mapsUrl,
        dynamic: true,
        kind: event.kind,
      }))
  }, [filteredCommunityEventCards])

  const observanceItems = useMemo(() => {
    return filteredCommunityEventCards
      .filter((event) => event.section === 'observances')
      .map((event) => ({
        date: event.time,
        eventDate: event.eventDate,
        title: event.title,
        note: event.detail,
        location: event.location,
        mapsUrl: event.mapsUrl,
        dynamic: true,
      }))
  }, [filteredCommunityEventCards])

  const handleAddToCalendar = async (event) => {
    const calendarEvent = buildCalendarEventDetails({
      title: event.title,
      detail: event.detail,
      location: event.location,
      mapsUrl: event.mapsUrl,
      eventDate: event.eventDate,
    })

    if (!calendarEvent) {
      setCalendarStatusById((current) => ({
        ...current,
        [event.id]: 'Calendar sync is only available for dated events.',
      }))
      return
    }

    setCalendarBusyById((current) => ({ ...current, [event.id]: true }))
    setCalendarStatusById((current) => ({ ...current, [event.id]: '' }))

    try {
      const blob = new Blob([calendarEvent.icsContent], { type: 'text/calendar;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = calendarEvent.icsFileName
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      setCalendarStatusById((current) => ({
        ...current,
        [event.id]: 'Calendar file ready.',
      }))
    } catch (error) {
      setCalendarStatusById((current) => ({
        ...current,
        [event.id]: error?.message || 'Unable to prepare the calendar file.',
      }))
    } finally {
      setCalendarBusyById((current) => ({ ...current, [event.id]: false }))
    }
  }

  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.18), rgba(10, 8, 7, 0.82)), url("/images/community-hero.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-5">
            <div className="col-lg-7">
              <div className="reveal">
                <p className="section-kicker text-white">Community</p>
                <h1 className="hero-title text-white">Satsang and gathering.</h1>
                <p className="hero-lede mt-4">Observances, membership, and shared practice.</p>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="surface surface-strong surface-pad reveal delay-1">
                <div className="image-frame mb-4">
                  <img
                    src="/images/community-hero.jpg"
                    alt="A calm gathering space with soft blue light"
                  />
                </div>
                <p className="section-kicker">Gathering</p>
                <h2 className="h3 mb-3">Regular touchpoints for devotion and learning.</h2>
                <p className="section-intro mb-0">A calm gathering place for prayer and satsang.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-4">
              <article className="surface surface-pad h-100">
                <p className="section-kicker">Community</p>
                <h2 className="section-title mb-3">Ways to participate.</h2>
                <div className="timeline-list">
                  {communityItems.map((item, index) => (
                    <div className="timeline-item" key={item}>
                      <time>0{index + 1}</time>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className="col-lg-4">
              <article className="surface surface-strong surface-pad h-100">
                <p className="section-kicker">Astrological calendar</p>
                <h2 className="section-title mb-3">Observances.</h2>
                {observanceItems.length ? (
                  <div className="timeline-list">
                    {observanceItems.map((item) => (
                      <div className="timeline-item" key={`${item.title}-${item.date || item.time}`}>
                        <time>{item.date || item.time}</time>
                        <div>
                          <h3 className="h5 mb-1">{item.title}</h3>
                          <p>{item.note || item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="surface surface-soft surface-pad">No observances at this time.</div>
                )}
              </article>
            </div>

            <div className="col-lg-4">
              <article className="surface surface-pad h-100">
                <p className="section-kicker">Membership</p>
                <h2 className="section-title mb-3">Paths of belonging.</h2>
                <div className="timeline-list">
                  {membershipPlans.map((plan, index) => (
                    <div className="timeline-item" key={plan.title}>
                      <time>0{index + 1}</time>
                      <div>
                        <h3 className="h5 mb-1">{plan.title}</h3>
                        <p>{plan.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className="surface surface-strong surface-pad mt-4">
            <div className="row g-4 align-items-start">
              <div className="col-lg-5">
                <p className="section-kicker">Pillars</p>
                <h2 className="section-title mb-3">Shared practice.</h2>
                <p className="section-intro mb-0">Recurring gatherings and membership for the mandir.</p>
              </div>
              <div className="col-lg-7">
                <div className="story-grid">
                  {communityPillars.map((pillar, index) => (
                    <article className="story-item" key={pillar}>
                      <strong>0{index + 1}</strong>
                      <h3 className="h4">Pillar {index + 1}</h3>
                      <p>{pillar}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="surface surface-pad mt-4">
            <div className="row g-3 align-items-end mb-3">
              <div className="col-lg-7">
                <p className="section-kicker mb-2">Search</p>
                <h2 className="h4 mb-0">Filter gatherings and observances.</h2>
              </div>
              <div className="col-lg-5">
                <input
                  type="search"
                  className="form-control"
                  value={communityQuery}
                  onChange={(event) => setCommunityQuery(event.target.value)}
                  placeholder="Search events, observances, or dates"
                />
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 mb-4">
              {[
                { id: 'all', label: 'All' },
                { id: 'events', label: 'Community events' },
                { id: 'observances', label: 'Observances' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={communityFilter === item.id ? 'btn btn-primary btn-sm rounded-pill' : 'btn btn-outline-light btn-sm rounded-pill'}
                  onClick={() => setCommunityFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3 mb-4">
              <div>
                <p className="section-kicker">Events</p>
                <h2 className="section-title mb-0">Community events.</h2>
              </div>
              <div className="d-flex flex-column align-items-lg-end gap-2">
                <p className="section-intro mb-0">Gatherings and announcements from the mandir.</p>
                {currentUser ? (
                  <div className="small text-secondary text-lg-end">
                    Signed in as {currentUser.name || currentUser.email || 'member'} · {userRsvps.length} RSVP
                    {userRsvps.length === 1 ? '' : 's'} saved
                  </div>
                ) : (
                  <div className="small text-secondary text-lg-end">Log in to save RSVPs to your account.</div>
                )}
              </div>
            </div>

            {eventsSectionItems.length ? (
              <div className="timeline-list">
                {eventsSectionItems.map((event, index) => (
                  <article
                    className="event-row surface-soft surface-pad reveal"
                    key={`${event.title}-${event.time}-${index}`}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="row g-3 align-items-center">
                      <div className="col-lg-3">
                        <span className="metric-label">{event.time}</span>
                        <h3 className="h4 mb-0">{event.title}</h3>
                      </div>
                      <div className="col-lg-6">
                        <p className="mb-0">{event.detail}</p>
                        {event.location ? (
                          <a
                            className="d-inline-block mt-2 small text-secondary text-break"
                            href={event.mapsUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(clickEvent) => {
                              if (!event.mapsUrl) {
                                clickEvent.preventDefault()
                              }
                            }}
                          >
                            {event.location}
                          </a>
                        ) : null}
                      </div>
                      <div className="col-lg-3 text-lg-end">
                        {currentUser ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary rounded-pill"
                            onClick={() => handleRsvp(event)}
                            disabled={Boolean(rsvpBusyById[event.id])}
                          >
                            {rsvpBusyById[event.id]
                              ? 'Saving...'
                              : userRsvpsByEventId.has(event.id)
                                ? 'Update RSVP'
                                : 'RSVP'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-primary rounded-pill"
                            onClick={() => navigate('/login')}
                          >
                            Log in to RSVP
                          </button>
                        )}
                        {event.eventDate ? (
                          <div className="d-flex flex-wrap justify-content-lg-end gap-2 mt-2">
                            <a
                              className="btn btn-outline-light btn-sm rounded-pill"
                              href={buildCalendarEventDetails(event)?.googleCalendarUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(clickEvent) => {
                                if (!buildCalendarEventDetails(event)?.googleCalendarUrl) {
                                  clickEvent.preventDefault()
                                }
                              }}
                            >
                              Google Calendar
                            </a>
                            <button
                              type="button"
                              className="btn btn-outline-light btn-sm rounded-pill"
                              onClick={() => handleAddToCalendar(event)}
                              disabled={Boolean(calendarBusyById[event.id])}
                            >
                              {calendarBusyById[event.id] ? 'Preparing...' : 'Apple Calendar'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {rsvpStatusById[event.id] ? <div className="small text-secondary mt-2">{rsvpStatusById[event.id]}</div> : null}
                    {calendarStatusById[event.id] ? <div className="small text-secondary mt-1">{calendarStatusById[event.id]}</div> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="surface surface-soft surface-pad">No events at this time.</div>
            )}
            {rsvpStatus ? <p className="mt-4 mb-0 text-secondary">{rsvpStatus}</p> : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default CommunityPage
