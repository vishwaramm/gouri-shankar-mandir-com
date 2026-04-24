import { useEffect, useMemo, useState } from 'react'
import {
  communityItems,
  communityPillars,
  membershipPlans,
} from '../content.js'
import { createRsvp, loadCommunityEvents } from '../lib/siteApi.js'

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

function CommunityPage() {
  const [rsvpStatus, setRsvpStatus] = useState('')
  const [communityEvents, setCommunityEvents] = useState([])

  useEffect(() => {
    let cancelled = false
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

  const handleRsvp = (eventLabel) => {
    createRsvp(eventLabel)
      .then(() => {
        setRsvpStatus('Noted.')
      })
      .catch(() => {
        setRsvpStatus('Unable to save right now.')
      })
  }

  const communityEventCards = useMemo(
    () =>
      communityEvents.map((event) => ({
        id: event.id,
        title: event.title || '',
        time: event.kind === 'ad-hoc' ? formatEventDate(event.eventDate) : event.scheduleLabel || 'Recurring',
        detail: event.detail,
        location: event.inPerson ? event.address || 'In person' : 'Virtual',
        mapsUrl: buildGoogleMapsLink(event),
        section: event.section || 'events',
        kind: event.kind || 'recurring',
      })),
    [communityEvents],
  )

  const eventsSectionItems = useMemo(() => {
    return communityEventCards
      .filter((event) => event.section === 'events')
      .map((event) => ({
        title: event.title,
        time: event.time,
        detail: event.detail,
        location: event.location,
        mapsUrl: event.mapsUrl,
        dynamic: true,
        kind: event.kind,
      }))
  }, [communityEventCards])

  const observanceItems = useMemo(() => {
    return communityEventCards
      .filter((event) => event.section === 'observances')
      .map((event) => ({
        date: event.time,
        title: event.title,
        note: event.detail,
        location: event.location,
        mapsUrl: event.mapsUrl,
        dynamic: true,
      }))
  }, [communityEventCards])

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
            <div className="d-flex flex-column flex-lg-row align-items-lg-end justify-content-between gap-3 mb-4">
              <div>
                <p className="section-kicker">Events</p>
                <h2 className="section-title mb-0">Community events.</h2>
              </div>
              <p className="section-intro mb-0">Gatherings and announcements from the mandir.</p>
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
                        <button
                          type="button"
                          className="btn btn-outline-primary rounded-pill"
                          onClick={() => handleRsvp(`${event.time} · ${event.title}`)}
                        >
                          Mark interest
                        </button>
                      </div>
                    </div>
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
