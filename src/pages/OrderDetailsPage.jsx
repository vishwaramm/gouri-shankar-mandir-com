import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams, useSearchParams } from 'react-router-dom'
import { OrderProgress } from '../components/OrderProgress.jsx'
import { lookupOrder, requestOrderChange } from '../lib/siteApi.js'
import { getOrderEventLabel, getOrderStatusLabel } from '../lib/orderStatus.js'

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatDateTime(value) {
  if (!value) return 'Pending'
  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return 'Pending'
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(value) {
  if (!value) return 'Pending'
  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return 'Pending'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildReceiptText(order = {}) {
  const lines = [
    'Gourishankar Mandir receipt',
    `Order code: ${order.orderCode || ''}`,
    `Service: ${order.service || ''}`,
    `Status: ${getOrderStatusLabel(order.status || '')}`,
    `Amount: ${formatMoney(order.amountCents || 0)}`,
    `Requested: ${formatDateTime(order.createdAt)}`,
    `Paid: ${formatDateTime(order.paidAt)}`,
    `Completed: ${formatDateTime(order.completedAt)}`,
    `Target completion: ${formatDate(order.scheduledFor)}`,
    `Name: ${order.name || ''}`,
    `Email: ${order.email || ''}`,
  ]

  const activity = Array.isArray(order.activity) ? order.activity : []
  if (activity.length) {
    lines.push('')
    lines.push('Activity')
    for (const item of activity) {
      lines.push(`${formatDateTime(item.createdAt)} - ${getOrderEventLabel(item.eventType)}${item.message ? `: ${item.message}` : ''}`)
    }
  }

  return lines.join('\n')
}

function OrderDetailsPage() {
  const { orderCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [busy, setBusy] = useState(Boolean(orderCode))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const [nextStep, setNextStep] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)
  const [supportNotice, setSupportNotice] = useState('')

  const email = searchParams.get('email')?.trim() || ''
  const code = useMemo(() => orderCode.trim().toUpperCase(), [orderCode])

  useEffect(() => {
    if (!code) return

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      setBusy(true)
      setMessage('')
      setError('')
      setOrder(null)
      setNextStep('')
    })

    lookupOrder({ code, email })
      .then((result) => {
        if (cancelled) return
        setOrder(result.order || null)
        setNextStep(result.nextStep || '')
        setMessage('Order loaded.')
        setSupportNotice('')
      })
      .catch((lookupError) => {
        if (cancelled) return
        setOrder(null)
        setNextStep('')
        setError(lookupError?.message || 'Unable to load that order.')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [code, email])

  const timeline = Array.isArray(order?.timeline) ? order.timeline : []
  const activity = Array.isArray(order?.activity) ? order.activity : []
  const receiptDate = order?.completedAt || order?.paidAt || order?.createdAt || ''
  const supportSubject = order ? `Support request for order ${order.orderCode || code}` : 'Support request'
  const supportMessage = order
    ? `Hello,\n\nI need help with order ${order.orderCode || code} for ${order.service || 'my service'}.\n\nStatus: ${getOrderStatusLabel(order.status)}\nRequested: ${formatDateTime(order.createdAt)}\nPaid: ${formatDateTime(order.paidAt)}\nCompleted: ${formatDateTime(order.completedAt)}\n\nPlease let me know the next steps.`
    : ''
  const supportType =
    order?.status === 'completed' || order?.status === 'refunded' || order?.paidAt || order?.status === 'awaiting_completion'
      ? 'refund'
      : 'cancel'
  const supportDisabled = supportBusy || ['cancel_requested', 'refund_requested', 'refunded', 'cancelled'].includes(order?.status || '')

  const handleSupportRequest = async () => {
    if (!order) return

    setSupportBusy(true)
    setSupportNotice('')
    setError('')

    try {
      const result = await requestOrderChange({
        orderCode: order.orderCode || code,
        email: order.lookupEmail || email,
        type: supportType,
        reason: supportMessage,
      })

      if (result.entry) {
        setOrder((current) => ({ ...current, ...result.entry }))
      }
      setNextStep(
        result.entry?.serviceStatus === 'refund_requested'
          ? 'A refund request has been submitted.'
          : 'A cancellation request has been submitted.',
      )
      setSupportNotice(result.message || 'Support request submitted.')
    } catch (supportError) {
      setError(supportError?.message || 'Unable to submit the request.')
    } finally {
      setSupportBusy(false)
    }
  }

  const handleDownloadReceipt = () => {
    if (!order) return

    const blob = new Blob([buildReceiptText(order)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `gourishankar-mandir-receipt-${order.orderCode || code || 'order'}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-end">
            <div className="col-lg-8">
              <p className="section-kicker">Order details</p>
              <h1 className="section-title mb-3">Your service timeline.</h1>
              <p className="section-intro mb-0">
                A single place to review the request, payment, scheduled completion, and final notice.
              </p>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-soft surface-pad">
                <p className="section-kicker mb-2">Need to look it up again?</p>
                <p className="text-secondary mb-0">
                  Use the order code from your email, or sign in to see the full account history.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '68rem' }}>
            {busy ? <div className="surface surface-pad">Loading order...</div> : null}
            {message ? <div className="alert alert-success mt-0">{message}</div> : null}
            {error ? <div className="alert alert-danger mt-0">{error}</div> : null}

            {order ? (
              <>
                <div className="row g-4 align-items-end">
                  <div className="col-lg-8">
                    <p className="section-kicker mb-2">Receipt</p>
                    <h2 className="display-6 mb-3">{order.service}</h2>
                    <p className="section-intro mb-0">
                      {order.orderCode || code}
                      {order.lookupEmail ? ` · ${order.lookupEmail}` : ''}
                    </p>
                  </div>
                  <div className="col-lg-4 text-lg-end">
                    <span className="badge rounded-pill text-bg-light border text-dark fs-6 px-3 py-2">
                      {getOrderStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <div className="row g-3 mt-4">
                  <div className="col-sm-6 col-lg-3">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Amount</div>
                      <div className="h4 mb-0">{formatMoney(order.amountCents)}</div>
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Requested</div>
                      <div className="fw-semibold">{formatDateTime(order.createdAt)}</div>
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Target completion</div>
                      <div className="fw-semibold">{order.scheduledFor ? formatDate(order.scheduledFor) : 'Pending'}</div>
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Completed</div>
                      <div className="fw-semibold">{formatDateTime(order.completedAt)}</div>
                    </div>
                  </div>
                </div>

                {order.refundStatus === 'PARTIALLY_REFUNDED' || order.status === 'partially_refunded' ? (
                  <div className="alert alert-warning mt-4 mb-0">
                    A partial refund has been recorded. The original payment amount stays on the record, and the
                    remaining balance is shown in the order activity.
                  </div>
                ) : null}

                <div className="surface surface-soft surface-pad mt-4">
                  <div className="section-kicker mb-2">Progress</div>
                  <OrderProgress order={order} />
                </div>

                <div className="row g-4 mt-1">
                  <div className="col-lg-7">
                    <div className="surface surface-pad h-100">
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                        <div>
                          <p className="section-kicker mb-2">Timeline</p>
                          <h3 className="h4 mb-0">What happens next</h3>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={handleDownloadReceipt}>
                            Download receipt
                          </button>
                          <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={() => window.print()}>
                            Print receipt
                          </button>
                        </div>
                      </div>

                      <div className="timeline-list">
                        {timeline.length ? (
                          timeline.map((step) => (
                            <article className="timeline-item" key={step.key}>
                              <time>{formatDateTime(step.at)}</time>
                              <div>
                                <h4 className="h5 mb-1">{step.label}</h4>
                                <p className="mb-0 text-secondary">{step.detail}</p>
                              </div>
                            </article>
                          ))
                        ) : (
                          <div className="surface surface-soft surface-pad">Timeline will appear once the request is reviewed.</div>
                        )}
                      </div>

                      {activity.length ? (
                        <div className="surface surface-soft surface-pad mt-4">
                          <div className="section-kicker mb-2">Activity log</div>
                          <div className="timeline-list">
                            {activity.map((item) => (
                              <article className="timeline-item" key={item.eventId}>
                                <time>{formatDateTime(item.createdAt)}</time>
                                <div>
                                  <h4 className="h5 mb-1">{getOrderEventLabel(item.eventType)}</h4>
                                  <p className="mb-0 text-secondary">
                                    {item.message || item.details || 'Order activity recorded.'}
                                    {item.actorName ? ` · ${item.actorName}` : ''}
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="col-lg-5">
                    <div className="surface surface-pad h-100 d-grid gap-3">
                      <div>
                        <p className="section-kicker mb-2">Next step</p>
                        <p className="mb-0">{nextStep || 'The order is being reviewed.'}</p>
                      </div>
                      <div>
                        <p className="section-kicker mb-2">Details</p>
                        <div className="d-grid gap-2 text-secondary">
                          <div><strong className="text-body">Order code:</strong> {order.orderCode || code}</div>
                          <div><strong className="text-body">Requested by:</strong> {order.name || 'Not set'}</div>
                          <div><strong className="text-body">Email:</strong> {order.email || 'Not set'}</div>
                          <div><strong className="text-body">Paid:</strong> {formatDateTime(order.paidAt)}</div>
                          <div><strong className="text-body">Receipt date:</strong> {formatDateTime(receiptDate)}</div>
                        </div>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        <NavLink to="/account" className="btn btn-primary rounded-pill px-4">
                          Account
                        </NavLink>
                        <NavLink
                          to={`/contact?subject=${encodeURIComponent(supportSubject)}&message=${encodeURIComponent(supportMessage)}`}
                          className="btn btn-outline-light rounded-pill px-4"
                        >
                          Request help
                        </NavLink>
                        <NavLink to="/track-order" className="btn btn-outline-secondary rounded-pill px-4">
                          Track another
                        </NavLink>
                        <button
                          type="button"
                          className="btn btn-outline-primary rounded-pill px-4"
                          onClick={handleSupportRequest}
                          disabled={supportDisabled}
                        >
                          {supportBusy
                            ? 'Submitting...'
                            : supportDisabled
                              ? getOrderStatusLabel(order?.status || '')
                              : supportType === 'refund'
                                ? 'Request refund'
                                : 'Request cancellation'}
                        </button>
                      </div>
                      {supportNotice ? <div className="alert alert-success mb-0">{supportNotice}</div> : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}

export default OrderDetailsPage
