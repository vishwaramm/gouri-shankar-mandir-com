import { useMemo, useState } from 'react'
import {
  samskaras,
  serviceCards,
  serviceCategories,
  serviceDetails,
  serviceOptions,
} from '../content.js'
import { createServiceRequest } from '../lib/siteApi.js'

function ServicesPage() {
  const [serviceCategory, setServiceCategory] = useState('All')
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceRequest, setServiceRequest] = useState({
    service: 'Virtual Pooja',
    name: '',
    email: '',
    date: '',
    note: '',
  })
  const [requestStatus, setRequestStatus] = useState('Share when ready.')

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase()

    return serviceCards.filter((card) => {
      const categoryMatch = serviceCategory === 'All' || card.category === serviceCategory
      const queryMatch =
        !query ||
        card.title.toLowerCase().includes(query) ||
        card.body.toLowerCase().includes(query) ||
        card.keywords.some((keyword) => keyword.includes(query))

      return categoryMatch && queryMatch
    })
  }, [serviceCategory, serviceQuery])

  const handleServiceRequestChange = (event) => {
    const { name, value } = event.target
    setServiceRequest((current) => ({ ...current, [name]: value }))
  }

  const handleServiceRequestSubmit = (event) => {
    event.preventDefault()
    const payload = {
      ...serviceRequest,
    }

    if (!payload.name || !payload.email || !payload.note) return

    createServiceRequest(payload)
      .then((result) => {
        setRequestStatus(
          result.emailed === false
            ? result.mailStatus === 'missing_smtp'
              ? 'Saved. Mail delivery is not configured.'
              : result.mailError
                ? `Saved. Mail delivery failed: ${result.mailError}`
                : 'Saved. Mail delivery failed.'
            : 'Sent.',
        )
        setServiceRequest({
          service: 'Virtual Pooja',
          name: '',
          email: '',
          date: '',
          note: '',
        })
      })
      .catch(() => {
        setRequestStatus('Unable to send right now.')
      })
  }

  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.2), rgba(10, 8, 7, 0.8)), url("/images/two-priests-conversation-full.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-5">
            <div className="col-lg-8 col-xl-7">
              <div className="reveal">
                <p className="section-kicker text-white">Services</p>
                <h1 className="hero-title text-white">Sacred services.</h1>
                <p className="hero-lede mt-4">Pooja, yagnas, astrology, meditation, counseling, and samskaras.</p>
                <div className="chip-cloud mt-4">
                  <span className="stack-chip">Virtual pooja</span>
                  <span className="stack-chip">Yagnas</span>
                  <span className="stack-chip">Astrology</span>
                  <span className="stack-chip">Samskaras</span>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="surface surface-strong surface-pad reveal delay-1">
                <p className="section-kicker">Pathways</p>
                <h2 className="h3 mb-3">Ritual, guidance, and support.</h2>
                <p className="section-intro mb-0">Ritual, guidance, and support for the occasion.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="surface surface-pad mb-4">
            <div className="row g-4 align-items-end">
              <div className="col-lg-5">
                <p className="section-kicker">Services</p>
                <h2 className="section-title mb-0">Service paths.</h2>
              </div>
              <div className="col-lg-7">
                <div className="filter-dock justify-content-lg-end">
                  {serviceCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={
                        serviceCategory === category
                          ? 'btn btn-primary'
                          : 'btn btn-outline-primary'
                      }
                      onClick={() => setServiceCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                  <input
                    className="form-control"
                    type="search"
                    value={serviceQuery}
                    onChange={(event) => setServiceQuery(event.target.value)}
                    placeholder="Search rites or guidance"
                    style={{ maxWidth: '22rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="service-grid mb-5">
            {filteredServices.map((card, index) => (
              <article className="service-tile reveal" key={card.title} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="service-meta">
                  <span>{card.category}</span>
                  <span>{card.keywords[0]}</span>
                </div>
                <h3 className="h4">{card.title}</h3>
                <p>{card.body}</p>
                <p className="mt-3 text-secondary">
                  For family observance, festival timing, personal guidance, and temple participation.
                </p>
              </article>
            ))}
          </div>

          <div className="row g-4 align-items-stretch mb-5">
            <div className="col-lg-5">
              <div className="surface surface-pad h-100">
                <div className="image-frame mb-4">
                  <img
                    src="/images/hindu-priests-yajna.jpg"
                    alt="Peaceful ritual items arranged in a calm setting"
                  />
                </div>
                <p className="section-kicker">Samskaras</p>
                <h2 className="section-title mb-3">Sixteen rites of passage.</h2>
                <p className="section-intro mb-4">Virtual planning and priestly support for every major rite of passage.</p>
                <div className="chip-cloud">
                  {samskaras.map((item) => (
                    <span key={item} className="stack-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="surface surface-strong surface-pad h-100">
                <p className="section-kicker">Astrology</p>
                <h2 className="section-title mb-3">Chart reading and ongoing guidance.</h2>
                <p className="section-intro mb-4">The temple supports single readings, periodic review, and membership-based guidance.</p>
                <div className="story-grid">
                  <article className="story-item">
                    <strong>01</strong>
                    <h3 className="h4">Single reading</h3>
                    <p>Review a chart once for timing, relationships, remedies, or questions.</p>
                  </article>
                  <article className="story-item">
                    <strong>02</strong>
                    <h3 className="h4">Membership</h3>
                    <p>Ongoing astrology guidance with periodic review.</p>
                  </article>
                  <article className="story-item">
                    <strong>03</strong>
                    <h3 className="h4">Guided follow-through</h3>
                    <p>Clear next steps keep the reading grounded in daily life and ritual practice.</p>
                  </article>
                  <article className="story-item">
                    <strong>04</strong>
                    <h3 className="h4">Practical remedies</h3>
                    <p>Support is framed to help families respond thoughtfully and consistently.</p>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div className="surface surface-pad mb-5">
            <div className="row g-4">
              <div className="col-lg-4">
                <p className="section-kicker">Request</p>
                <h2 className="section-title mb-3">Bring your request.</h2>
                <p className="section-intro mb-0">Share the rite, date, or guidance you have in mind.</p>
              </div>

              <div className="col-lg-8">
                <form className="row g-3" onSubmit={handleServiceRequestSubmit}>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Service</label>
                    <select
                      name="service"
                      className="form-select"
                      value={serviceRequest.service}
                      onChange={handleServiceRequestChange}
                    >
                      {serviceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Name</label>
                    <input
                      name="name"
                      className="form-control"
                      value={serviceRequest.name}
                      onChange={handleServiceRequestChange}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Email</label>
                    <input
                      name="email"
                      type="email"
                      className="form-control"
                      value={serviceRequest.email}
                      onChange={handleServiceRequestChange}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Preferred Date</label>
                    <input
                      name="date"
                      type="date"
                      className="form-control"
                      value={serviceRequest.date}
                      onChange={handleServiceRequestChange}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-primary-emphasis">Intention</label>
                    <textarea
                      name="note"
                      className="form-control"
                      value={serviceRequest.note}
                      onChange={handleServiceRequestChange}
                      placeholder="Share the occasion, deity, chart topic, or prayer intention."
                      rows="4"
                      required
                    />
                  </div>
                  <div className="col-12 d-flex flex-wrap align-items-center gap-3">
                    <button type="submit" className="btn btn-primary btn-lg rounded-pill px-4">
                      Submit request
                    </button>
                    <p className={`mb-0 text-secondary ${requestStatus !== 'Share when ready.' ? 'fw-semibold' : ''}`}>
                      {requestStatus}
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="row g-4">
            {serviceDetails.map((service, index) => (
              <div className="col-md-6 col-xl-3" key={service.title}>
                <article className="metric-tile reveal" style={{ animationDelay: `${index * 80}ms` }}>
                  <span className="metric-number">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="h5">{service.title}</h3>
                  <p>{service.detail}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default ServicesPage
