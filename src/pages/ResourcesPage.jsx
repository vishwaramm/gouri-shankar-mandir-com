import { resourceDetails, resourceItems, socialChannels } from '../content.js'

function ResourcesPage() {
  return (
    <main>
      <section
        className="hero-shell section-shell"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(10, 8, 7, 0.18), rgba(10, 8, 7, 0.8)), url("/images/temple-public-library.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      >
        <div className="hero-backdrop" />
        <div className="hero-veil" />
        <div className="container-xxl hero-grid">
          <div className="row align-items-end g-5">
            <div className="col-lg-7">
              <div className="reveal">
                <p className="section-kicker text-white">Resources</p>
                <h1 className="hero-title text-white">Sacred reference.</h1>
                <p className="hero-lede mt-4">Texts, dates, and teachings.</p>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="surface surface-strong surface-pad reveal delay-1">
                <div className="image-frame mb-4">
                  <img
                    src="/images/temple-public-library.jpg"
                    alt="Temple library materials arranged in calm blue tones"
                  />
                </div>
                <p className="section-kicker">Reference</p>
                <h2 className="h3 mb-3">Mantras, dates, and teachings.</h2>
                <p className="section-intro mb-0">Mantras, dates, and links.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block section-shell">
        <div className="container-xxl">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-7">
              <article className="surface surface-pad h-100">
                <p className="section-kicker">Library</p>
                <h2 className="section-title mb-4">A shelf of devotion.</h2>
                <div className="timeline-list">
                  {resourceItems.map((item, index) => (
                    <div className="timeline-item" key={item}>
                      <time>0{index + 1}</time>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
                <div className="story-grid mt-4">
                  {resourceDetails.map((detail, index) => (
                    <article className="story-item" key={detail}>
                      <strong>0{index + 1}</strong>
                      <p>{detail}</p>
                    </article>
                  ))}
                </div>
              </article>
            </div>

            <div className="col-lg-5">
              <article className="surface surface-strong surface-pad h-100">
                <p className="section-kicker">Temple channels</p>
                <h2 className="section-title mb-3">Where to hear the mandir.</h2>
                <p className="section-intro mb-4">Facebook, Instagram, and YouTube.</p>
                <div className="timeline-list">
                  {socialChannels.map((channel, index) => (
                    <div className="timeline-item" key={channel.label}>
                      <time>0{index + 1}</time>
                      <div>
                        <h3 className="h5 mb-1">{channel.label}</h3>
                        <p>{channel.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ResourcesPage
