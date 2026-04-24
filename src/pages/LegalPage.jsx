function LegalPage({ kicker, title, intro, sections = [] }) {
  return (
    <main>
      <section className="hero-shell hero-shell-compact section-shell">
        <div className="container-xxl hero-grid">
          <div className="row g-4">
            <div className="col-lg-8">
              <div className="reveal">
                <p className="section-kicker">{kicker}</p>
                <h1 className="hero-title">{title}</h1>
                <p className="hero-lede">{intro}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4">
            {sections.map((section, index) => (
              <div className={section.fullWidth ? 'col-12' : 'col-lg-6'} key={`${section.title}-${index}`}>
                <article className="surface surface-pad h-100">
                  <p className="section-kicker">{section.kicker || `0${index + 1}`}</p>
                  <h2 className="section-title mb-3">{section.title}</h2>
                  <div className="legal-copy">
                    {section.paragraphs?.map((paragraph) => (
                      <p key={paragraph} className="mb-3 text-secondary">
                        {paragraph}
                      </p>
                    ))}
                    {section.items?.length ? (
                      <ul className="mb-0 text-secondary">
                        {section.items.map((item) => (
                          <li key={item} className="mb-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default LegalPage
