import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { loadPriestAuthStatus, loadSiteData, logoutPriestAuth } from '../lib/siteApi.js'

function PriestToolsPage() {
  const navigate = useNavigate()
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
  })
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }, [requests])
  const sentCount = sortedRequests.filter((item) => item.paymentPageSentAt).length

  const refreshAuth = async () => {
    const status = await loadPriestAuthStatus()
    setAuth({
      loading: false,
      authenticated: Boolean(status.authenticated),
    })
    return status
  }

  const refreshRequests = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await loadSiteData()
      setRequests(Array.isArray(data.serviceRequests) ? data.serviceRequests : [])
    } catch (fetchError) {
      const message = fetchError?.message || 'Unable to load service requests.'
      setError(message)
      if (/unauthorized|not configured/i.test(message)) {
        setAuth((current) => ({ ...current, authenticated: false }))
        navigate('/priest-review', { replace: true })
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
        } else {
          navigate('/priest-review', { replace: true })
        }
      })
      .catch(() => {
        setAuth({ loading: false, authenticated: false })
        navigate('/priest-review', { replace: true })
      })
  }, [navigate])

  const handleLogout = async () => {
    try {
      await logoutPriestAuth()
    } catch {
      // Ignore logout failures and reset local state.
    }

    setAuth((current) => ({ ...current, authenticated: false }))
    setRequests([])
    setError('')
    navigate('/priest-review', { replace: true })
  }

  return (
    <main className="priest-tools-page min-vh-100" data-bs-theme="dark">
      <section className="section-block pb-4">
        <div className="container-xxl">
          {auth.loading ? <div className="surface surface-pad">Loading access status...</div> : null}

          {!auth.loading && !auth.authenticated ? (
            <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-3">Locked</p>
              <h1 className="h3 mb-3">Open priest access first</h1>
              <p className="section-intro mb-4">
                The private tools page only opens after the access code is unlocked in the browser.
              </p>
              <NavLink to="/priest-review" className="btn btn-primary rounded-pill px-4">
                Open priest access
              </NavLink>
            </div>
          ) : null}

          {!auth.loading && auth.authenticated ? (
            <div className="surface surface-strong surface-pad">
              <div className="row g-4 align-items-end">
                <div className="col-lg-8">
                  <p className="section-kicker mb-3">Private admin</p>
                  <h1 className="display-5 mb-3">Priest tools</h1>
                  <p className="section-intro mb-0">
                    Review incoming requests, then open the separate payment request or custom payment page when it is time to send a donation link.
                  </p>
                </div>
                <div className="col-lg-4">
                  <div className="d-grid gap-2">
                    <NavLink to="/priest-payment-request" className="btn btn-primary rounded-pill px-4">
                      Payment request
                    </NavLink>
                    <NavLink to="/priest-custom-payment" className="btn btn-outline-light rounded-pill px-4">
                      Custom payment
                    </NavLink>
                    <button type="button" className="btn btn-outline-light rounded-pill px-4" onClick={refreshAuth}>
                      Refresh
                    </button>
                    <button type="button" className="btn btn-link text-decoration-none text-start px-0" onClick={handleLogout}>
                      Lock
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-3 mt-4">
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Requests</div>
                    <div className="display-6 mb-0">{sortedRequests.length}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Sent</div>
                    <div className="display-6 mb-0">{sentCount}</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="surface surface-soft surface-pad h-100">
                    <div className="section-kicker mb-2">Mode</div>
                    <div className="h4 mb-0">Unlocked</div>
                  </div>
                </div>
              </div>
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
                  <p className="section-kicker mb-2">Service requests</p>
                  <h2 className="h4 mb-0">Incoming requests</h2>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge text-bg-secondary">{sortedRequests.length} requests</span>
                  <span className="badge text-bg-light border text-dark">{sentCount} sent</span>
                </div>
              </div>
            </div>

            {error ? <div className="alert alert-danger">{error}</div> : null}
            {loading ? <div className="surface surface-pad">Loading requests...</div> : null}

            {!loading && sortedRequests.length === 0 ? (
              <div className="surface surface-pad">No service requests yet.</div>
            ) : null}

            <div className="row g-4 mt-0">
              {sortedRequests.map((request) => (
                <div className="col-12 col-xl-6" key={request.id || `${request.createdAt}-${request.email}`}>
                  <div className="surface surface-pad h-100">
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
                        to={`/priest-custom-payment?name=${encodeURIComponent(request.name || '')}&email=${encodeURIComponent(
                          request.email || '',
                        )}&phone=${encodeURIComponent(request.phone || '')}`}
                      >
                        Open custom payment
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

export default PriestToolsPage
