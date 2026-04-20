import { useEffect, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { OrderProgress } from '../components/OrderProgress.jsx'
import { lookupOrder } from '../lib/siteApi.js'
import { getOrderEventLabel, getOrderStatusLabel } from '../lib/orderStatus.js'

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatDate(value) {
  if (!value) return 'Pending'
  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return 'Pending'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    code: searchParams.get('code')?.trim().toUpperCase() || '',
    email: searchParams.get('email')?.trim() || '',
  })
  const [busy, setBusy] = useState(Boolean(searchParams.get('code')))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const [nextStep, setNextStep] = useState('')

  useEffect(() => {
    if (!searchParams.get('code')) return

    const code = searchParams.get('code')?.trim().toUpperCase() || ''
    const email = searchParams.get('email')?.trim() || ''

    if (!code) return

    let cancelled = false
    setBusy(true)
    setError('')
    setMessage('')

    lookupOrder({ code, email })
      .then((result) => {
        if (cancelled) return
        setOrder(result.order || null)
        setNextStep(result.nextStep || '')
        setMessage('Order found.')
      })
      .catch((lookupError) => {
        if (cancelled) return
        setOrder(null)
        setNextStep('')
        setError(lookupError?.message || 'Unable to find that order.')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [searchParams])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const result = await lookupOrder(form)
      setOrder(result.order || null)
      setNextStep(result.nextStep || '')
      setMessage('Order found.')
    } catch (lookupError) {
      setOrder(null)
      setNextStep('')
      setError(lookupError?.message || 'Unable to find that order.')
    } finally {
      setBusy(false)
    }
  }

  const orderStatus = getOrderStatusLabel(order?.status || '')
  const activity = Array.isArray(order?.activity) ? order.activity : []

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-end">
            <div className="col-lg-8">
              <p className="section-kicker">Track order</p>
              <h1 className="section-title mb-3">Look up your service order.</h1>
              <p className="section-intro mb-0">
                Use the order code from your email to check review, payment, and completion status.
              </p>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-soft surface-pad">
                <p className="section-kicker mb-2">Need more detail?</p>
                <p className="text-secondary mb-0">
                  Sign in to your account for the full history, receipts, and profile settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '52rem' }}>
            <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
              <div className="col-md-5">
                <label className="form-label fw-semibold">Order code</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="GM-ABC123"
                  autoComplete="off"
                />
              </div>
              <div className="col-md-5">
                <label className="form-label fw-semibold">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Email address from the request"
                  autoComplete="email"
                />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary rounded-pill px-4 w-100" disabled={busy}>
                  {busy ? 'Checking...' : 'Lookup'}
                </button>
              </div>
            </form>

            {message ? <div className="alert alert-success mt-4 mb-0">{message}</div> : null}
            {error ? <div className="alert alert-danger mt-4 mb-0">{error}</div> : null}

            {order ? (
              <div className="surface surface-soft surface-pad mt-4">
                <div className="row g-4">
                  <div className="col-lg-7">
                    <p className="section-kicker mb-2">Order details</p>
                    <h2 className="h3 mb-3">{order.service}</h2>
                    <div className="d-grid gap-2 text-secondary">
                      <div><strong className="text-body">Order code:</strong> {order.orderCode || form.code}</div>
                      <div><strong className="text-body">Status:</strong> {orderStatus}</div>
                      <div><strong className="text-body">Amount:</strong> {formatMoney(order.amountCents)}</div>
                      <div><strong className="text-body">Requested:</strong> {formatDate(order.createdAt)}</div>
                      <div><strong className="text-body">Paid:</strong> {formatDate(order.paidAt)}</div>
                      <div><strong className="text-body">Completed:</strong> {formatDate(order.completedAt)}</div>
                      <div><strong className="text-body">Target completion:</strong> {formatDate(order.scheduledFor)}</div>
                    </div>
                    {order.refundStatus === 'PARTIALLY_REFUNDED' || order.status === 'partially_refunded' ? (
                      <div className="alert alert-warning mt-4 mb-0">
                        A partial refund has been recorded. The order stays active here so you can review the remaining
                        status and follow-up steps.
                      </div>
                    ) : null}
                    <div className="surface surface-soft surface-pad mt-4">
                      <div className="section-kicker mb-2">Progress</div>
                      <OrderProgress order={order} compact />
                    </div>
                    {Array.isArray(order.timeline) && order.timeline.length ? (
                      <div className="surface surface-soft surface-pad mt-4">
                        <div className="section-kicker mb-2">Timeline preview</div>
                        <div className="d-grid gap-2">
                          {order.timeline.slice(0, 3).map((step) => (
                            <div key={step.key}>
                              <div className="small text-secondary">{formatDate(step.at)}</div>
                              <div className="fw-semibold">{step.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {activity.length ? (
                      <div className="surface surface-soft surface-pad mt-4">
                        <div className="section-kicker mb-2">Activity preview</div>
                        <div className="d-grid gap-3">
                          {activity.slice(0, 4).map((item) => (
                            <div key={item.eventId}>
                              <div className="small text-secondary">{formatDate(item.createdAt)}</div>
                              <div className="fw-semibold">{getOrderEventLabel(item.eventType)}</div>
                              <div className="text-secondary small">{item.message || item.details || 'Order update recorded.'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="col-lg-5">
                    <div className="surface surface-pad h-100">
                      <p className="section-kicker mb-2">Next step</p>
                      <p className="mb-0">{nextStep || 'The order is being reviewed.'}</p>
                      <div className="d-flex flex-wrap gap-2 mt-4">
                        <NavLink
                          to={`/order/${encodeURIComponent(order.orderCode || form.code)}${form.email ? `?email=${encodeURIComponent(form.email)}` : ''}`}
                          className="btn btn-primary rounded-pill px-4"
                        >
                          Open details
                        </NavLink>
                        <NavLink to="/login" className="btn btn-outline-primary rounded-pill px-4">
                          Sign in
                        </NavLink>
                        <NavLink to="/services" className="btn btn-outline-secondary rounded-pill px-4">
                          Services
                        </NavLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default TrackOrderPage
