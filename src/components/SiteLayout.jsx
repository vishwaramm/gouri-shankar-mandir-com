import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { navItems } from '../content.js'

function SiteLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const year = new Date().getFullYear()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

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

      <Outlet />

      <footer className="site-footer">
        <div className="container-xxl section-block">
          <div className="row g-4 align-items-start">
            <div className="col-lg-5">
              <p className="section-kicker mb-3">Gourishankar Mandir</p>
              <h3 className="display-6 mb-3" style={{ maxWidth: '12ch' }}>
                Prayer, learning, and satsang.
              </h3>
              <p className="section-intro mb-4">Temple life shaped for prayer, study, and gathering.</p>
              <p className="mb-0 text-secondary">{year} Gourishankar Mandir.</p>
            </div>

            <div className="col-md-6 col-lg-3">
              <p className="section-kicker mb-3">Temple life</p>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 text-secondary">Prayer</li>
                <li className="mb-2 text-secondary">Teaching</li>
                <li className="mb-2 text-secondary">Satsang</li>
              </ul>
            </div>

            <div className="col-md-6 col-lg-4">
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
          </div>
        </div>
      </footer>
    </div>
  )
}

export default SiteLayout
