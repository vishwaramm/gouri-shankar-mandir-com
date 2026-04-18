import { useEffect, useMemo, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { serviceOfferings } from '../content.js'
import {
  bootstrapPriestAuth,
  loadPriestAuthStatus,
  loadSiteData,
  loginPriestAuth,
  logoutPriestAuth,
  sendServicePaymentPage,
} from '../lib/siteApi.js'

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Custom quote'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function getSuggestedAmount(serviceName) {
  return serviceOfferings.find((item) => item.title === serviceName)?.contributionAmountCents || 0
}

function buildPaymentLink(request, amountCents) {
  const token = request.paymentPageToken || request.paymentLinkToken || ''
  if (!token) return ''
  return `/payments?token=${encodeURIComponent(token)}`
}

function PriestPaymentRequestPage() {
  const [searchParams] = useSearchParams()
  const [auth, setAuth] = useState({
    loading: true,
    configured: false,
    authenticated: false,
  })
  const [setupStatus, setSetupStatus] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [loginToken, setLoginToken] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [amountById, setAmountById] = useState({})
  const [noteById, setNoteById] = useState({})
  const [statusById, setStatusById] = useState({})
  const [paymentUrlById, setPaymentUrlById] = useState({})

  const requestedId = searchParams.get('requestId') || ''

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [requests])

  const selectedRequest = useMemo(
    () => sortedRequests.find((item) => item.id === requestedId) || sortedRequests[0] || null,
    [requestedId, sortedRequests],
  )

  const sentCount = sortedRequests.filter((item) => item.paymentPageSentAt).length

  const refreshAuth = async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      configured: Boolean(status.configured),
      authenticated: Boolean(status.authenticated),
    })
    return status
  }

  const refreshRequests = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await loadSiteData()
      const nextRequests = Array.isArray(data.serviceRequests) ? data.serviceRequests : []
      setRequests(nextRequests)
      setAmountById((current) => {
        const next = { ...current }
        for (const request of nextRequests) {
          if (next[request.id]) continue
          const suggested = request.paymentPageAmountCents || getSuggestedAmount(request.service)
          if (suggested > 0) {
            next[request.id] = (suggested / 100).toFixed(2)
          }
        }
        return next
      })
    } catch (fetchError) {
      const message = fetchError?.message || 'Unable to load service requests.'
      setError(message)
      if (/unauthorized|not configured/i.test(message)) {
        setAuth((current) => ({ ...current, authenticated: false }))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAuth()
      .then((status) => {
        if (status.authenticated) {
          refreshRequests()
        }
      })
      .catch(() => {
        setAuth({ loading: false, configured: false, authenticated: false })
      })
  }, [])

  const handleBootstrap = async () => {
    setSetupBusy(true)
    setSetupStatus('')
    setSetupToken('')

    try {
      const result = await bootstrapPriestAuth()
      setSetupStatus(result.message || (result.emailed ? 'Access token generated and emailed.' : 'Access token generated.'))
      setSetupToken(result.token || '')
      const status = await refreshAuth()
      if (status.authenticated) {
        await refreshRequests()
      }
    } catch (bootstrapError) {
      setSetupStatus(bootstrapError?.message || 'Unable to generate access token.')
    } finally {
      setSetupBusy(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const token = loginToken.trim()
    if (!token) {
      setLoginError('Enter the access token.')
      return
    }

    setLoginBusy(true)
    setLoginError('')

    try {
      await loginPriestAuth(token)
      setLoginToken('')
      const status = await refreshAuth()
      if (status.authenticated) {
        await refreshRequests()
      }
    } catch (loginFailure) {
      setLoginError(loginFailure?.message || 'Invalid token.')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutPriestAuth()
    } catch {
      // Ignore logout failures and reset local state.
    }

    setAuth((current) => ({ ...current, authenticated: false }))
    setRequests([])
    setStatusById({})
    setPaymentUrlById({})
    setError('')
  }

  const handleSendPaymentPage = async (request) => {
    const rawAmount = amountById[request.id] || ''
    const parsedAmount = Number(rawAmount)
    const amountCents =
      Number.isFinite(parsedAmount) && parsedAmount > 0
        ? Math.max(1, Math.round(parsedAmount * 100))
        : request.paymentPageAmountCents || getSuggestedAmount(request.service)

    if (!request.id) {
      setStatusById((current) => ({ ...current, [request.email || request.createdAt]: 'Request needs an id before sending.' }))
      return
    }

    setStatusById((current) => ({ ...current, [request.id]: 'Sending payment page...' }))

    try {
      const result = await sendServicePaymentPage({
        requestId: request.id,
        amountCents,
        note: noteById[request.id] || '',
      })

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                reviewedAt: result.entry?.reviewedAt || item.reviewedAt || '',
                paymentPageSentAt: result.entry?.paymentPageSentAt || item.paymentPageSentAt || '',
                paymentPageAmountCents: result.entry?.paymentPageAmountCents || amountCents,
                paymentLinkToken: result.paymentLinkToken || item.paymentLinkToken || '',
              }
            : item,
        ),
      )
      setStatusById((current) => ({
        ...current,
        [request.id]: result.emailSent ? 'Payment page sent.' : 'Payment page created. Email delivery is not configured.',
      }))
      setPaymentUrlById((current) => ({
        ...current,
        [request.id]: result.paymentPageUrl || '',
      }))
    } catch (sendError) {
      if (/unauthorized/i.test(sendError?.message || '')) {
        setAuth((current) => ({ ...current, authenticated: false }))
      }
      setStatusById((current) => ({
        ...current,
        [request.id]: sendError?.message || 'Unable to send payment page.',
      }))
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
                <h1 className="display-5 mb-3">Payment request</h1>
                <p className="section-intro mb-0">Generate and send a payment page for an approved request.</p>
              </div>
              <div className="col-lg-4">
                <div className="d-grid gap-2">
                  <NavLink to="/priest-review" className="btn btn-outline-light rounded-pill px-4">
                    Back to access
                  </NavLink>
                  <NavLink to="/priest-custom-payment" className="btn btn-outline-light rounded-pill px-4">
                    Custom payment
                  </NavLink>
                  <button type="button" className="btn btn-primary rounded-pill px-4" onClick={refreshAuth}>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!auth.loading && !auth.configured ? (
            <div className="surface surface-pad mx-auto mt-4" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Setup</p>
              <h2 className="h4 mb-3">Generate priest access</h2>
              <p className="section-intro mb-4">
                Create the first access code. It will be emailed to the temple inbox and never shown on the page in production.
              </p>
              <button type="button" className="btn btn-primary rounded-pill px-4" onClick={handleBootstrap} disabled={setupBusy}>
                {setupBusy ? 'Generating...' : 'Generate access code'}
              </button>
              {setupStatus ? <p className="small text-secondary mt-3 mb-0">{setupStatus}</p> : null}
              {setupToken ? (
                <div className="mt-3">
                  <p className="small text-secondary mb-2">Access code</p>
                  <div className="surface surface-soft p-3 font-monospace small text-break">{setupToken}</div>
                </div>
              ) : null}
            </div>
          ) : !auth.authenticated ? (
            <div className="surface surface-pad mx-auto mt-4" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Access</p>
              <h2 className="h4 mb-3">Unlock priest tools</h2>
              <p className="section-intro mb-4">Enter the access code that was emailed to the temple inbox.</p>
              <form className="d-grid gap-3" onSubmit={handleLogin}>
                <div>
                  <label className="form-label fw-semibold">Access code</label>
                  <input
                    type="password"
                    className="form-control"
                    value={loginToken}
                    onChange={(event) => setLoginToken(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter access code"
                  />
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={loginBusy}>
                    {loginBusy ? 'Unlocking...' : 'Unlock'}
                  </button>
                  <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={() => setLoginToken('')}>
                    Clear
                  </button>
                </div>
                {loginError ? <p className="small text-secondary mb-0">{loginError}</p> : null}
              </form>
            </div>
          ) : null}
        </div>
      </section>

      {!auth.loading && auth.authenticated ? (
        <section className="pb-5">
          <div className="container-xxl">
            <div className="surface surface-pad mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <p className="section-kicker mb-2">Payment requests</p>
                  <h2 className="h4 mb-0">Choose a request and send the payment page</h2>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge text-bg-secondary">{sortedRequests.length} requests</span>
                  <span className="badge text-bg-light border text-dark">{sentCount} sent</span>
                  <button type="button" className="btn btn-outline-light btn-sm rounded-pill" onClick={handleLogout}>
                    Lock
                  </button>
                </div>
              </div>
            </div>

            <div className="surface surface-soft surface-pad mb-3">
              This page is separate from review so priests can generate the payment request without exposing the request triage screen.
            </div>
            <div className="surface surface-soft surface-pad">
              Need to send a payment page to a custom customer? Use the separate custom payment page.
            </div>

            {error ? <div className="alert alert-danger mt-4">{error}</div> : null}
            {loading ? <div className="surface surface-pad mt-4">Loading requests...</div> : null}

            {!loading && sortedRequests.length === 0 ? (
              <div className="surface surface-pad mt-4">No service requests yet.</div>
            ) : null}

            {selectedRequest ? (
              <div className="surface surface-pad mt-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3">
                  <div>
                    <p className="section-kicker mb-2">Selected request</p>
                    <h3 className="h5 mb-1">{selectedRequest.name}</h3>
                    <p className="mb-0 text-secondary">
                      {selectedRequest.service}
                      {selectedRequest.email ? ` · ${selectedRequest.email}` : ''}
                      {selectedRequest.phone ? ` · ${selectedRequest.phone}` : ''}
                    </p>
                  </div>
                  <NavLink
                    className="btn btn-outline-light rounded-pill"
                    to={buildPaymentLink(
                      selectedRequest,
                      selectedRequest.paymentPageAmountCents || getSuggestedAmount(selectedRequest.service),
                    )}
                  >
                    Open payment page
                  </NavLink>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Request</div>
                      <div className="small text-secondary">Date</div>
                      <div className="mb-2">{selectedRequest.date || 'Not selected'}</div>
                      <div className="small text-secondary">Created</div>
                      <div>{selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="surface surface-soft surface-pad h-100">
                      <div className="section-kicker mb-2">Intention</div>
                      <p className="mb-0">{selectedRequest.note}</p>
                    </div>
                  </div>
                </div>

                <div className="row g-3 align-items-end mt-1">
                  <div className="col-md-5">
                    <label className="form-label fw-semibold">Donation amount</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={
                          amountById[selectedRequest.id] ||
                          (selectedRequest.paymentPageAmountCents || getSuggestedAmount(selectedRequest.service)
                            ? ((selectedRequest.paymentPageAmountCents || getSuggestedAmount(selectedRequest.service)) / 100).toFixed(2)
                            : '')
                        }
                        onChange={(event) =>
                          setAmountById((current) => ({ ...current, [selectedRequest.id]: event.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-text text-secondary">
                      Suggested: {formatMoney(selectedRequest.paymentPageAmountCents || getSuggestedAmount(selectedRequest.service))}
                    </div>
                  </div>
                  <div className="col-md-7">
                    <label className="form-label fw-semibold">Priest note</label>
                    <input
                      type="text"
                      className="form-control"
                      value={noteById[selectedRequest.id] || ''}
                      onChange={(event) => setNoteById((current) => ({ ...current, [selectedRequest.id]: event.target.value }))}
                      placeholder="Optional note to include in the email"
                    />
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4"
                    onClick={() => handleSendPaymentPage(selectedRequest)}
                    disabled={!selectedRequest.id}
                  >
                    {selectedRequest.paymentPageSentAt ? 'Resend payment page' : 'Send payment page'}
                  </button>
                  <span className="text-secondary small">This page only sends the payment request after review.</span>
                </div>

                {statusById[selectedRequest.id] ? (
                  <div className="small text-secondary mt-3 mb-0">
                    <div>{statusById[selectedRequest.id]}</div>
                    {paymentUrlById[selectedRequest.id] ? (
                      <NavLink to={paymentUrlById[selectedRequest.id]} className="d-inline-block mt-1 text-decoration-none">
                        {paymentUrlById[selectedRequest.id]}
                      </NavLink>
                    ) : null}
                  </div>
                ) : selectedRequest.paymentPageSentAt ? (
                  <p className="small text-secondary mt-3 mb-0">
                    Payment page sent at {new Date(selectedRequest.paymentPageSentAt).toLocaleString()}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="row g-4 mt-0">
              {sortedRequests.map((request) => (
                <div className="col-12 col-xl-6" key={request.id || `${request.createdAt}-${request.email}`}>
                  <div className={`surface surface-pad h-100 ${request.id === selectedRequest?.id ? 'border border-primary' : ''}`}>
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                      <div>
                        <p className="section-kicker mb-2">{request.service}</p>
                        <h3 className="h5 mb-1">{request.name}</h3>
                        <p className="mb-0 text-secondary">
                          {request.email}
                          {request.phone ? ` · ${request.phone}` : ''}
                        </p>
                      </div>
                      <div className="text-end">
                        {request.paymentPageSentAt ? (
                          <span className="badge text-bg-success">Sent</span>
                        ) : (
                          <span className="badge text-bg-secondary">Pending</span>
                        )}
                      </div>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="surface surface-soft surface-pad h-100">
                          <div className="section-kicker mb-2">Request</div>
                          <div className="small text-secondary">Date</div>
                          <div className="mb-2">{request.date || 'Not selected'}</div>
                          <div className="small text-secondary">Created</div>
                          <div>{request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown'}</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="surface surface-soft surface-pad h-100">
                          <div className="section-kicker mb-2">Intention</div>
                          <p className="mb-0">{request.note}</p>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-3 align-items-center mt-3">
                      <NavLink
                        className="btn btn-outline-light rounded-pill px-4"
                        to={`/priest-payment-request?requestId=${encodeURIComponent(request.id || '')}`}
                      >
                        Open payment request
                      </NavLink>
                      <NavLink
                        className="btn btn-link px-0 text-decoration-none"
                        to={buildPaymentLink(request, request.paymentPageAmountCents || getSuggestedAmount(request.service))}
                      >
                        Open payment page
                      </NavLink>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default PriestPaymentRequestPage
