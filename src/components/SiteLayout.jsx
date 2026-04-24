import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { navItems } from '../content.js'
import { applySeoForPath } from '../lib/seo.js'
import { loadCurrentUser, loadPriestAuthStatus, logoutPriestAuth, logoutUser } from '../lib/siteApi.js'

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
  const accountMenuRef = useRef(null)
  const accountToggleRef = useRef(null)
  const adminMenuRef = useRef(null)
  const adminToggleRef = useRef(null)
  const location = useLocation()
  const year = new Date().getFullYear()
  const onAdminRoute = location.pathname === '/priest-review' || location.pathname.startsWith('/priest-')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  useEffect(() => {
    applySeoForPath(location.pathname, location.search)
  }, [location.pathname, location.search])

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
    const handleUserUpdate = () => {
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
    const handleAdminUpdate = () => {
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

  const handleLogout = async () => {
    await logoutUser()
    setAccountState({ loading: false, user: null })
    setAccountMenuOpen(false)
    window.dispatchEvent(new Event('mandir-user-updated'))
  }

  const handleAdminLogout = async () => {
    try {
      await logoutPriestAuth()
    } finally {
      setAdminState((current) => ({ ...current, authenticated: false }))
      setAdminMenuOpen(false)
      window.dispatchEvent(new Event('mandir-admin-updated'))
    }
  }

  return (
    <div className="site-shell d-flex min-vh-100 flex-column">
      <header className="site-header">
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
              aria-label="Toggle navigation"
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
                  className={({ isActive }) => `site-link ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}

              {onAdminRoute || adminState.authenticated || accountState.user ? null : (
                <NavLink
                  to="/sign-up"
                  onClick={() => setMobileNavOpen(false)}
                  className="site-link site-link-cta site-link-cta-mobile"
                >
                  Sign Up
                </NavLink>
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
                    <NavLink
                      to="/sign-up"
                      onClick={() => setMobileNavOpen(false)}
                      className="btn btn-primary rounded-pill nav-cta"
                    >
                      Sign Up
                    </NavLink>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="container-xxl section-block">
          <div className="row g-4 align-items-start">
            <div className="col-lg-4">
              <p className="section-kicker mb-3">Gourishankar Mandir</p>
              <h3 className="display-6 mb-3" style={{ maxWidth: '12ch' }}>
                Prayer, learning, and satsang.
              </h3>
              <p className="section-intro mb-4">Temple life shaped for prayer, study, and gathering.</p>
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

            <div className="col-md-6 col-lg-3">
              <p className="section-kicker mb-3">Visit</p>
              <div className="d-flex flex-column gap-2">
                {navItems.slice(1).map((item) => (
                  <NavLink key={item.path} className="journey-link" to={item.path}>
                    <div>
                      <h3>{item.label}</h3>
                    </div>
                    <span className="journey-arrow">↗</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <p className="section-kicker mb-3">Admin</p>
              <div className="surface surface-soft surface-pad h-100">
                <h3 className="h5 mb-3">Admin login</h3>
                <p className="text-secondary mb-4">
                  Open the private access page to generate or use the access code, then unlock the private tools page.
                </p>
                <div className="d-flex flex-column gap-2">
                  <NavLink to="/admin" className="btn btn-primary rounded-pill px-4">
                    Open admin login
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default SiteLayout
