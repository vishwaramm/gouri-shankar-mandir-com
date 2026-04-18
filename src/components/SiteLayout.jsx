import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { navItems } from '../content.js'
import { applySeoForPath } from '../lib/seo.js'

function SiteLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const year = new Date().getFullYear()
  const showHeader =
    location.pathname !== '/payments' &&
    location.pathname !== '/priest-review' &&
    location.pathname !== '/priest-tools' &&
    location.pathname !== '/priest-payment-request' &&
    location.pathname !== '/priest-custom-payment'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  useEffect(() => {
    applySeoForPath(location.pathname, location.search)
  }, [location.pathname, location.search])

  return (
    <div className="site-shell d-flex min-vh-100 flex-column">
      {showHeader ? (
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

              <div
                id="primary-links"
                className={mobileNavOpen ? 'site-links is-open' : 'site-links'}
              >
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
                <NavLink
                  to="/contact"
                  onClick={() => setMobileNavOpen(false)}
                  className="btn btn-primary rounded-pill nav-cta"
                >
                  Contact
                </NavLink>
              </div>
            </div>
          </nav>
        </header>
      ) : null}

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
                <h3 className="h5 mb-3">Priest review</h3>
                <p className="text-secondary mb-4">
                  Open the private access page to generate or use the access code, then open the tools page after unlock.
                </p>
                <div className="d-flex flex-column gap-2">
                  <NavLink to="/priest-review" className="btn btn-primary rounded-pill px-4">
                    Open priest access
                  </NavLink>
                  <NavLink to="/priest-tools" className="btn btn-outline-secondary rounded-pill px-4">
                    Open priest tools
                  </NavLink>
                  <NavLink to="/priest-payment-request" className="btn btn-outline-secondary rounded-pill px-4">
                    Open payment request
                  </NavLink>
                  <NavLink to="/priest-custom-payment" className="btn btn-outline-secondary rounded-pill px-4">
                    Open custom payment
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
