import { NavLink, useNavigate } from 'react-router-dom'
import { createPaymentLink } from '../lib/siteApi.js'
import { serviceOfferings } from '../content.js'

const homePromisePoints = [
  {
    title: 'One clear path',
    text: 'Every request leads to an order code, a payment link, and a final completion notice.',
  },
  {
    title: 'Prayer with guidance',
    text: 'Prayer, readings, and rites of passage are matched to the occasion before payment is collected.',
  },
  {
    title: 'Built for families',
    text: 'Milestones, questions, and observances all have a clear place to begin.',
  },
]

const homeTrustPoints = [
  {
    title: 'Suggested contribution shown up front',
    text: 'You can see the amount before you commit, and adjust it higher if needed.',
  },
  {
    title: 'Order code by email',
    text: 'The order stays easy to find later through email, account history, or lookup.',
  },
  {
    title: 'Completion notice',
    text: 'You know when the priest team has finished and recorded the service.',
  },
]

const featuredServicePaths = [
  {
    title: 'Pooja - 1 to 1.75 hours',
    kicker: 'Most requested',
    summary:
      'For birthdays, anniversaries, blessings, and focused household worship when you want a calm, complete rite.',
    highlights: ['Priest review and sankalp guidance', 'Virtual service', 'Suggested contribution already shown'],
    secondaryCta: 'Browse services',
    layout: 'spotlight',
  },
  {
    title: 'Astrology Reading - General',
    kicker: 'For clarity',
    summary:
      'For timing, questions, and practical next steps when you need a thoughtful reading, not just a quick answer.',
    highlights: ['One-time reading', 'Timing guidance and remedies', 'Remote consultation'],
    secondaryCta: 'Browse services',
    layout: 'stack',
  },
  {
    title: 'Samskaras',
    kicker: 'For family milestones',
    summary:
      'For naming, marriage, and the rites of passage that deserve careful planning and support.',
    highlights: ['Custom quote', 'Family preparation', 'Temple-led or guided planning'],
    secondaryCta: 'Browse services',
    layout: 'stack',
  },
]

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Custom quote'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function HomePage() {
  const navigate = useNavigate()
  const getServiceByTitle = (title) => serviceOfferings.find((service) => service.title === title)

  const handleServiceAction = async (service) => {
    try {
      if (!service.contributionAmountCents) {
        navigate(`/services?service=${encodeURIComponent(service.title)}&request=1`)
        return
      }

      const result = await createPaymentLink({
        service: service.title,
        amountCents: service.contributionAmountCents,
      })

      if (!result.paymentLinkToken) {
        throw new Error('Unable to open the payment page.')
      }

      navigate(`/payments?token=${encodeURIComponent(result.paymentLinkToken)}`)
    } catch {
      window.alert('Unable to open the payment page right now.')
    }
  }

  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.28), rgba(10, 8, 7, 0.78)), url("/images/konark-sun-temple.jpg")',
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
                <p className="section-kicker text-white">Gourishankar Mandir</p>
                <h1 className="hero-title text-white">Sacred services, clearly guided.</h1>
                <p className="hero-lede mt-4">Choose a rite and get a clear next step.</p>
                <div className="d-flex flex-wrap gap-3 mt-4 align-items-center">
                  <NavLink className="btn btn-primary btn-lg rounded-pill px-4" to="/services">
                    See popular services
                  </NavLink>
                </div>
                <NavLink className="d-inline-block mt-3 text-white fw-semibold text-decoration-underline" to="/track-order">
                  Already have an order? Track it here.
                </NavLink>
                <div className="chip-cloud mt-4">
                  <span className="stack-chip">Free inquiry</span>
                  <span className="stack-chip">Order code by email</span>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="hero-image-rail reveal delay-1">
                <div className="hero-image-frame">
                  <img
                    src="/images/temple-hero.jpg"
                    alt="A tranquil temple scene representing virtual darshan"
                    className="hero-image"
                  />
                  <div className="hero-caption">
                    <strong>Virtual darshan</strong>
                    <span>
                      Light, stone, and stillness translated into a serene digital threshold.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block home-section section-shell">
        <div className="container-xxl">
          <div className="row align-items-end g-4 mb-4">
            <div className="col-lg-7">
              <p className="section-kicker">Why families begin here</p>
              <h2 className="section-title">Simple, reverent, and easy to follow.</h2>
            </div>
            <div className="col-lg-5">
              <p className="section-intro mb-0">
                Start with a request or a service card, then follow the order code through payment and completion.
              </p>
            </div>
          </div>

          <div className="support-grid">
            {homePromisePoints.map((item, index) => (
              <article className="support-item reveal" key={item.title} style={{ animationDelay: `${index * 100}ms` }}>
                <span className="support-index">0{index + 1}</span>
                <h3 className="h4">{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block home-section">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad">
            <div className="row g-4 align-items-start">
              <div className="col-lg-4">
              <p className="section-kicker">Why families return</p>
              <h2 className="section-title mb-3">A calmer way to begin a service.</h2>
                <p className="section-intro mb-0">
                  The flow is designed to reduce uncertainty: you see the amount, the order code, and the next step.
                </p>
              </div>
              <div className="col-lg-8">
          <div className="story-grid">
                  {homeTrustPoints.map((item, index) => (
                    <article className="story-item" key={item.title} style={{ animationDelay: `${index * 90}ms` }}>
                      <strong>{String(index + 1).padStart(2, '0')}</strong>
                      <h3 className="h4">{item.title}</h3>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            <div className="surface surface-soft surface-pad mt-4 home-trust-note">
              <p className="section-kicker mb-2">A quick trust note</p>
              <p className="h5 mb-2">Families appreciate that the order code, suggested contribution, and completion notice are all clear from the start.</p>
              <p className="mb-0 text-secondary">That clarity keeps the experience calm for first-time visitors and returning families alike.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block home-section">
        <div className="container-xxl">
          <div className="surface surface-pad">
            <div className="row align-items-end g-4 mb-4">
              <div className="col-lg-7">
                <p className="section-kicker">Most requested services</p>
                <h2 className="section-title mb-3">A curated starting point for the most common needs.</h2>
              </div>
              <div className="col-lg-5">
                <p className="section-intro mb-0">
                  If you are not sure where to begin, start here. These are the services most families choose first.
                </p>
              </div>
            </div>

            <div className="featured-service-grid">
              {featuredServicePaths.map((feature, index) => {
                const service = getServiceByTitle(feature.title)

                if (!service) return null

                const isSpotlight = feature.layout === 'spotlight'

                return (
                  <article
                    className={`${isSpotlight ? 'featured-service-panel featured-service-spotlight' : 'featured-service-panel featured-service-mini'} service-tone-${service.accentTone} reveal`}
                    key={service.title}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="featured-service-copy">
                      <p className="section-kicker mb-2">{feature.kicker}</p>
                      <h3 className={isSpotlight ? 'h2 mb-3' : 'h4 mb-3'}>{service.title}</h3>
                      <p className={isSpotlight ? 'section-intro mb-4' : 'mb-4 text-secondary'}>
                        {feature.summary} {service.bestFor ? `Ideal for ${service.bestFor}.` : ''}
                      </p>
                    </div>

                    <div className="service-price-band mb-4">
                      <span className="service-price-label">Suggested contribution</span>
                      <strong className="service-price-figure">{formatMoney(service.contributionAmountCents)}</strong>
                      <span className="service-price-copy">{service.timing}</span>
                    </div>

                    <ul className="service-point-list mb-4">
                      {feature.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
                        onClick={() => handleServiceAction(service)}
                      >
                        {service.contributionAmountCents ? 'Start this service' : 'Request quote'}
                      </button>
                      <NavLink className="btn btn-outline-light rounded-pill px-4" to="/services">
                        {feature.secondaryCta}
                      </NavLink>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="d-flex flex-wrap gap-3 justify-content-center mt-4">
              <NavLink className="btn btn-outline-light rounded-pill px-4" to="/services">
                View all services
              </NavLink>
              <NavLink className="btn btn-primary rounded-pill px-4" to="/contact">
                Ask a question
              </NavLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block home-section">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
              <div>
                <p className="section-kicker">Still deciding?</p>
                <h2 className="section-title mb-3">We can help you choose the rite that fits the moment.</h2>
                <p className="section-intro mb-0">
                  Start with a popular service, or send a question and we’ll point you to the right path.
                </p>
              </div>
              <div className="d-flex flex-wrap gap-3">
                <NavLink to="/services" className="btn btn-primary btn-lg rounded-pill px-4">
                  View all services
                </NavLink>
                <NavLink to="/contact" className="btn btn-outline-light btn-lg rounded-pill px-4">
                  Ask a question
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
