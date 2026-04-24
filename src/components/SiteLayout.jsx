import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { legalLinks, navItems } from '../content.js'
import { applySeoForPath } from '../lib/seo.js'
import {
  createContactMessage,
  createNewsletter,
  createRsvp,
  createServiceRequest,
  loadCurrentUser,
  loadPriestAuthStatus,
  loadOperationalAlerts,
  logoutPriestAuth,
  logoutUser,
  reportClientError,
} from '../lib/siteApi.js'
import {
  flushPendingSubmissions,
  loadPendingSubmissions,
  subscribePendingSubmissionChanges,
} from '../lib/offlineQueue.js'

function SiteLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [accountState, setAccountState] = useState({
    loading: true,
    user: null,
  })
  const [adminState, setAdminState] = useState({
    loading: true,
    authenticated: false,
  })
  const [openAlertCount, setOpenAlertCount] = useState(0)
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [pendingSubmissionCount, setPendingSubmissionCount] = useState(0)
  const accountMenuRef = useRef(null)
  const accountToggleRef = useRef(null)
  const adminMenuRef = useRef(null)
  const adminToggleRef = useRef(null)
  const reportedClientErrorsRef = useRef(new Set())
  const location = useLocation()
  const year = new Date().getFullYear()
  const onAdminRoute = location.pathname === '/priest-review' || location.pathname.startsWith('/priest-')
  const getNavLinkClass = (path, isActive) => {
    const featuredClass =
      path === '/services'
        ? 'site-link--services'
        : path === '/blog'
          ? 'site-link--blog'
          : ''

    return `site-link ${featuredClass} ${isActive ? 'is-active' : ''}`.trim()
  }

  const refreshPendingSubmissionCount = useCallback(() => {
    setPendingSubmissionCount(loadPendingSubmissions().length)
  }, [])

  const flushPendingSubmissionsNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return

    await flushPendingSubmissions({
      newsletter: async (entry) =>
        createNewsletter({
          ...entry.payload,
          submissionKey: entry.submissionKey,
        }),
      'contact-message': async (entry) =>
        createContactMessage({
          ...entry.payload,
          submissionKey: entry.submissionKey,
        }),
      'service-request': async (entry) =>
        createServiceRequest({
          ...entry.payload,
          submissionKey: entry.submissionKey,
        }),
      rsvp: async (entry) =>
        createRsvp({
          ...entry.payload,
          submissionKey: entry.submissionKey,
        }),
    })

    refreshPendingSubmissionCount()
  }, [refreshPendingSubmissionCount])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  useEffect(() => {
    applySeoForPath(location.pathname, location.search)
  }, [location.pathname, location.search])

  useEffect(() => {
    refreshPendingSubmissionCount()
    const unsubscribe = subscribePendingSubmissionChanges(refreshPendingSubmissionCount)

    const updateNetworkState = () => {
      setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
    }

    updateNetworkState()
    const handleOnline = () => {
      updateNetworkState()
      void flushPendingSubmissionsNow()
    }
    const handleOffline = () => {
      updateNetworkState()
      refreshPendingSubmissionCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    void flushPendingSubmissionsNow()

    const retryTimer = window.setInterval(() => {
      if (loadPendingSubmissions().length) {
        void flushPendingSubmissionsNow()
      }
    }, 60_000)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.clearInterval(retryTimer)
    }
  }, [flushPendingSubmissionsNow, refreshPendingSubmissionCount])

  useEffect(() => {
    const reportOnce = (payload) => {
      const key = [
        payload.message || '',
        payload.stack || '',
        payload.source || '',
        payload.pageUrl || '',
        payload.filename || '',
        payload.lineNumber || '',
        payload.columnNumber || '',
      ].join('|')

      if (reportedClientErrorsRef.current.has(key)) return
      reportedClientErrorsRef.current.add(key)
      if (reportedClientErrorsRef.current.size > 25) {
        const values = [...reportedClientErrorsRef.current]
        reportedClientErrorsRef.current = new Set(values.slice(-25))
      }

      void reportClientError(payload)
    }

    const handleError = (event) => {
      if (!event) return
      const error = event.error
      const message =
        typeof event.message === 'string' && event.message.trim()
          ? event.message.trim()
          : error?.message || 'Unhandled error'

      if (!message) return

      reportOnce({
        message,
        stack: error?.stack || '',
        source: 'window.error',
        pageUrl: window.location.href,
        filename: typeof event.filename === 'string' ? event.filename : '',
        lineNumber: Number.isInteger(event.lineno) ? event.lineno : null,
        columnNumber: Number.isInteger(event.colno) ? event.colno : null,
        userAgent: navigator.userAgent,
      })
    }

    const handleRejection = (event) => {
      const reason = event?.reason
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : reason?.message || 'Unhandled promise rejection'

      reportOnce({
        message,
        stack: reason instanceof Error ? reason.stack || '' : typeof reason?.stack === 'string' ? reason.stack : '',
        source: 'unhandledrejection',
        pageUrl: window.location.href,
        filename: '',
        lineNumber: null,
        columnNumber: null,
        userAgent: navigator.userAgent,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    loadCurrentUser()
      .then((status) => {
        if (cancelled) return
        setAccountState({
          loading: false,
          user: status?.authenticated && status?.user ? status.user : null,
        })
      })
      .catch(() => {
        if (cancelled) return
        setAccountState({ loading: false, user: null })
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    let cancelled = false

    loadPriestAuthStatus()
      .then((status) => {
        if (cancelled) return
        setAdminState({
          loading: false,
          authenticated: Boolean(status?.authenticated),
        })
      })
      .catch(() => {
        if (cancelled) return
        setAdminState({ loading: false, authenticated: false })
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    const handleUserUpdate = (event) => {
      if (event?.detail && typeof event.detail === 'object' && 'authenticated' in event.detail) {
        setAccountState({
          loading: false,
          user: event.detail.authenticated && event.detail.user ? event.detail.user : null,
        })
        return
      }

      loadCurrentUser()
        .then((status) => {
          setAccountState({
            loading: false,
            user: status?.authenticated && status?.user ? status.user : null,
          })
        })
        .catch(() => {
          setAccountState({ loading: false, user: null })
        })
    }

    window.addEventListener('mandir-user-updated', handleUserUpdate)
    return () => window.removeEventListener('mandir-user-updated', handleUserUpdate)
  }, [])

  useEffect(() => {
    const handleAdminUpdate = (event) => {
      if (event?.detail && typeof event.detail === 'object' && 'authenticated' in event.detail) {
        setAdminState({
          loading: false,
          authenticated: Boolean(event.detail.authenticated),
        })
        return
      }

      loadPriestAuthStatus()
        .then((status) => {
          setAdminState({
            loading: false,
            authenticated: Boolean(status?.authenticated),
          })
        })
        .catch(() => {
          setAdminState({ loading: false, authenticated: false })
        })
    }

    window.addEventListener('mandir-admin-updated', handleAdminUpdate)
    return () => window.removeEventListener('mandir-admin-updated', handleAdminUpdate)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false)
      }

      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshAlerts = async () => {
      if (!adminState.authenticated) {
        if (!cancelled) setOpenAlertCount(0)
        return
      }

      try {
        const data = await loadOperationalAlerts()
        if (cancelled) return
        const openAlerts = Array.isArray(data?.alerts?.open) ? data.alerts.open : []
        setOpenAlertCount(openAlerts.length)
      } catch {
        if (!cancelled) setOpenAlertCount(0)
      }
    }

    void refreshAlerts()
    const timer = window.setInterval(() => {
      void refreshAlerts()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [adminState.authenticated, location.pathname, location.search])

  const handleLogout = async () => {
    await logoutUser()
    setAccountState({ loading: false, user: null })
    setAccountMenuOpen(false)
    window.dispatchEvent(new CustomEvent('mandir-user-updated', { detail: { authenticated: false, user: null } }))
  }

  const handleAdminLogout = async () => {
    try {
      await logoutPriestAuth()
    } finally {
      setAdminState((current) => ({ ...current, authenticated: false }))
      setAdminMenuOpen(false)
      window.dispatchEvent(new CustomEvent('mandir-admin-updated', { detail: { authenticated: false } }))
    }
  }

  return (
    <div className="site-shell d-flex min-vh-100 flex-column">
      <a
        className="site-skip-link"
        href="#main-content"
        onClick={(event) => {
          const target = document.getElementById('main-content')
          if (!target) return
          event.preventDefault()
          target.focus()
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        {!isOnline || pendingSubmissionCount > 0 ? (
          <div className="site-network-banner" role="status" aria-live="polite">
            <div className="container-xxl d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <strong>{isOnline ? 'Pending sync' : 'Offline mode'}</strong>
                <span className="ms-2">
                  {!isOnline
                    ? 'Forms will be saved locally and sent when the connection returns.'
                    : `${pendingSubmissionCount} queued submission${pendingSubmissionCount === 1 ? '' : 's'} will sync automatically.`}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline-light btn-sm rounded-pill px-3"
                onClick={() => void flushPendingSubmissionsNow()}
                disabled={!pendingSubmissionCount}
              >
                Retry now
              </button>
            </div>
          </div>
        ) : null}
        <nav className="site-nav">
          <div className="container-xxl d-flex flex-wrap align-items-center gap-3">
            <NavLink to="/" className="brand-lockup text-decoration-none">
              <span className="brand-mark">GM</span>
              <span className="brand-copy">
                <strong>Gourishankar Mandir</strong>
                <span>Sacred home</span>
              </span>
            </NavLink>

            <button
              type="button"
              className="site-toggle ms-auto"
              aria-expanded={mobileNavOpen}
              aria-controls="primary-links"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMobileNavOpen((current) => !current)}
            >
              <span aria-hidden="true">
                <i />
              </span>
            </button>

            <div id="primary-links" className={mobileNavOpen ? 'site-links is-open' : 'site-links'}>
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) => getNavLinkClass(item.path, isActive)}
                >
                  {item.label}
                </NavLink>
              ))}

              {onAdminRoute || adminState.authenticated || accountState.user ? null : (
                <>
                  <NavLink
                    to="/login"
                    onClick={() => setMobileNavOpen(false)}
                    className="site-link site-link-cta site-link-cta-mobile"
                  >
                    Log In
                  </NavLink>
                  <NavLink
                    to="/sign-up"
                    onClick={() => setMobileNavOpen(false)}
                    className="site-link site-link-cta site-link-cta-mobile site-link-cta-primary"
                  >
                    Sign Up
                  </NavLink>
                </>
              )}
            </div>

            <div className="site-auth-controls">
              {adminState.authenticated ? (
                <div className="site-account" ref={adminMenuRef}>
                  {adminState.loading ? (
                    <div className="site-account-loading text-secondary">Admin</div>
                  ) : (
                    <>
                        <button
                          type="button"
                          className="site-account-toggle"
                          ref={adminToggleRef}
                          aria-expanded={adminMenuOpen}
                          aria-haspopup="menu"
                          aria-label={adminMenuOpen ? 'Close admin menu' : 'Open admin menu'}
                          onClick={() => setAdminMenuOpen((current) => !current)}
                        >
                        <span className="site-account-avatar" aria-hidden="true">
                          A
                        </span>
                        <span className="site-account-copy">
                          <strong>Admin</strong>
                          <span>Private tools</span>
                        </span>
                      </button>
                      {openAlertCount > 0 ? (
                        <NavLink to="/priest-tools" onClick={() => setAdminMenuOpen(false)} className="site-admin-alert-badge">
                          {openAlertCount} open alert{openAlertCount === 1 ? '' : 's'}
                        </NavLink>
                      ) : null}
                      <div className={adminMenuOpen ? 'site-account-menu is-open' : 'site-account-menu'}>
                        <NavLink
                          to="/priest-tools"
                          onClick={() => setAdminMenuOpen(false)}
                          className="site-account-link"
                        >
                          Dashboard
                        </NavLink>
                        <NavLink
                          to="/priest-profile"
                          onClick={() => setAdminMenuOpen(false)}
                          className="site-account-link"
                        >
                          Edit profile
                        </NavLink>
                        <NavLink
                          to="/priest-payment-request"
                          onClick={() => setAdminMenuOpen(false)}
                          className="site-account-link"
                        >
                          Payment requests
                        </NavLink>
                        <NavLink
                          to="/priest-custom-payment"
                          onClick={() => setAdminMenuOpen(false)}
                          className="site-account-link"
                        >
                          Custom payment
                        </NavLink>
                        <button
                          type="button"
                          className="site-account-link site-account-logout"
                          onClick={handleAdminLogout}
                        >
                          Log off
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {onAdminRoute || adminState.authenticated ? null : (
                <div className="site-account" ref={accountMenuRef}>
                  {accountState.loading ? (
                    <div className="site-account-loading text-secondary">
                      Account
                    </div>
                  ) : accountState.user ? (
                    <>
                      <button
                        type="button"
                        className="site-account-toggle"
                        ref={accountToggleRef}
                        aria-expanded={accountMenuOpen}
                        aria-haspopup="menu"
                        aria-label={accountMenuOpen ? 'Close account menu' : 'Open account menu'}
                        onClick={() => setAccountMenuOpen((current) => !current)}
                      >
                        <span className="site-account-avatar" aria-hidden="true">
                          {String(accountState.user.name || 'A').trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="site-account-copy">
                          <strong>{accountState.user.name || 'Account'}</strong>
                          <span>My account</span>
                        </span>
                      </button>
                      <div
                        className={accountMenuOpen ? 'site-account-menu is-open' : 'site-account-menu'}
                      >
                        <NavLink
                          to="/account"
                          onClick={() => setAccountMenuOpen(false)}
                          className="site-account-link"
                        >
                          Dashboard
                        </NavLink>
                        <NavLink
                          to="/track-order"
                          onClick={() => setAccountMenuOpen(false)}
                          className="site-account-link"
                        >
                          Track order
                        </NavLink>
                        <NavLink
                          to="/account/reset-password"
                          onClick={() => setAccountMenuOpen(false)}
                          className="site-account-link"
                        >
                          Reset password
                        </NavLink>
                        <button type="button" className="site-account-link site-account-logout" onClick={handleLogout}>
                          Log off
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="site-auth-actions">
                      <NavLink
                        to="/login"
                        onClick={() => setMobileNavOpen(false)}
                        className="site-auth-link"
                      >
                        Log In
                      </NavLink>
                      <NavLink
                        to="/sign-up"
                        onClick={() => setMobileNavOpen(false)}
                        className="btn btn-primary rounded-pill nav-cta"
                      >
                        Sign Up
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <div id="main-content" className="site-main-content" tabIndex={-1}>
        <Outlet />
      </div>

      <footer className="site-footer">
        <div className="container-xxl section-block">
          <div className="row g-4 align-items-start">
            <div className="col-lg-4">
              <p className="section-kicker mb-3">Gourishankar Mandir</p>
              <h3 className="display-6 mb-3" style={{ maxWidth: '12ch' }}>
                Prayer, learning, and satsang.
              </h3>
              <p className="section-intro mb-4">Temple life shaped for prayer, study, and gathering.</p>
              <div className="mb-4">
                <NavLink to="/admin" className="btn btn-primary rounded-pill px-4">
                  Admin Login
                </NavLink>
              </div>
              <p className="mb-0 text-secondary">{year} Gourishankar Mandir.</p>
            </div>

            <div className="col-md-6 col-lg-2">
              <p className="section-kicker mb-3">Temple life</p>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 text-secondary">Prayer</li>
                <li className="mb-2 text-secondary">Teaching</li>
                <li className="mb-2 text-secondary">Satsang</li>
              </ul>
            </div>

            <div className="col-md-6 col-lg-2">
              <p className="section-kicker mb-3">Visit</p>
              <div className="d-flex flex-column gap-2">
                {navItems.slice(1).map((item) => (
                  <NavLink key={item.path} className="footer-text-link" to={item.path}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="col-md-6 col-lg-2">
              <p className="section-kicker mb-3">Legal</p>
              <div className="d-flex flex-column gap-2">
                {legalLinks.map((item) => (
                  <NavLink key={item.path} className="footer-text-link" to={item.path}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

          </div>
        </div>
      </footer>
    </div>
  )
}

export default SiteLayout
