import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { verifyUserEmail } from '../lib/siteApi.js'

function AccountVerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() || ''
  const [status, setStatus] = useState({
    loading: Boolean(token),
    message: '',
    error: token ? '' : 'The verification link is missing a token.',
  })

  useEffect(() => {
    if (!token) return

    let cancelled = false

    verifyUserEmail(token)
      .then(() => {
        if (cancelled) return
        setStatus({ loading: false, message: 'Email verified. You can sign in now.', error: '' })
        window.setTimeout(() => {
          navigate('/login', { replace: true })
        }, 1500)
      })
      .catch((error) => {
        if (cancelled) return
        setStatus({ loading: false, message: '', error: error?.message || 'Unable to verify the email address.' })
      })

    return () => {
      cancelled = true
    }
  }, [navigate, token])

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="surface surface-strong surface-pad mx-auto" style={{ maxWidth: '42rem' }}>
            <p className="section-kicker mb-2">Email verification</p>
            <h1 className="section-title mb-3">Verify your account</h1>
            <p className="section-intro mb-4">
              This step confirms your email so account messages and order tracking stay connected.
            </p>

            {status.loading ? <div className="alert alert-secondary">Verifying...</div> : null}
            {status.message ? <div className="alert alert-success">{status.message}</div> : null}
            {status.error ? <div className="alert alert-danger">{status.error}</div> : null}

            <div className="d-flex flex-wrap gap-3">
              <NavLink to="/login" className="btn btn-primary rounded-pill px-4">
                Log in
              </NavLink>
              <NavLink to="/track-order" className="btn btn-outline-secondary rounded-pill px-4">
                Track order
              </NavLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AccountVerifyEmailPage
