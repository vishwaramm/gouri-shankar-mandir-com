import { NavLink, useNavigate } from 'react-router-dom'
import { createPaymentLink } from '../lib/siteApi.js'
import { serviceOfferings } from '../content.js'

const highlights = [
  {
    title: 'Virtual darshan',
    text: 'A temple atmosphere shaped by still photography, warm contrast, and quiet access.',
  },
  {
    title: 'Sacred services',
    text: 'Pooja, yagnas, astrology, counseling, and samskaras arranged with care.',
  },
  {
    title: 'Learning and community',
    text: 'Meditation, classes, festival rhythms, and satsang between visits.',
  },
]

const siteLinks = [
  ['About', '/about', 'Temple story and leadership.'],
  ['Services', '/services', 'Pooja, yagnas, and guidance.'],
  ['Education', '/education', 'Teachings, study, and practice.'],
  ['Community', '/community', 'Satsang and observances.'],
  ['Resources', '/resources', 'Prayers, dates, and texts.'],
  ['Contact', '/contact', 'Write to the mandir.'],
]

function HomePage() {
  const navigate = useNavigate()

  const handleServiceAction = async (service) => {
    try {
      if (!service.contributionAmountCents) {
        navigate(`/services?service=${encodeURIComponent(service.title)}`)
        return
      }

      const result = await createPaymentLink({
        service: service.title,
        amountCents: service.contributionAmountCents,
      })

      if (!result.paymentLinkToken) {
        throw new Error('Unable to open the donation page.')
      }

      navigate(`/payments?token=${encodeURIComponent(result.paymentLinkToken)}`)
    } catch {
      window.alert('Unable to open the donation page right now.')
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
                <h1 className="hero-title text-white">A sacred home.</h1>
                <p className="hero-lede mt-4">Virtual darshan, devotional services, learning, and satsang.</p>
                <div className="d-flex flex-wrap gap-3 mt-4">
                  <NavLink className="btn btn-primary btn-lg rounded-pill px-4" to="/services">
                    Explore services
                  </NavLink>
                  <NavLink className="btn btn-outline-light btn-lg rounded-pill px-4" to="/contact">
                    Contact
                  </NavLink>
                </div>
              </div>

              <div className="hero-stack mt-5 reveal delay-1">
                <div className="hero-stat">
                  <strong>01</strong>
                  <span>Darshan, service, and study.</span>
                </div>
                <div className="hero-stat">
                  <strong>02</strong>
                  <span>Worship, learning, and gathering.</span>
                </div>
                <div className="hero-stat">
                  <strong>03</strong>
                  <span>Calm on every screen.</span>
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
              <p className="section-kicker">Temple presence</p>
              <h2 className="section-title">Worship, study, and community.</h2>
            </div>
            <div className="col-lg-5">
              <p className="section-intro mb-0">A quiet doorway into temple life.</p>
            </div>
          </div>

          <div className="support-grid">
            {highlights.map((item, index) => (
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
          <div className="surface surface-pad">
            <div className="row align-items-end g-4 mb-4">
              <div className="col-lg-7">
                <p className="section-kicker">Services</p>
                <h2 className="section-title mb-3">Offerings you can request today.</h2>
              </div>
              <div className="col-lg-5">
                <p className="section-intro mb-0">
                  Pick a service, review the suggested contribution, and continue to payment or request review.
                </p>
              </div>
            </div>

            <div className="row g-4">
              {serviceOfferings.map((service, index) => (
                <div className="col-12 col-md-6 col-xl-4" key={service.title}>
                  <article className="surface surface-strong surface-pad h-100 reveal" style={{ animationDelay: `${index * 80}ms` }}>
                    <p className="section-kicker mb-2">{service.category}</p>
                    <h3 className="h4 mb-3">{service.title}</h3>
                    <p className="section-intro mb-4">{service.body}</p>

                    <div className="d-grid gap-2 mb-4">
                      {service.includes.map((item) => (
                        <div className="d-flex gap-2 align-items-start" key={item}>
                          <span className="text-primary-emphasis">•</span>
                          <span className="text-secondary">{item}</span>
                        </div>
                      ))}
                    </div>

                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                      <div>
                        <div className="section-kicker mb-2">Contribution</div>
                        <div className="h4 mb-0">{service.contribution}</div>
                      </div>
                      <div className="text-end">
                        <div className="small text-secondary">{service.timing}</div>
                        <div className="small text-secondary">{service.delivery}</div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
                        onClick={() => handleServiceAction(service)}
                      >
                        {service.contributionAmountCents ? 'Donate now' : 'Request quote'}
                      </button>
                      <NavLink className="btn btn-outline-light rounded-pill px-4" to="/services">
                        Learn more
                      </NavLink>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block home-section">
        <div className="container-xxl">
          <div className="surface surface-pad">
            <div className="row g-4 align-items-end mb-4">
              <div className="col-lg-7">
                <p className="section-kicker">Visit</p>
                <h2 className="section-title mb-3">Paths through the mandir.</h2>
              </div>
              <div className="col-lg-5">
                <p className="section-intro mb-0">Each path carries its own tone.</p>
              </div>
            </div>

            <div className="journey-grid">
              {siteLinks.map(([label, path, description], index) => (
                <NavLink className="journey-link reveal" to={path} key={label} style={{ animationDelay: `${index * 90}ms` }}>
                  <span className="journey-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{label}</h3>
                    <p>{description}</p>
                  </div>
                  <span className="journey-arrow">↗</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-block home-section">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-4">
              <div>
                <p className="section-kicker">Community signal</p>
                <h2 className="section-title mb-3">Prayer, practice, and satsang.</h2>
                <p className="section-intro mb-0">A steady place for devotion and return visits.</p>
              </div>
              <NavLink to="/community" className="btn btn-outline-light btn-lg rounded-pill px-4">
                Explore community
              </NavLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
