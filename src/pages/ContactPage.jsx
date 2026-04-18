import { useState } from 'react'
import { faqItems } from '../content.js'
import { createContactMessage, createNewsletter } from '../lib/siteApi.js'

function ContactPage() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [faqOpen, setFaqOpen] = useState(0)
  const [directEmail, setDirectEmail] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [emailStatus, setEmailStatus] = useState({
    type: 'idle',
    message: 'Write when ready.',
  })
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const handleNewsletterSubmit = (event) => {
    event.preventDefault()
    const email = event.currentTarget.email.value.trim()
    if (!email) return

    createNewsletter(email)
      .then(() => {
        setIsSubscribed(true)
        event.currentTarget.reset()
      })
      .catch(() => {
        setIsSubscribed(false)
      })
  }

  const handleDirectEmailChange = (event) => {
    const { name, value } = event.target
    setDirectEmail((current) => ({ ...current, [name]: value }))
  }

  const handleDirectEmailSubmit = async (event) => {
    event.preventDefault()
    const payload = {
      name: directEmail.name.trim(),
      email: directEmail.email.trim(),
      subject: directEmail.subject.trim(),
      message: directEmail.message.trim(),
    }

    if (!payload.name || !payload.email || !payload.message) return

      try {
        setIsSendingEmail(true)
        setEmailStatus({
          type: 'pending',
          message: 'Sending...',
        })

      const result = await createContactMessage(payload)

      setEmailStatus(
        result.emailed === false
          ? {
              type: 'error',
              message:
                result.mailStatus === 'missing_smtp'
                  ? 'Saved. Mail delivery is not configured.'
                  : result.mailError
                    ? `Saved. Mail delivery failed: ${result.mailError}`
                    : 'Saved. Mail delivery failed.',
            }
          : {
              type: 'success',
              message: 'Sent.',
            },
      )
      setDirectEmail({
        name: '',
        email: '',
        subject: '',
        message: '',
      })
    } catch (error) {
      setEmailStatus({
        type: 'error',
        message: error.message || 'Please try again later.',
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.18), rgba(10, 8, 7, 0.82)), url("/images/priest-class-women.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-4">
            <div className="col-lg-8 col-xl-7">
              <div className="reveal">
                <p className="section-kicker text-white">Contact</p>
                <h1 className="hero-title text-white">Letters, blessings, and correspondence.</h1>
                <p className="hero-lede mt-4">Festivals, classes, guidance, and offerings.</p>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-strong surface-pad reveal delay-1">
                <p className="section-kicker">Temple letters</p>
                <h2 className="h3 mb-3">A quiet way to stay near.</h2>
                <p className="section-intro mb-0">Festival dates, classes, and arrangements.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell contact-section">
        <div className="container-xxl">
          <div className="surface surface-pad">
            <div className="row g-4 align-items-start">
              <div className="col-lg-4">
                <p className="section-kicker">Temple letters</p>
                <h2 className="section-title mb-3">Temple letters.</h2>
                <p className="section-intro mb-0">Festival dates, classes, and gatherings sent with care.</p>
              </div>

              <div className="col-lg-8">
                <form className="row g-3" onSubmit={handleNewsletterSubmit}>
                  <div className="col-12">
                    <label className="visually-hidden" htmlFor="email">
                      Email address
                    </label>
                    <div className="input-group input-group-lg">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-control"
                        placeholder="Enter your email address"
                        required
                      />
                      <button type="submit" className="btn btn-primary">
                        Receive
                      </button>
                    </div>
                  </div>
                  <div className="col-12">
                    <p className={`mb-0 text-secondary ${isSubscribed ? 'fw-semibold' : ''}`}>
                      {isSubscribed ? 'Noted.' : 'Enter your email for temple letters.'}
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block contact-section">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad">
            <div className="row g-4 align-items-start">
              <div className="col-lg-4">
                <p className="section-kicker">Temple mail</p>
                <h2 className="section-title mb-3">Write directly to the mandir.</h2>
                <p className="section-intro mb-4">For blessings, rites, and temple correspondence.</p>
              </div>

              <div className="col-lg-8">
                <form className="row g-3" onSubmit={handleDirectEmailSubmit}>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Name</label>
                    <input
                      className="form-control"
                      name="name"
                      value={directEmail.name}
                      onChange={handleDirectEmailChange}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-primary-emphasis">Email</label>
                    <input
                      className="form-control"
                      name="email"
                      type="email"
                      value={directEmail.email}
                      onChange={handleDirectEmailChange}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-primary-emphasis">Subject</label>
                    <input
                      className="form-control"
                      name="subject"
                      value={directEmail.subject}
                      onChange={handleDirectEmailChange}
                      placeholder="How can we help?"
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-primary-emphasis">Message</label>
                    <textarea
                      className="form-control"
                      name="message"
                      value={directEmail.message}
                      onChange={handleDirectEmailChange}
                      rows="6"
                      placeholder="Write your message here."
                      required
                    />
                  </div>
                  <div className="col-12 d-flex flex-wrap align-items-center gap-3">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg rounded-pill px-4"
                      disabled={isSendingEmail}
                    >
                      {isSendingEmail ? 'Sending...' : 'Send letter'}
                    </button>
                    <p
                      className={`mb-0 ${
                        emailStatus.type === 'error'
                          ? 'text-danger-emphasis'
                          : emailStatus.type === 'success'
                            ? 'text-success-emphasis'
                            : 'text-secondary'
                      }`}
                      aria-live="polite"
                    >
                      {emailStatus.message}
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block contact-section">
        <div className="container-xxl">
          <div className="surface surface-pad">
            <div className="mb-4">
              <p className="section-kicker">Questions</p>
              <h2 className="section-title mb-0">Common questions.</h2>
            </div>

            <div className="accordion" id="contactFaq">
              {faqItems.map((item, index) => (
                <div className="accordion-item mb-3" key={item.question}>
                  <h2 className="accordion-header">
                    <button
                      type="button"
                      className={faqOpen === index ? 'accordion-button' : 'accordion-button collapsed'}
                      aria-expanded={faqOpen === index}
                      onClick={() => setFaqOpen(index)}
                    >
                      {item.question}
                    </button>
                  </h2>
                  {faqOpen === index ? <div className="accordion-body">{item.answer}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ContactPage
