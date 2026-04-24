import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { unsubscribeNewsletter } from '../lib/siteApi.js'

function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({
    type: 'idle',
    message: token ? 'Checking your link...' : 'Enter the email address you want to remove.',
  })

  useEffect(() => {
    if (!token) return

    let cancelled = false

    unsubscribeNewsletter({ token })
      .then((result) => {
        if (cancelled) return
        setStatus({
          type: result.unsubscribed ? 'success' : 'error',
          message: result.unsubscribed ? 'You have been unsubscribed.' : 'That link is no longer valid.',
        })
      })
      .catch((error) => {
        if (cancelled) return
        setStatus({
          type: 'error',
          message: error.message || 'We could not process that link.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) return

    try {
      setStatus({ type: 'pending', message: 'Removing...' })
      const result = await unsubscribeNewsletter({ email: nextEmail })
      setStatus({
        type: result.unsubscribed ? 'success' : 'error',
        message: result.unsubscribed ? 'You have been unsubscribed.' : 'No subscription was found for that email.',
      })
      if (result.unsubscribed) {
        setEmail('')
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message || 'Please try again later.',
      })
    }
  }

  return (
    <main>
      <section className="hero-shell hero-shell-compact section-shell">
        <div className="container-xxl hero-grid">
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="reveal">
                <p className="section-kicker">Temple letters</p>
                <h1 className="hero-title">Unsubscribe.</h1>
                <p className="hero-lede">
                  Remove an email address from temple letters and announcements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="surface surface-pad">
                <div className="section-kicker mb-2">Temple letters</div>
                <h2 className="section-title mb-3">Unsubscribe from announcements</h2>
                <p className="section-intro mb-4">
                  If you received a link, it can be used once. Otherwise, enter the email address below.
                </p>

                <form className="row g-3" onSubmit={handleSubmit}>
                  <div className="col-12">
                    <label className="form-label fw-semibold text-primary-emphasis" htmlFor="unsubscribe-email">
                      Email address
                    </label>
                    <input
                      id="unsubscribe-email"
                      className="form-control"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      disabled={Boolean(token)}
                    />
                  </div>
                  {!token ? (
                    <div className="col-12 d-flex justify-content-start">
                      <button type="submit" className="btn btn-primary">
                        Unsubscribe
                      </button>
                    </div>
                  ) : null}
                </form>

                <div className="mt-4">
                  <p
                    className={`mb-0 ${status.type === 'error' ? 'text-danger' : status.type === 'success' ? 'text-success' : 'text-secondary'}`}
                  >
                    {status.message}
                  </p>
                  {token ? (
                    <div className="mt-3">
                      <a className="btn btn-outline-dark" href="/contact">
                        Back to contact
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default UnsubscribePage
