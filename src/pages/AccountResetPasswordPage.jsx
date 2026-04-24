import { useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import PasswordField from '../components/PasswordField.jsx'
import { resetPassword } from '../lib/siteApi.js'

function AccountResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [passwords, setPasswords] = useState({
    password: '',
    confirmPassword: '',
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')

    if (!token) {
      setError('The reset link is missing a token.')
      setBusy(false)
      return
    }

    if (passwords.password.length < 8) {
      setError('Use a password with at least 8 characters.')
      setBusy(false)
      return
    }

    if (passwords.password !== passwords.confirmPassword) {
      setError('Passwords do not match.')
      setBusy(false)
      return
    }

    try {
      await resetPassword({
        token,
        password: passwords.password,
      })
      setMessage('Password updated. You can sign in with the new password.')
      setPasswords({ password: '', confirmPassword: '' })
      window.setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1500)
    } catch (resetError) {
      setError(resetError?.message || 'Unable to update the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
            <p className="section-kicker mb-2">Password reset</p>
            <h1 className="section-title mb-3">Create a new password</h1>
            <p className="section-intro mb-4">
              The reset link is single-use and expires after one hour.
            </p>

            {message ? <div className="alert alert-success">{message}</div> : null}
            {error ? <div className="alert alert-danger">{error}</div> : null}

            {!token ? (
              <div className="d-grid gap-3">
                <p className="text-secondary mb-0">
                  Open the reset link from your email or request a new one from the login page.
                </p>
                <NavLink to="/login" className="btn btn-primary rounded-pill px-4">
                  Back to login
                </NavLink>
              </div>
            ) : (
              <form className="d-grid gap-3" onSubmit={handleSubmit}>
                <PasswordField
                  label="New password"
                  value={passwords.password}
                  onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
                <PasswordField
                  label="Confirm password"
                  value={passwords.confirmPassword}
                  onChange={(event) =>
                    setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                  placeholder="Repeat the new password"
                />
                <div className="d-flex flex-wrap gap-3">
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={busy}>
                    {busy ? 'Updating...' : 'Update password'}
                  </button>
                  <NavLink to="/login" className="btn btn-outline-secondary rounded-pill px-4">
                    Cancel
                  </NavLink>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default AccountResetPasswordPage
