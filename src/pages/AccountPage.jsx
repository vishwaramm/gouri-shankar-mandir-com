import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { OrderProgress } from '../components/OrderProgress.jsx'
import {
  changeUserPassword,
  loadCurrentUser,
  loadUserOrders,
  logoutUser,
  resendUserVerification,
  updateUserProfile,
} from '../lib/siteApi.js'
import { getOrderNextStep, getOrderStatusLabel, isActiveServiceOrder } from '../lib/orderStatus.js'

function formatMoney(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return '$0'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatDate(value) {
  if (!value) return 'Pending'
  const text = String(value).trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return 'Pending'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AccountPage() {
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
    user: null,
  })
  const [ordersState, setOrdersState] = useState({
    loading: false,
    orders: [],
    summary: {
      totalOrders: 0,
      inProgress: 0,
      completed: 0,
    },
  })
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    serviceEmails: true,
    templeLetters: false,
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [profileBusy, setProfileBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')
  const [accountError, setAccountError] = useState('')

  const activeOrders = useMemo(
    () =>
      ordersState.orders.filter(
        (order) =>
          order.type === 'service' && isActiveServiceOrder(order.status),
      ),
    [ordersState.orders],
  )

  useEffect(() => {
    if (!auth.user) return
    setProfileForm({
      name: auth.user.name || '',
      email: auth.user.email || '',
      phone: auth.user.phone || '',
    })
    setNotificationPrefs({
      serviceEmails: auth.user.notificationPrefs?.serviceEmails !== false,
      templeLetters: Boolean(auth.user.notificationPrefs?.templeLetters),
    })
  }, [auth.user])

  const loadAccount = async () => {
    const status = await loadCurrentUser()
    if (!status.authenticated || !status.user) {
      setAuth({ loading: false, authenticated: false, user: null })
      setOrdersState({
        loading: false,
        orders: [],
        summary: { totalOrders: 0, inProgress: 0, completed: 0 },
      })
      return
    }

    setAuth({ loading: false, authenticated: true, user: status.user })
    setOrdersState((current) => ({ ...current, loading: true }))

    try {
      const result = await loadUserOrders()
      setOrdersState({
        loading: false,
        orders: Array.isArray(result.orders) ? result.orders : [],
        summary: result.summary || { totalOrders: 0, inProgress: 0, completed: 0 },
      })
    } catch {
      setOrdersState({
        loading: false,
        orders: [],
        summary: { totalOrders: 0, inProgress: 0, completed: 0 },
      })
    }
  }

  useEffect(() => {
    loadAccount().catch(() => {
      setAuth({ loading: false, authenticated: false, user: null })
      setOrdersState({
        loading: false,
        orders: [],
        summary: { totalOrders: 0, inProgress: 0, completed: 0 },
      })
    })
  }, [])

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setProfileBusy(true)
    setAccountMessage('')
    setAccountError('')

    try {
      const result = await updateUserProfile({
        ...profileForm,
        notificationPrefs,
      })
      if (result.user) {
        setAuth((current) => ({ ...current, user: result.user }))
      }
      window.dispatchEvent(new Event('mandir-user-updated'))
      setAccountMessage(result.message || 'Profile updated.')
      if (result.verificationUrl) {
        setAccountMessage((current) => `${current} Verification link: ${result.verificationUrl}`)
      }
    } catch (error) {
      setAccountError(error?.message || 'Unable to update profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    setPasswordBusy(true)
    setAccountMessage('')
    setAccountError('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAccountError('New passwords do not match.')
      setPasswordBusy(false)
      return
    }

    try {
      const result = await changeUserPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      window.dispatchEvent(new Event('mandir-user-updated'))
      setAccountMessage(result.message || 'Password updated.')
    } catch (error) {
      setAccountError(error?.message || 'Unable to update password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleResendVerification = async () => {
    setVerificationBusy(true)
    setAccountMessage('')
    setAccountError('')

    try {
      const result = await resendUserVerification()
      setAccountMessage(
        result.verificationUrl
          ? 'Verification email sent. Check your inbox.'
          : result.message || 'Verification email sent.',
      )
      if (result.verificationUrl) {
        setAccountMessage((current) => `${current} Verification link: ${result.verificationUrl}`)
      }
    } catch (error) {
      setAccountError(error?.message || 'Unable to send verification email.')
    } finally {
      setVerificationBusy(false)
    }
  }

  const handleLogout = async () => {
    setAccountMessage('')
    setAccountError('')
    try {
      await logoutUser()
      await loadAccount()
      window.dispatchEvent(new Event('mandir-user-updated'))
      setAccountMessage('Signed out.')
    } catch (error) {
      setAccountError(error?.message || 'Unable to sign out.')
    }
  }

  return (
    <main className="account-page min-vh-100" data-bs-theme="dark">
      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-end">
            <div className="col-lg-8">
              <p className="section-kicker">Account</p>
              <h1 className="section-title mb-3">Track your service, payment, and completion status.</h1>
              <p className="section-intro mb-0">
                Sign up once, then use the same account to see your purchase history, in-progress services, and completion emails.
              </p>
            </div>
            <div className="col-lg-4">
              <div className="surface surface-soft surface-pad">
                <p className="section-kicker mb-2">What you get</p>
                <ul className="list-unstyled mb-0 text-secondary d-grid gap-2">
                  <li>Service history in one place</li>
                  <li>Live status for pending and completed rites</li>
                  <li>Password reset if you lose access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block pt-0">
        <div className="container-xxl">
          {auth.loading ? <div className="surface surface-pad">Loading your account...</div> : null}

          {accountMessage ? <div className="alert alert-success">{accountMessage}</div> : null}
          {accountError ? <div className="alert alert-danger">{accountError}</div> : null}

          {!auth.loading && !auth.authenticated ? (
            <>
              <div className="surface surface-pad mb-4">
                <div className="row align-items-end g-4">
                  <div className="col-lg-8">
                    <p className="section-kicker">Get started</p>
                    <h2 className="section-title mb-3">Create an account or log in.</h2>
                    <p className="section-intro mb-0">
                      Use one account to keep service requests, payment history, and completion updates together.
                    </p>
                  </div>
                  <div className="col-lg-4">
                    <p className="text-secondary mb-0">
                      Already submitted a request? Sign in with the same email to view the full history.
                    </p>
                  </div>
                </div>
              </div>

              <div className="row g-4 align-items-stretch">
                <div className="col-lg-6">
                  <div className="surface surface-strong surface-pad h-100">
                    <p className="section-kicker mb-2">Create account</p>
                    <h2 className="h4 mb-3">Sign up</h2>
                    <p className="text-secondary mb-4">
                      Create your account to connect orders, completion emails, and service updates.
                    </p>
                    <div className="d-flex flex-wrap gap-3">
                      <NavLink to="/sign-up" className="btn btn-primary rounded-pill px-4">
                        Sign up
                      </NavLink>
                      <NavLink to="/login" className="btn btn-outline-secondary rounded-pill px-4">
                        Log in
                      </NavLink>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="surface surface-strong surface-pad h-100">
                    <p className="section-kicker mb-2">Existing account</p>
                    <h2 className="h4 mb-3">Log in</h2>
                    <p className="text-secondary mb-4">
                      Use your existing account to view service history and in-progress orders.
                    </p>
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
              </div>

              <div className="surface surface-soft surface-pad mt-4">
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                  <div>
                    <p className="section-kicker mb-2">Public lookup</p>
                    <h2 className="h4 mb-2">Need to check an order?</h2>
                    <p className="text-secondary mb-0">
                      Use the order code from your confirmation email to see status without signing in.
                    </p>
                  </div>
                  <NavLink to="/track-order" className="btn btn-outline-primary rounded-pill px-4">
                    Track order
                  </NavLink>
                </div>
              </div>
            </>
          ) : null}

          {!auth.loading && auth.authenticated ? (
            <>
              <div className="surface surface-strong surface-pad mb-4">
                <div className="row g-4 align-items-end">
                  <div className="col-lg-8">
                    <p className="section-kicker mb-2">Signed in</p>
                    <h2 className="section-title mb-3">Welcome back, {auth.user?.name || 'devotee'}.</h2>
                    <p className="section-intro mb-0">
                      Your service requests, payment history, and completion updates are synchronized here.
                    </p>
                  </div>
                  <div className="col-lg-4">
                    <div className="d-grid gap-2">
                      <div className="small text-secondary">Email</div>
                      <div className="fw-semibold">{auth.user?.email || 'Not set'}</div>
                      <div className="small text-secondary">Joined</div>
                      <div className="fw-semibold">{formatDate(auth.user?.createdAt)}</div>
                      <button type="button" className="btn btn-outline-secondary rounded-pill px-4 mt-2" onClick={handleLogout}>
                        Log out
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {!auth.user?.emailVerifiedAt ? (
                <div className="surface surface-soft surface-pad mb-4">
                  <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                    <div>
                      <p className="section-kicker mb-2">Verification needed</p>
                      <h2 className="h4 mb-2">Verify your email to keep account updates reliable.</h2>
                      <p className="text-secondary mb-0">
                        We can resend the verification link if it didn’t arrive the first time.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill px-4"
                      onClick={handleResendVerification}
                      disabled={verificationBusy}
                    >
                      {verificationBusy ? 'Sending...' : 'Resend verification'}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="row g-4 mb-4">
                <div className="col-lg-6">
                  <div className="surface surface-pad h-100">
                    <p className="section-kicker mb-2">Profile settings</p>
                    <h2 className="h4 mb-3">Update your contact details</h2>
                    <form className="d-grid gap-3" onSubmit={handleProfileSave}>
                      <div>
                        <label className="form-label fw-semibold">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={profileForm.name}
                          onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label className="form-label fw-semibold">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={profileForm.email}
                          onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                          autoComplete="email"
                        />
                      </div>
                        <div>
                          <label className="form-label fw-semibold">Phone</label>
                          <input
                            type="tel"
                            className="form-control"
                            value={profileForm.phone}
                            onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                            autoComplete="tel"
                          />
                        </div>
                      <div className="surface surface-soft surface-pad">
                        <p className="section-kicker mb-2">Notifications</p>
                        <div className="form-check mb-2">
                          <input
                            id="service-emails"
                            className="form-check-input"
                            type="checkbox"
                            checked={notificationPrefs.serviceEmails}
                            onChange={(event) =>
                              setNotificationPrefs((current) => ({
                                ...current,
                                serviceEmails: event.target.checked,
                              }))
                            }
                          />
                          <label className="form-check-label" htmlFor="service-emails">
                            Service update emails
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            id="temple-letters"
                            className="form-check-input"
                            type="checkbox"
                            checked={notificationPrefs.templeLetters}
                            onChange={(event) =>
                              setNotificationPrefs((current) => ({
                                ...current,
                                templeLetters: event.target.checked,
                              }))
                            }
                          />
                          <label className="form-check-label" htmlFor="temple-letters">
                            Temple letters and announcements
                          </label>
                        </div>
                        <p className="small text-secondary mb-0">
                          Service emails include request confirmations, payment updates, and completion notices.
                        </p>
                      </div>
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={profileBusy}>
                        {profileBusy ? 'Saving...' : 'Save profile'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="surface surface-pad h-100">
                    <p className="section-kicker mb-2">Password</p>
                    <h2 className="h4 mb-3">Change your password</h2>
                    <form className="d-grid gap-3" onSubmit={handlePasswordChange}>
                      <div>
                        <label className="form-label fw-semibold">Current password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                          }
                          autoComplete="current-password"
                        />
                      </div>
                      <div>
                        <label className="form-label fw-semibold">New password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                      <div>
                        <label className="form-label fw-semibold">Confirm new password</label>
                        <input
                          type="password"
                          className="form-control"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                          }
                          autoComplete="new-password"
                        />
                      </div>
                      <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={passwordBusy}>
                        {passwordBusy ? 'Updating...' : 'Change password'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <div className="surface surface-pad h-100">
                    <p className="section-kicker mb-2">Purchase history</p>
                    <div className="display-6 mb-2">{ordersState.summary.totalOrders}</div>
                    <p className="text-secondary mb-0">Total orders linked to your account.</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="surface surface-pad h-100">
                    <p className="section-kicker mb-2">In progress</p>
                    <div className="display-6 mb-2">{ordersState.summary.inProgress}</div>
                    <p className="text-secondary mb-0">Requests that are waiting for review or completion.</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="surface surface-pad h-100">
                    <p className="section-kicker mb-2">Completed</p>
                    <div className="display-6 mb-2">{ordersState.summary.completed}</div>
                    <p className="text-secondary mb-0">Finished services with confirmation recorded.</p>
                  </div>
                </div>
              </div>

              <div className="surface surface-pad mb-4">
                <div className="row align-items-end g-3">
                  <div className="col-lg-8">
                    <p className="section-kicker mb-2">In progress services</p>
                    <h2 className="h4 mb-0">What is still moving</h2>
                  </div>
                  <div className="col-lg-4 text-lg-end">
                    <p className="text-secondary mb-0">The next step is always shown in the order card.</p>
                  </div>
                </div>

                <div className="row g-3 mt-3">
                  {ordersState.loading ? <div className="col-12"><div className="surface surface-soft surface-pad">Loading orders...</div></div> : null}
                  {!ordersState.loading && !activeOrders.length ? (
                    <div className="col-12">
                      <div className="surface surface-soft surface-pad">No in-progress services right now.</div>
                    </div>
                  ) : null}
                  {activeOrders.map((order) => (
                    <div className="col-12 col-lg-6" key={`${order.type}-${order.id}`}>
                      <article className="surface surface-soft surface-pad h-100">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <p className="section-kicker mb-2">{order.type === 'service' ? 'Service order' : 'Payment'}</p>
                            <h3 className="h5 mb-2">{order.service}</h3>
                            <p className="text-secondary mb-0">{order.requestId ? `Request ${order.requestId.slice(0, 8)}` : 'One-time payment'}</p>
                          </div>
                          <span className="badge rounded-pill text-bg-light border">{getOrderStatusLabel(order.status)}</span>
                        </div>
                        <div className="row g-3 mt-3 small">
                          <div className="col-sm-4">
                            <div className="text-secondary">Amount</div>
                            <div className="fw-semibold">{formatMoney(order.amountCents)}</div>
                          </div>
                          <div className="col-sm-4">
                            <div className="text-secondary">Paid</div>
                            <div className="fw-semibold">{formatDate(order.paidAt)}</div>
                          </div>
                          <div className="col-sm-4">
                            <div className="text-secondary">Requested</div>
                            <div className="fw-semibold">{formatDate(order.createdAt)}</div>
                          </div>
                        </div>
                        <div className="small text-secondary mt-2">
                          Target completion: {formatDate(order.scheduledFor)}
                        </div>
                        <p className="text-secondary mt-3 mb-0">{getOrderNextStep(order)}</p>
                        <div className="mt-3">
                          <OrderProgress order={order} compact />
                        </div>
                        {order.refundStatus === 'PARTIALLY_REFUNDED' || order.status === 'partially_refunded' ? (
                          <div className="alert alert-warning mt-3 mb-0 py-2 small">
                            Partial refund recorded. The remaining order balance and service status still appear here.
                          </div>
                        ) : null}
                        <div className="d-flex flex-wrap gap-2 mt-3">
                          <NavLink
                            className="btn btn-outline-light btn-sm rounded-pill px-3"
                            to={`/order/${encodeURIComponent(order.orderCode || order.id)}${order.email ? `?email=${encodeURIComponent(order.email)}` : ''}`}
                          >
                            Open details
                          </NavLink>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface surface-strong surface-pad">
                <div className="row align-items-end g-3 mb-3">
                  <div className="col-lg-8">
                    <p className="section-kicker mb-2">Purchase history</p>
                    <h2 className="h4 mb-0">All linked activity</h2>
                  </div>
                  <div className="col-lg-4 text-lg-end">
                    <p className="text-secondary mb-0">Completed and pending items stay in the same history.</p>
                  </div>
                </div>

                <div className="timeline-list">
                  {ordersState.loading ? <div className="surface surface-soft surface-pad">Loading history...</div> : null}
                  {!ordersState.loading && !ordersState.orders.length ? (
                    <div className="surface surface-soft surface-pad">No purchase history yet.</div>
                  ) : null}
                  {ordersState.orders.map((order) => (
                    <article className="timeline-item" key={`${order.type}-${order.id}`}>
                      <time>{formatDate(order.createdAt)}</time>
                      <div>
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <h3 className="h5 mb-1">{order.service}</h3>
                            <p className="mb-1 text-secondary">
                              {order.requestId ? `Request ${order.requestId.slice(0, 8)}` : 'Standalone payment'}
                            </p>
                          </div>
                          <span className="badge rounded-pill text-bg-light border">{getOrderStatusLabel(order.status)}</span>
                        </div>
                        <p className="mb-1">
                          <strong>{formatMoney(order.amountCents)}</strong>
                        </p>
                        <p className="mb-1 text-secondary">Target completion: {formatDate(order.scheduledFor)}</p>
                        <p className="text-secondary mb-0">{getOrderNextStep(order)}</p>
                        {order.refundStatus === 'PARTIALLY_REFUNDED' || order.status === 'partially_refunded' ? (
                          <p className="small text-warning mt-2 mb-0">Partial refund recorded.</p>
                        ) : null}
                        <div className="mt-3">
                          <NavLink
                            to={`/order/${encodeURIComponent(order.orderCode || order.id)}${order.email ? `?email=${encodeURIComponent(order.email)}` : ''}`}
                            className="btn btn-outline-light btn-sm rounded-pill px-3"
                          >
                            Open details
                          </NavLink>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default AccountPage
