import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  samskaras,
  serviceBookingSteps,
  serviceCategories,
  serviceOfferings,
  serviceOptions,
} from '../content.js'
import { createServiceRequest } from '../lib/siteApi.js'

const serviceFaqItems = [
  {
    question: 'Is the request form free?',
    answer:
      'Yes. The inquiry itself is free. The service contribution is confirmed after the priests review the request and determine the rite, timing, and support needed.',
  },
  {
    question: 'Do I pay just for emailing the priests?',
    answer:
      'No. Emailing the priests is part of the review and coordination flow. The charge is for the actual service, the priest time, preparation, and follow-up.',
  },
  {
    question: 'Is the contribution fixed or flexible?',
    answer:
      'Some services have a suggested contribution range. Larger rites, travel, or custom ceremonies are quoted separately.',
  },
  {
    question: 'Can virtual and in-person services both be arranged?',
    answer:
      'Yes. The mandir can coordinate virtual participation, temple-led rites, or guided preparation depending on the service and occasion.',
  },
]

const initialRequest = {
  service: serviceOptions[0],
  name: '',
  email: '',
  phone: '',
  date: '',
  note: '',
}

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Custom quote'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function ServicesPage() {
  const navigate = useNavigate()
  const [serviceCategory, setServiceCategory] = useState('All')
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceRequest, setServiceRequest] = useState(initialRequest)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestStatus, setRequestStatus] = useState(
    'Free inquiry. Contribution is confirmed after priest review.',
  )

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase()

    return serviceOfferings.filter((card) => {
      const categoryMatch = serviceCategory === 'All' || card.category === serviceCategory
      const queryMatch =
        !query ||
        card.title.toLowerCase().includes(query) ||
        card.body.toLowerCase().includes(query) ||
        card.includes.some((item) => item.toLowerCase().includes(query)) ||
        card.contribution.toLowerCase().includes(query) ||
        card.timing.toLowerCase().includes(query) ||
        card.delivery.toLowerCase().includes(query) ||
        card.keywords.some((keyword) => keyword.includes(query))

      return categoryMatch && queryMatch
    })
  }, [serviceCategory, serviceQuery])

  const handleServiceRequestChange = (event) => {
    const { name, value } = event.target
    setServiceRequest((current) => ({ ...current, [name]: value }))
  }

  const openRequestModal = (service) => {
    setServiceRequest((current) => ({ ...current, service }))
    setRequestStatus(`Selected ${service}.`)
    setRequestModalOpen(true)
  }

  const openPaymentsPage = (service, amountCents) => {
    const params = new URLSearchParams({
      service,
      amount: String(amountCents),
    })

    navigate(`/payments?${params.toString()}`)
  }

  const closeRequestModal = () => {
    setRequestModalOpen(false)
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
              ? 'Saved. Mail delivery is not configured yet, but the request was recorded.'
              : result.mailError
                ? `Saved. Mail delivery failed: ${result.mailError}`
                : 'Saved. Mail delivery failed.'
            : 'Received. We will confirm the contribution and timing by email.',
        )
        setServiceRequest(initialRequest)
      })
      .catch(() => {
        setRequestStatus('Unable to send right now.')
      })
  }

  useEffect(() => {
    if (!requestModalOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeRequestModal()
      }
    }

    document.body.classList.add('modal-open')
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [requestModalOpen])

  return (
    <main>
      <section
        className="hero-shell section-shell services-hero"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.18), rgba(10, 8, 7, 0.84)), url("/images/two-priests-conversation-full.jpg")',
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
                <p className="hero-lede mt-4">Prayer, guidance, and rites for household observance.</p>
                <div className="d-flex flex-wrap gap-3 mt-4">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg rounded-pill px-4"
                    onClick={() =>
                      document.getElementById('service-discovery')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    Donate now
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-lg rounded-pill px-4"
                    onClick={() => openRequestModal(serviceRequest.service)}
                  >
                    Start a request
                  </button>
                </div>
                <p className="hero-lede mt-3 mb-0">
                  Browse the service cards below to see suggested contributions and donate directly.
                </p>
                <div className="chip-cloud mt-4">
                  <span className="stack-chip">Virtual pooja</span>
                  <span className="stack-chip">Yagnas</span>
                  <span className="stack-chip">Astrology</span>
                  <span className="stack-chip">Samskaras</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-3 py-lg-4">
        <div className="container-xxl">
          <div className="surface surface-pad mb-0">
            <div className="row g-4 align-items-end mb-3">
              <div className="col-lg-5">
                <p className="section-kicker">How it works</p>
                <h2 className="section-title mb-0">A simple path from request to service.</h2>
              </div>
              <div className="col-lg-7">
                <p className="section-intro mb-0">
                  Choose a service, share the intention, and the priests review the request before the
                  contribution is confirmed.
                </p>
              </div>
            </div>
            <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-4">
              {serviceBookingSteps.map((step, index) => (
                <div className="col" key={step.title}>
                  <article className="card h-100 shadow-sm border-secondary-subtle">
                    <div className="card-body d-flex flex-column gap-3">
                      <div className="d-flex align-items-center justify-content-between gap-3">
                        <span className="badge rounded-pill text-bg-primary px-3 py-2">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-uppercase small text-muted fw-semibold">Step</span>
                      </div>
                      <div>
                        <h3 className="h5 card-title mb-2">{step.title}</h3>
                        <p className="card-text text-muted mb-0">{step.detail}</p>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell py-3 py-lg-4" id="service-discovery">
        <div className="container-xxl">
          <div className="surface surface-pad mb-4">
            <div className="row g-4 align-items-end">
              <div className="col-lg-5">
                <p className="section-kicker">Discover</p>
                <h2 className="section-title mb-0">Find the right service path.</h2>
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
                    placeholder="Search rite, guidance, or follow-up"
                    style={{ maxWidth: '22rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="service-grid mb-4">
            {filteredServices.map((card, index) => (
              <article
                className="service-tile reveal"
                key={card.title}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="service-meta">
                  <span>{card.category}</span>
                  <span>{card.delivery}</span>
                </div>
                <h3 className="h4">{card.title}</h3>
                <div className="service-price-band">
                  <span className="service-price-label">Suggested contribution</span>
                  <strong className="service-price-figure">{formatMoney(card.contributionAmountCents)}</strong>
                  <span className="service-price-copy">{card.contribution}</span>
                </div>
                <p>{card.body}</p>
                <ul className="service-point-list">
                  {card.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                  <div className="service-tile-footer">
                  <div className="service-tile-actions">
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill"
                      onClick={() => {
                        if (card.contributionAmountCents) {
                          openPaymentsPage(card.title, card.contributionAmountCents)
                          return
                        }

                        openRequestModal(card.title)
                      }}
                    >
                      {card.contributionAmountCents ? 'Donate now' : 'Request quote'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary rounded-pill"
                      onClick={() => openRequestModal(card.title)}
                    >
                      Use this service
                    </button>
                  </div>
                  <p className="service-timing">{card.timing}</p>
                </div>
              </article>
            ))}
          </div>

          {filteredServices.length === 0 ? (
            <div className="surface surface-pad mb-5">
              <p className="section-kicker">No results</p>
              <h3 className="h4 mb-2">Try a different search or category.</h3>
              <p className="mb-0 text-secondary">
                Clear the filters to bring back all services.
              </p>
            </div>
          ) : null}

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
                <p className="section-intro mb-4">
                  Virtual planning and priestly support for every major rite of passage.
                </p>
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
                <p className="section-intro mb-4">
                  Choose a single reading, review a recurring membership, or request practical follow-up.
                </p>
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

          <div className="surface surface-strong surface-pad">
            <div className="row g-4 align-items-start">
              <div className="col-lg-4">
                <p className="section-kicker">FAQ</p>
                <h2 className="section-title mb-3">Common booking questions.</h2>
                <p className="section-intro mb-0">
                  A little clarity here keeps the request flow calm and direct.
                </p>
              </div>
              <div className="col-lg-8">
                <div className="faq-stack">
                  {serviceFaqItems.map((item, index) => {
                    return (
                      <details className="faq-item" key={item.question} open={index === 0}>
                        <summary>{item.question}</summary>
                        <div className="faq-body">{item.answer}</div>
                      </details>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {requestModalOpen ? (
        <div
          className="request-modal-backdrop"
          role="presentation"
          onClick={closeRequestModal}
        >
          <div
            className="request-modal surface surface-strong"
            role="dialog"
            aria-modal="true"
            aria-labelledby="serviceRequestDialogTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="request-modal-header">
              <div>
                <p className="section-kicker">Request form</p>
                <h2 id="serviceRequestDialogTitle" className="h3 mb-2">
                  Request {serviceRequest.service}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary rounded-pill request-modal-close"
                onClick={closeRequestModal}
                aria-label="Close request form"
              >
                Close
              </button>
            </div>

            <form className="row g-3 mt-1" onSubmit={handleServiceRequestSubmit}>
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
                <label className="form-label fw-semibold text-primary-emphasis">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  className="form-control"
                  value={serviceRequest.phone}
                  onChange={handleServiceRequestChange}
                  placeholder="+1 555 123 4567"
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
                  rows="5"
                  required
                />
              </div>
              <div className="col-12 d-flex flex-wrap align-items-center gap-3">
                <button type="submit" className="btn btn-primary btn-lg rounded-pill px-4">
                  Submit request
                </button>
                <p className={`mb-0 text-secondary ${requestStatus ? 'fw-semibold' : ''}`}>
                  {requestStatus}
                </p>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </main>
  )
}

export default ServicesPage
