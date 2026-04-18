import { useState } from 'react'
import {
  communityItems,
  communityPillars,
  eventSchedule,
  festivalSchedule,
  membershipPlans,
} from '../content.js'
import { createRsvp } from '../lib/siteApi.js'

function CommunityPage() {
  const [rsvpStatus, setRsvpStatus] = useState('')

  const handleRsvp = (eventLabel) => {
    createRsvp(eventLabel)
      .then(() => {
        setRsvpStatus('Noted.')
      })
      .catch(() => {
        setRsvpStatus('Unable to save right now.')
      })
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
                <p className="section-kicker">Observances</p>
                <h2 className="section-title mb-3">Upcoming gatherings.</h2>
                <div className="timeline-list">
                  {festivalSchedule.map((item) => (
                    <div className="timeline-item" key={item.title}>
                      <time>{item.date}</time>
                      <div>
                        <h3 className="h5 mb-1">{item.title}</h3>
                        <p>{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
                <h2 className="section-title mb-0">Upcoming gatherings.</h2>
              </div>
              <p className="section-intro mb-0">Each event marks a gathering point.</p>
            </div>

            <div className="timeline-list">
              {eventSchedule.map((event, index) => (
                <article className="event-row surface-soft surface-pad reveal" key={event.title} style={{ animationDelay: `${index * 90}ms` }}>
                  <div className="row g-3 align-items-center">
                    <div className="col-lg-3">
                      <span className="metric-label">{event.time}</span>
                      <h3 className="h4 mb-0">{event.title}</h3>
                    </div>
                    <div className="col-lg-6">
                      <p className="mb-0">{event.detail}</p>
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
            {rsvpStatus ? <p className="mt-4 mb-0 text-secondary">{rsvpStatus}</p> : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default CommunityPage
