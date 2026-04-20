import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  loadPriestAuthStatus,
  sendCustomPaymentPage,
} from '../lib/siteApi.js'

function PriestCustomPaymentPage() {
  const [auth, setAuth] = useState({
    loading: true,
    configured: false,
    authenticated: false,
  })
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    amount: '',
    serviceLabel: 'Custom payment',
    note: '',
  })
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitStatus, setSubmitStatus] = useState('')
  const [sentLink, setSentLink] = useState('')

  const refreshAuth = async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      configured: Boolean(status.configured),
      authenticated: Boolean(status.authenticated),
    })
    return status
  }

  useEffect(() => {
    refreshAuth().catch(() => {
      setAuth({ loading: false, configured: false, authenticated: false })
    })
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const amountValue = Number(form.amount)
    if (!form.name.trim() || !form.email.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
      setSubmitStatus('Name, email, and amount are required.')
      return
    }

    setSubmitBusy(true)
    setSubmitStatus('')
    setSentLink('')

    const amountCents = Math.max(1, Math.round(amountValue * 100))

    try {
      const result = await sendCustomPaymentPage({
        name: form.name,
        email: form.email,
        phone: form.phone,
        amountCents,
        serviceLabel: form.serviceLabel,
        note: form.note,
      })

      setSubmitStatus(result.message || 'Custom payment page sent.')
      setSentLink(result.paymentPageUrl || '')
    } catch (submitError) {
      setSubmitStatus(submitError?.message || 'Unable to send custom payment page.')
    } finally {
      setSubmitBusy(false)
    }
  }

  return (
    <main className="priest-tools-page min-vh-100" data-bs-theme="dark">
      <section className="section-block pb-4">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad">
            <div className="row g-4 align-items-end">
              <div className="col-lg-8">
                <NavLink to="/" className="brand-lockup text-decoration-none mb-3">
                  <span className="brand-mark">GM</span>
                  <span className="brand-copy">
                    <strong>Gourishankar Mandir</strong>
                    <span>Sacred home</span>
                  </span>
                </NavLink>
                <p className="section-kicker mb-3">Private admin</p>
                <h1 className="display-5 mb-3">Custom payment</h1>
              <p className="section-intro mb-0">Send a payment page to a customer without using a service request.</p>
              </div>
              <div className="col-lg-4">
                <div className="d-grid gap-2">
                  <button type="button" className="btn admin-refresh-btn rounded-pill px-4" onClick={refreshAuth}>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!auth.loading && !auth.authenticated ? (
            <div className="surface surface-pad mx-auto mt-4" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Access</p>
              <h2 className="h4 mb-3">Use the admin login page</h2>
              <p className="section-intro mb-4">
                Admin access is now account-based. Create or sign in on the admin page, then come back here.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <button type="button" className="btn admin-refresh-btn rounded-pill px-4" onClick={refreshAuth}>
                  Refresh
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {!auth.loading && auth.authenticated ? (
        <section className="pb-5">
          <div className="container-xxl">
            <div className="surface surface-pad">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <p className="section-kicker mb-2">Customer payment</p>
                  <h2 className="h4 mb-0">Send a payment page directly to a customer</h2>
                </div>
              </div>

              <div className="surface surface-soft surface-pad mb-4">
                Use this when you need to collect a custom payment or one-off charge without a service request record.
              </div>

              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Customer name</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Name"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Customer email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="name@example.com"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Phone</label>
                  <input
                    className="form-control"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Phone"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Amount</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Payment label</label>
                  <input
                    className="form-control"
                    value={form.serviceLabel}
                    onChange={(event) => setForm((current) => ({ ...current, serviceLabel: event.target.value }))}
                    placeholder="Custom payment"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Note</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Optional note to include in the email"
                  />
                </div>
                <div className="col-12 d-flex flex-wrap gap-3 align-items-center">
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={submitBusy}>
                    {submitBusy ? 'Sending...' : 'Send custom payment'}
                  </button>
                  {sentLink ? (
                    <NavLink to={sentLink} className="btn btn-outline-light rounded-pill px-4">
                      Open payment page
                    </NavLink>
                  ) : null}
                </div>
                {submitStatus ? (
                  <div className="col-12 small text-secondary">
                    <div>{submitStatus}</div>
                    {sentLink ? (
                      <NavLink to={sentLink} className="d-inline-block mt-1 text-decoration-none">
                        {sentLink}
                      </NavLink>
                    ) : null}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default PriestCustomPaymentPage
