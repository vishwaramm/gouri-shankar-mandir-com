import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import PasswordField from '../components/PasswordField.jsx'
import { loadPriestAuthStatus, loginPriestAuth, requestPriestAccess } from '../lib/siteApi.js'

function PriestReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const approvalState = searchParams.get('approval')?.trim() || ''
  const [auth, setAuth] = useState({
    loading: true,
    configured: false,
    authenticated: false,
  })
  const [requestForm, setRequestForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestStatus, setRequestStatus] = useState('')
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')

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
    refreshAuth()
      .then((status) => {
        if (status.authenticated) {
          navigate('/priest-tools', { replace: true })
        }
      })
      .catch(() => {
        setAuth({ loading: false, configured: false, authenticated: false })
      })
  }, [navigate])

  useEffect(() => {
    if (approvalState === 'approved') {
      setRequestStatus('The admin request was approved. Sign in with the approved account.')
    } else if (approvalState === 'invalid') {
      setRequestStatus('That approval link is invalid or expired.')
    }
  }, [approvalState])

  const approvalBadge = (() => {
    if (approvalState === 'approved') {
      return { label: 'Approved', className: 'text-bg-success' }
    }
    if (approvalState === 'invalid') {
      return { label: 'Approval link invalid', className: 'text-bg-danger' }
    }
    if (requestStatus) {
      return { label: 'Pending approval', className: 'text-bg-warning text-dark' }
    }
    return { label: 'Awaiting request', className: 'text-bg-secondary' }
  })()

  const handleRequestAccess = async (event) => {
    event.preventDefault()
    setRequestBusy(true)
    setRequestStatus('')

    try {
      const result = await requestPriestAccess(requestForm)
      setRequestForm({ name: '', email: '', password: '' })
      setRequestStatus(
        result.message ||
          'Your request was submitted. An approval email was sent to the temple admins.',
      )
    } catch (requestError) {
      setRequestStatus(requestError?.message || 'Unable to submit the request.')
    } finally {
      setRequestBusy(false)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const email = loginForm.email.trim().toLowerCase()
    const password = loginForm.password
    if (!email || !password) {
      setLoginError('Enter your email and password.')
      return
    }

    setLoginBusy(true)
    setLoginError('')

    try {
      await loginPriestAuth({ email, password })
      setLoginForm({ email: '', password: '' })
      const status = await refreshAuth()
      if (status.authenticated) {
        navigate('/priest-tools', { replace: true })
      }
    } catch (loginFailure) {
      setLoginError(loginFailure?.message || 'Invalid credentials.')
    } finally {
      setLoginBusy(false)
    }
  }

  return (
    <main className="priest-review-page min-vh-100 bg-light text-body" data-bs-theme="light">
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
              <h1 className="h3 fw-semibold mb-2 mt-3">Admin access</h1>
              <p className="mb-0 text-muted">
                Request admin access first. A temple admin must approve it by email before you can sign in.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-3">
                <span className={`badge rounded-pill px-3 py-2 ${approvalBadge.className}`}>{approvalBadge.label}</span>
              </div>
            </div>
            <div className="d-grid gap-2">
              <button type="button" className="btn admin-refresh-btn rounded-pill px-4" onClick={refreshAuth}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="container-xxl">
          {requestStatus ? <div className="alert alert-info mx-auto" style={{ maxWidth: '42rem' }}>{requestStatus}</div> : null}

          <div className="row g-4 justify-content-center">
            <div className="col-lg-6">
              <div className="card shadow-sm border h-100">
                <div className="card-body p-4 p-lg-5">
                  <p className="text-uppercase text-muted small fw-semibold mb-2">Request access</p>
                  <h2 className="h4 mb-3">Register for admin approval</h2>
                  <p className="text-muted mb-4">
                    Submit your name, email, and password. The request goes to the temple admins for approval.
                  </p>
                  <form className="d-grid gap-3" onSubmit={handleRequestAccess}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={requestForm.name}
                          onChange={(event) => setRequestForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Temple admin name"
                          autoComplete="name"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={requestForm.email}
                          onChange={(event) => setRequestForm((current) => ({ ...current, email: event.target.value }))}
                          placeholder="admin@example.com"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <PasswordField
                      label="Password"
                      value={requestForm.password}
                      onChange={(event) =>
                        setRequestForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Create a password"
                      autoComplete="new-password"
                    />
                    <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={requestBusy}>
                      {requestBusy ? 'Submitting...' : 'Request approval'}
                    </button>
                  </form>
                  <div className="small text-muted mt-3">
                    Approval is required before the account can sign in to the private tools.
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card shadow-sm border h-100">
                <div className="card-body p-4 p-lg-5">
                  <p className="text-uppercase text-muted small fw-semibold mb-2">Access</p>
                  <h2 className="h4 mb-3">Admin sign in</h2>
                  <p className="text-muted mb-4">
                    Use an approved admin account to open the private tools page.
                  </p>
                  {!auth.loading && !auth.configured ? (
                    <div className="alert alert-warning">
                      No approved admin account is currently provisioned. Submit a request above and wait for email
                      approval.
                    </div>
                  ) : null}
                  <form className="d-grid gap-3" onSubmit={handleLogin}>
                    <div>
                      <label className="form-label fw-semibold">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                        autoComplete="email"
                        placeholder="admin@example.com"
                      />
                    </div>
                    <PasswordField
                      label="Password"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                      autoComplete="current-password"
                      placeholder="Enter password"
                    />
                    <div className="d-flex flex-wrap gap-3">
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={loginBusy}>
                        {loginBusy ? 'Signing in...' : 'Sign in'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-pill px-4"
                        onClick={() => setLoginForm({ email: '', password: '' })}
                      >
                        Clear
                      </button>
                    </div>
                    {loginError ? <p className="small text-muted mb-0">{loginError}</p> : null}
                  </form>
                </div>
              </div>
            </div>
          </div>

          {auth.authenticated ? (
            <div className="alert alert-secondary mx-auto mt-4" style={{ maxWidth: '42rem' }}>
              Access granted. Opening the private tools page...
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default PriestReviewPage
