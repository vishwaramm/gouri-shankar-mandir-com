import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { bootstrapPriestAuth, loadPriestAuthStatus, loginPriestAuth } from '../lib/siteApi.js'

function PriestReviewPage() {
  const navigate = useNavigate()
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
        navigate('/priest-tools', { replace: true })
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
        navigate('/priest-tools', { replace: true })
      }
    } catch (loginFailure) {
      setLoginError(loginFailure?.message || 'Invalid token.')
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
              <h1 className="h3 fw-semibold mb-2 mt-3">Priest access</h1>
              <p className="mb-0 text-muted">
                Generate or enter the access code here. Unlocking takes you to the private tools page.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="container-xxl">
          {!auth.loading && !auth.configured ? (
            <div className="card shadow-sm border mx-auto" style={{ maxWidth: '42rem' }}>
              <div className="card-body p-4 p-lg-5">
                <p className="text-uppercase text-muted small fw-semibold mb-2">Setup</p>
                <h2 className="h4 mb-3">Generate priest access</h2>
                <p className="text-muted mb-4">
                  Create the first access code. It will be emailed to the temple inbox and never shown on the page in production.
                </p>
                <button
                  type="button"
                  className="btn btn-primary rounded-pill px-4"
                  onClick={handleBootstrap}
                  disabled={setupBusy}
                >
                  {setupBusy ? 'Generating...' : 'Generate access code'}
                </button>
                {setupStatus ? <p className="small text-muted mt-3 mb-0">{setupStatus}</p> : null}
                {setupToken ? (
                  <div className="mt-3">
                    <p className="small text-muted mb-2">Access code</p>
                    <div className="border rounded-3 bg-light p-3 font-monospace small text-break">{setupToken}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : !auth.authenticated ? (
            <div className="card shadow-sm border mx-auto" style={{ maxWidth: '42rem' }}>
              <div className="card-body p-4 p-lg-5">
                <p className="text-uppercase text-muted small fw-semibold mb-2">Access</p>
                <h2 className="h4 mb-3">Unlock priest access</h2>
                <p className="text-muted mb-4">
                  Enter the access code that was emailed to the temple inbox.
                </p>
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
                    <button
                      type="button"
                      className="btn btn-outline-secondary rounded-pill px-4"
                      onClick={() => setLoginToken('')}
                    >
                      Clear
                    </button>
                  </div>
                  {loginError ? <p className="small text-muted mb-0">{loginError}</p> : null}
                </form>
              </div>
            </div>
          ) : (
            <div className="alert alert-secondary mx-auto" style={{ maxWidth: '42rem' }}>
              Access granted. Opening the private tools page...
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default PriestReviewPage
