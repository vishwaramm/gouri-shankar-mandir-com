import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import PasswordField from '../components/PasswordField.jsx'
import { loadCurrentUser, signupUser } from '../lib/siteApi.js'

function SignUpPage() {
  const navigate = useNavigate()
  const [authReady, setAuthReady] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
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

  const handleSignup = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const result = await signupUser(signupForm)
      window.dispatchEvent(new Event('mandir-user-updated'))
      setSignupForm({ name: '', email: '', password: '' })
      setCompleted(true)
      setMessage(
        result.verificationEmailSent
          ? 'Account created. Check your email to verify the account.'
          : 'Account created.',
      )
      if (result.verificationUrl) {
        setMessage((current) => `${current} Verification link: ${result.verificationUrl}`)
      }
    } catch (signupError) {
      setError(signupError?.message || 'Unable to create the account.')
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
              <p className="section-kicker">Sign up</p>
              <h1 className="section-title mb-3">Create your account.</h1>
              <p className="section-intro mb-0">
                Use one account to track service orders, payment history, and completion updates.
              </p>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-soft surface-pad">
                <p className="section-kicker mb-2">Already have one?</p>
                <p className="text-secondary mb-3">Log in with the same email tied to your orders.</p>
                <NavLink to="/login" className="btn btn-outline-primary rounded-pill px-4">
                  Log in
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="container-xxl">
          {!authReady ? <div className="surface surface-pad">Loading account setup...</div> : null}

          {message ? <div className="alert alert-success">{message}</div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}

          {authReady && !completed ? (
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-7">
                <div className="surface surface-strong surface-pad h-100">
                  <p className="section-kicker mb-2">Create account</p>
                  <h2 className="h4 mb-3">Register now</h2>
                  <form className="d-grid gap-3" onSubmit={handleSignup}>
                    <div>
                      <label className="form-label fw-semibold">Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={signupForm.name}
                        onChange={(event) => setSignupForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Full name"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="form-label fw-semibold">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={signupForm.email}
                        onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Email address"
                        autoComplete="email"
                      />
                    </div>
                    <PasswordField
                      label="Password"
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={busy}>
                        {busy ? 'Creating...' : 'Create account'}
                      </button>
                      <NavLink to="/login" className="text-decoration-none small">
                        Already have an account? Log in
                      </NavLink>
                    </div>
                  </form>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="surface surface-pad h-100">
                  <p className="section-kicker mb-2">What happens next</p>
                  <ul className="list-unstyled d-grid gap-2 text-secondary mb-0">
                    <li>We create your account and connect the email to your orders.</li>
                    <li>You can track service status, receipts, and completion updates.</li>
                    <li>If verification is needed, we send a confirmation email.</li>
                    <li>You can sign in later from any device.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {authReady && completed ? (
            <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
              <p className="section-kicker mb-2">Account created</p>
              <h2 className="h4 mb-3">Your sign-up is complete.</h2>
              <p className="text-secondary mb-4">
                Use the dashboard to follow your service history, or go straight to login if you want to use a
                different account.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <NavLink to="/account" className="btn btn-primary rounded-pill px-4">
                  Open account
                </NavLink>
                <NavLink to="/login" className="btn btn-outline-secondary rounded-pill px-4">
                  Log in
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default SignUpPage
