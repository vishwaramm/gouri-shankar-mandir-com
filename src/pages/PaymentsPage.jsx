import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { getRuntimeConfig } from '../lib/runtimeConfig.js'
import { createSquarePayment, resolvePaymentLink } from '../lib/siteApi.js'

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Custom quote'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatAmountInput(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return '0.00'
  return (amountCents / 100).toFixed(2)
}

function parseAmountInput(value) {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null
}

function getSquareScriptUrl() {
  const runtimeEnvironment = getRuntimeConfig().square?.environment?.trim().toLowerCase()
  const environment = runtimeEnvironment || import.meta.env.VITE_SQUARE_ENVIRONMENT?.trim().toLowerCase()
  return environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'
}

function loadSquareSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Payment fields are unavailable.'))
  if (window.Square) return Promise.resolve(window.Square)

  const existingScript = document.querySelector('script[data-square-web-payments-sdk="true"]')
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(window.Square))
      existingScript.addEventListener('error', () => reject(new Error('Unable to load payment fields.')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = getSquareScriptUrl()
    script.async = true
    script.dataset.squareWebPaymentsSdk = 'true'
    script.onload = () => resolve(window.Square)
    script.onerror = () => reject(new Error('Unable to load payment fields.'))
    document.head.appendChild(script)
  })
}

function PaymentsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const secureToken = searchParams.get('token')?.trim() || ''
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    postalCode: '',
  })
  const [donationAmountInput, setDonationAmountInput] = useState('')
  const [message, setMessage] = useState('Enter your details and card information.')
  const [cardReady, setCardReady] = useState(false)
  const [cardLoadState, setCardLoadState] = useState('loading')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentLink, setPaymentLink] = useState(null)
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(Boolean(secureToken))
  const [paymentLinkError, setPaymentLinkError] = useState('')
  const cardRef = useRef(null)

  const selection = useMemo(() => {
    if (paymentLink) {
      return {
        serviceName: paymentLink.service || 'Selected service',
        amountCents: Number.isInteger(paymentLink.amountCents) && paymentLink.amountCents > 0 ? paymentLink.amountCents : 0,
        contribution: '',
        description: paymentLink.note || paymentLink.service || 'Selected service',
      }
    }

    return {
      serviceName: 'Selected service',
      amountCents: 0,
      contribution: '',
      description: '',
    }
  }, [paymentLink])

  const amountLabel = formatMoney(selection.amountCents)
  const minimumDonationCents = selection.amountCents > 0 ? selection.amountCents : 1
  const defaultDonationCents = Math.max(selection.amountCents, minimumDonationCents)
  const parsedDonationAmountCents = parseAmountInput(donationAmountInput)
  const donationAmountCents = parsedDonationAmountCents || defaultDonationCents
  const donationAmountLabel = formatMoney(donationAmountCents)
  const paymentThemeVars = {
    '--bs-body-bg': '#f8f9fa',
    '--bs-body-color': '#212529',
    '--bs-body-secondary-color': '#6c757d',
    '--bs-secondary-color': '#6c757d',
    '--bs-tertiary-color': '#adb5bd',
    '--bs-heading-color': '#212529',
    '--bs-emphasis-color': '#111827',
    '--bs-card-bg': '#ffffff',
    '--bs-card-color': '#212529',
    '--bs-card-border-color': '#dee2e6',
    '--bs-border-color': '#dee2e6',
    '--bs-link-color': '#0d6efd',
    '--bs-link-hover-color': '#0a58ca',
  }
  useEffect(() => {
    setDonationAmountInput(formatAmountInput(defaultDonationCents))
  }, [defaultDonationCents])

  useEffect(() => {
    let cancelled = false

    const loadSecureLink = async () => {
      if (!secureToken) {
        setPaymentLink(null)
        setPaymentLinkError('')
        setPaymentLinkLoading(false)
        return
      }

      setPaymentLinkLoading(true)
      setPaymentLinkError('')

      try {
        const result = await resolvePaymentLink(secureToken)
        if (cancelled) return

        const link = result.paymentLink || null
        setPaymentLink(link)
        setForm({
          name: link?.name || '',
          email: link?.email || '',
          phone: link?.phone || '',
          postalCode: '',
        })
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname)
        }
      } catch (error) {
        if (cancelled) return
        setPaymentLink(null)
        setPaymentLinkError(error?.message || 'Unable to load payment link.')
        setMessage(error?.message || 'Unable to load payment link.')
      } finally {
        if (!cancelled) {
          setPaymentLinkLoading(false)
        }
      }
    }

    loadSecureLink()

    return () => {
      cancelled = true
    }
  }, [secureToken])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleDonationAmountChange = (event) => {
    setDonationAmountInput(event.target.value)
  }

  const handleDonationAmountBlur = () => {
    const cents = parseAmountInput(donationAmountInput)
    const normalizedCents = cents && cents >= minimumDonationCents ? cents : minimumDonationCents
    setDonationAmountInput(formatAmountInput(normalizedCents))
  }

  const handleResetDonationAmount = () => {
    setDonationAmountInput(formatAmountInput(defaultDonationCents))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!cardRef.current) {
      setMessage('Payment form is not ready yet.')
      return
    }

    const amountCents = parseAmountInput(donationAmountInput) || donationAmountCents

    if (amountCents < minimumDonationCents) {
      setMessage(
        `The donation amount cannot be less than ${formatMoney(minimumDonationCents)}.`,
      )
      return
    }

    setIsSubmitting(true)
    setMessage('Preparing payment...')

    try {
      const [givenName = '', ...familyParts] = form.name.trim().split(/\s+/)
      const familyName = familyParts.join(' ')
      const billingContact = {}
      if (givenName) billingContact.givenName = givenName
      if (familyName) billingContact.familyName = familyName
      if (form.email) billingContact.email = form.email
      if (form.phone) billingContact.phone = form.phone
      if (form.postalCode) billingContact.postalCode = form.postalCode

      const tokenResult = await cardRef.current.tokenize({
        amount: formatAmountInput(amountCents),
        currencyCode: 'USD',
        intent: 'CHARGE',
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: Object.keys(billingContact).length ? billingContact : undefined,
      })

      if (tokenResult.status !== 'OK') {
        const tokenMessage =
          tokenResult.errors?.[0]?.message ||
          tokenResult.errors?.[0]?.detail ||
          'Card tokenization failed.'
        setMessage(tokenMessage)
        return
      }

      setMessage('Submitting payment...')

      const paymentResult = await createSquarePayment({
        amountCents,
        paymentLinkToken: secureToken,
        sourceId: tokenResult.token,
        note: selection.description || selection.serviceName,
        buyerEmailAddress: form.email,
        buyerPhoneNumber: form.phone,
      })

      if (!paymentResult?.payment) {
        setMessage('Payment did not return a response.')
        return
      }

      setMessage(`Payment ${String(paymentResult.payment.status || 'completed').toLowerCase()} for ${formatMoney(amountCents)}.`)
      setForm({ name: '', email: '', phone: '', postalCode: '' })
      setDonationAmountInput(formatAmountInput(defaultDonationCents))
      if (cardRef.current?.clear) {
        await cardRef.current.clear()
      }
    } catch (error) {
      setMessage(error?.message || 'Payment failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const setupCard = async () => {
      const runtimeSquare = getRuntimeConfig().square || {}
      const appId = runtimeSquare.appId?.trim() || import.meta.env.VITE_SQUARE_APP_ID?.trim()
      const locationId = runtimeSquare.locationId?.trim() || import.meta.env.VITE_SQUARE_LOCATION_ID?.trim()

      if (!appId || !locationId) {
        setCardLoadState('error')
        setMessage('Payment is not configured on this page yet.')
        return
      }

      try {
        setCardReady(false)
        setCardLoadState('loading')
        const Square = await loadSquareSdk()
        if (cancelled) return

        if (cardRef.current?.destroy) {
          await cardRef.current.destroy()
        }

        const payments = Square.payments(appId, locationId)
        const card = await payments.card()
        cardRef.current = card

        await card.attach('#square-card-container')

        if (!cancelled) {
          setCardReady(true)
          setCardLoadState('ready')
          setMessage(`Ready for ${amountLabel}.`)
        }
      } catch (error) {
        if (!cancelled) {
          setCardLoadState('error')
          setCardReady(false)
          setMessage(error?.message || 'Payment form could not load.')
        }
      }
    }

    setupCard()

    return () => {
      cancelled = true
      setCardReady(false)
      setCardLoadState('loading')
      if (cardRef.current?.destroy) {
        cardRef.current.destroy().catch(() => {})
      }
      cardRef.current = null
    }
  }, [amountLabel, selection.amountCents])

  return (
    <main
      className="payments-checkout min-vh-100 bg-light text-body"
      data-bs-theme="light"
      style={paymentThemeVars}
    >
      <section className="py-4 py-lg-5">
        <div className="container-xxl">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3">
            <div>
              <NavLink to="/" className="brand-lockup text-decoration-none">
                <span className="brand-mark">GM</span>
                <span className="brand-copy">
                  <strong>Gourishankar Mandir</strong>
                  <span>Sacred home</span>
                </span>
              </NavLink>
              <h1 className="h3 fw-semibold mb-2 mt-3">Payments</h1>
              <p className="mb-0 text-muted">Donations are made to Gourishankar Mandir Inc.</p>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary rounded-pill px-4"
              onClick={() => navigate('/services')}
            >
              Back to services
            </button>
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="container-xxl">
          {paymentLinkLoading ? <div className="alert alert-secondary mb-4">Loading payment link...</div> : null}
          {paymentLinkError ? <div className="alert alert-danger mb-4">{paymentLinkError}</div> : null}
          <div className="row g-4">
            <aside className="col-lg-4">
              <div className="card bg-white shadow-sm border h-100">
                <div className="card-body">
                  <p className="text-uppercase text-muted small fw-semibold mb-2">Receipt</p>
                  <h2 className="h5 mb-3">{selection.serviceName}</h2>
                  <div className="list-group list-group-flush">
                    <div className="list-group-item px-0 py-3 d-flex align-items-start justify-content-between gap-3">
                      <div className="min-w-0" style={{ minWidth: 0 }}>
                        <strong className="d-block mb-1">{selection.serviceName}</strong>
                        <span className="text-muted small">Edit the amount if you want to donate more.</span>
                      </div>
                      <div className="flex-shrink-0 text-end">
                        <div className="input-group input-group-sm" style={{ width: '7rem' }}>
                          <span className="input-group-text">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="form-control text-end"
                            value={donationAmountInput}
                            onChange={handleDonationAmountChange}
                            onBlur={handleDonationAmountBlur}
                            min={formatAmountInput(minimumDonationCents)}
                            step="0.01"
                            placeholder={formatAmountInput(defaultDonationCents)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 mt-1 text-decoration-none"
                          onClick={handleResetDonationAmount}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="list-group-item px-0 py-3 d-flex justify-content-between align-items-center">
                      <span className="fw-semibold">Total</span>
                      <strong>{donationAmountLabel}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="col-lg-8">
              <div className="card bg-white shadow-sm border">
                <div className="card-body">
                  <div className="mb-4">
                    <p className="text-uppercase text-muted small fw-semibold mb-2">Payment details</p>
                    <h3 className="h5 mb-0">Enter card information</h3>
                  </div>
                  <form className="row g-3" onSubmit={handleSubmit}>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Name</label>
                      <input
                        name="name"
                        className="form-control"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email</label>
                      <input
                        name="email"
                        type="email"
                        className="form-control"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Phone</label>
                      <input
                        name="phone"
                        type="tel"
                        className="form-control"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+1 555 123 4567"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">ZIP / Postal code</label>
                      <input
                        name="postalCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        className="form-control"
                        value={form.postalCode}
                        onChange={handleChange}
                        placeholder="90210"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Card details</label>
                      <div className="square-card-shell shadow-sm">
                        <div id="square-card-container" className="square-card-container" />
                        {cardLoadState === 'loading' ? (
                          <div className="square-card-skeleton" aria-hidden="true">
                            <div className="square-card-skeleton-line square-card-skeleton-line-lg" />
                            <div className="square-card-skeleton-line" />
                            <div className="square-card-skeleton-row">
                              <div className="square-card-skeleton-chip" />
                              <div className="square-card-skeleton-chip" />
                              <div className="square-card-skeleton-chip square-card-skeleton-chip-short" />
                            </div>
                          </div>
                        ) : null}
                        {cardLoadState === 'error' ? (
                          <div className="square-card-error">
                            {message || 'Payment fields could not load.'}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-12 d-flex flex-wrap gap-3 align-items-center">
                      <button
                        type="submit"
                        className="btn btn-primary rounded-pill px-4"
                        disabled={!cardReady || isSubmitting || !donationAmountCents}
                      >
                        {isSubmitting ? 'Processing...' : 'Donate'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-pill px-4"
                        onClick={() => navigate('/services')}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  <p className="small text-muted mt-3 mb-0">{message}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default PaymentsPage
