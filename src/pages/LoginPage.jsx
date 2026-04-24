import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { loadCurrentUser, loginUser } from '../lib/siteApi.js'
import PasswordField from '../components/PasswordField.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const [authReady, setAuthReady] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    loadCurrentUser()
      .then((status) => {
        if (cancelled) return
        if (status.authenticated) {
          navigate('/account', { replace: true })
          return
        }
        setAuthReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setAuthReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await loginUser(loginForm)
      window.dispatchEvent(new Event('mandir-user-updated'))
      navigate('/account', { replace: true })
    } catch (loginError) {
      setError(loginError?.message || 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-end">
            <div className="col-lg-8">
              <p className="section-kicker">Log in</p>
              <h1 className="section-title mb-3">Sign in to your account.</h1>
              <p className="section-intro mb-0">
                View purchase history, current services, receipts, and completion updates.
              </p>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-soft surface-pad">
                <p className="section-kicker mb-2">Need an account?</p>
                <p className="text-secondary mb-3">Create one to connect your order history and service updates.</p>
                <NavLink to="/sign-up" className="btn btn-outline-primary rounded-pill px-4">
                  Sign up
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="container-xxl">
          {!authReady ? <div className="surface surface-pad">Loading login...</div> : null}

          {error ? <div className="alert alert-danger">{error}</div> : null}

          {authReady ? (
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-7">
                <div className="surface surface-strong surface-pad h-100">
                  <p className="section-kicker mb-2">Existing account</p>
                  <h2 className="h4 mb-3">Welcome back</h2>
                  <form className="d-grid gap-3" onSubmit={handleLogin}>
                    <div>
                      <label className="form-label fw-semibold">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Email address"
                        autoComplete="email"
                      />
                    </div>
                    <PasswordField
                      label="Password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Password"
                      autoComplete="current-password"
                    />
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={busy}>
                        {busy ? 'Signing in...' : 'Log in'}
                      </button>
                      <NavLink to="/account/reset-password" className="text-decoration-none small">
                        Forgot password?
                      </NavLink>
                    </div>
                  </form>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="surface surface-pad h-100">
                  <p className="section-kicker mb-2">Need an account?</p>
                  <ul className="list-unstyled d-grid gap-2 text-secondary mb-0">
                    <li>Sign up once and keep your order history in one place.</li>
                    <li>Use the same account to see payments and completion status.</li>
                    <li>Reset your password anytime if you lose access.</li>
                    <li>You can also track an order without logging in.</li>
                  </ul>
                  <div className="d-flex flex-wrap gap-3 mt-4">
                    <NavLink to="/sign-up" className="btn btn-outline-primary rounded-pill px-4">
                      Sign up
                    </NavLink>
                    <NavLink to="/track-order" className="btn btn-outline-secondary rounded-pill px-4">
                      Track order
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default LoginPage
